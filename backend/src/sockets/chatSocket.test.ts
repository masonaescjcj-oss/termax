/**
 * What the chat server refuses.
 *
 * The community chat had no server-side gate of its own. The JOIN GROUP
 * button in the app was the only thing between an account and a community,
 * the room history was handed to anyone who could open a socket, and
 * nothing bounded a message's size or how fast they could arrive. A gate
 * that lives in the client is not a gate, so these tests drive the socket
 * handlers directly — the way anything holding a websocket could.
 *
 * Run with:  npx ts-node src/sockets/chatSocket.test.ts
 */

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-key';

/* eslint-disable @typescript-eslint/no-var-requires */
const { supabase } = require('../config/supabase');
const User = require('../models/User').default;
const Community = require('../models/Community').default;
const ChatMessage = require('../models/ChatMessage').default;
const { setupChatSockets } = require('./chatSocket');

let passed = 0;
const failures: string[] = [];
function check(name: string, got: unknown, want: unknown) {
    if (got === want) passed++;
    else failures.push(`${name}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
}
function section(t: string) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`); }

// ── the world the handlers see ───────────────────────────────────────
const MEMBER = { id: 'u-member', username: 'reza', role: 'user' };
const OUTSIDER = { id: 'u-outsider', username: 'kian', role: 'user' };

const TOKENS: Record<string, any> = {
    'tok-member': MEMBER,
    'tok-outsider': OUTSIDER,
};

supabase.auth = {
    getUser: async (token: string) =>
        TOKENS[token]
            ? { data: { user: { id: TOKENS[token].id } }, error: null }
            : { data: { user: null }, error: { message: 'bad token' } },
};

User.findById = async (id: string) => {
    const found = Object.values(TOKENS).find((u: any) => u.id === id);
    return found ? { ...found, _id: id, avatarUrl: null, activeNft: null } : null;
};
User.find = async () => [];

// The member's successful join reaches the history query; hand it an empty
// room so the run is quiet and the assertions are the only output.
ChatMessage.find = () => {
    const p: any = Promise.resolve([]);
    p.lean = () => p; p.populate = () => p; p.sort = () => p; p.limit = () => p;
    return p;
};

// The real model returns a Mongoose-shaped chain, so the double has to as
// well — `joinChat` reads it twice, once bare and once with .populate().
Community.findOne = (query: any) => {
    const row = query?.name === 'Gold Only'
        ? { _id: 'c1', id: 'c1', name: 'Gold Only', slug: 'gold-only', members: [MEMBER.id], admins: [], moderators: [], memberCount: 1, save: async () => undefined }
        : null;
    const p: any = Promise.resolve(row);
    p.lean = () => p; p.populate = () => p; p.select = () => p;
    return p;
};

let saved: any[] = [];

// One message, and it lives in a different room than the one the caller
// will claim when trying to delete it.
const OTHER_ROOM_MESSAGE = { _id: 'm-elsewhere', id: 'm-elsewhere', room: 'Another Room', userId: 'someone', text: 'hi' };
let deleted: string[] = [];
ChatMessage.findById = (id: string) => {
    const p: any = Promise.resolve(
        id === 'm-elsewhere' ? OTHER_ROOM_MESSAGE
            : saved.find((m: any) => m.id === id) ?? null);
    p.lean = () => p; p.populate = () => p; p.sort = () => p; p.limit = () => p;
    return p;
};
ChatMessage.findByIdAndDelete = async (id: string) => { deleted.push(id); return null; };

// A message that gets past every gate would otherwise try to reach the real
// database. Saving it is not what these tests are about — that it was
// allowed through at all is.
ChatMessage.prototype.save = async function () { saved.push(this); this._id = `m-${saved.length}`; this.id = this._id; return this; };

// ── a socket double that records what the server said ────────────────
type Handlers = Record<string, (payload: any) => any>;

function makeSocket(token?: string) {
    const handlers: Handlers = {};
    const emitted: { event: string; payload: any }[] = [];
    const joined: string[] = [];
    const left: string[] = [];
    const socket: any = {
        id: 'sock-1',
        data: {},
        handshake: { auth: token ? { token } : {}, query: {} },
        on: (event: string, fn: any) => { handlers[event] = fn; },
        emit: (event: string, payload: any) => emitted.push({ event, payload }),
        join: (room: string) => joined.push(room),
        leave: (room: string) => left.push(room),
        to: () => ({ emit: () => undefined }),
    };
    return { socket, handlers, emitted, joined, left };
}

function makeIo() {
    let connectionHandler: any = null;
    const io: any = {
        on: (event: string, fn: any) => { if (event === 'connection') connectionHandler = fn; },
        to: () => ({ emit: () => undefined }),
        sockets: { sockets: new Map() },
    };
    setupChatSockets(io);
    return (token?: string) => {
        const s = makeSocket(token);
        connectionHandler(s.socket);
        return s;
    };
}

const errorsFrom = (emitted: { event: string; payload: any }[]) =>
    emitted.filter(e => e.event === 'chatError').map(e => String(e.payload));

async function main() {
const connect = makeIo();

// ── the room history is not public ───────────────────────────────────
section('the history is not handed to anyone who asks');

let c = connect();                       // no token at all
await c.handlers.joinChat('Gold Only');
check('an unauthenticated join is refused', c.joined.length, 0);
check('and it says why', errorsFrom(c.emitted)[0], 'Sign in to open this chat.');

c = connect('tok-outsider');
await c.handlers.joinChat('No Such Room');
check('a room that does not exist is refused', c.joined.length, 0);

c = connect('tok-member');
await c.handlers.joinChat('Gold Only');
check('a signed-in member does join', c.joined[0], 'chat_Gold Only');

// ── membership is enforced on the server ─────────────────────────────
section('posting needs membership, not a button');

c = connect('tok-outsider');
await c.handlers.sendMessage({ room: 'Gold Only', token: 'tok-outsider', text: 'let me in' });
check('a non-member cannot post', errorsFrom(c.emitted)[0], 'Join this community before posting in it.');

c = connect('tok-member');
await c.handlers.sendMessage({ room: 'Gold Only', token: 'nonsense', text: 'hello' });
check('an invalid token is told to sign in again',
    errorsFrom(c.emitted)[0], 'Your session expired. Sign in again to send messages.');

// ── size and rate ────────────────────────────────────────────────────
section('a message has a size, and they have a rate');

c = connect('tok-member');
await c.handlers.sendMessage({ room: 'Gold Only', token: 'tok-member', text: 'x'.repeat(5000) });
check('an oversized message is refused',
    errorsFrom(c.emitted)[0], 'A message can be at most 4000 characters.');

c = connect('tok-member');
await c.handlers.sendMessage({ room: 'Gold Only', token: 'tok-member', text: 'hi', mediaUrl: 'd'.repeat(2_000_001) });
check('an oversized attachment is refused',
    errorsFrom(c.emitted)[0], 'That attachment is too large. Try a smaller image or a shorter recording.');

// The burst is 8; the ninth in the same instant has nothing left to spend.
c = connect('tok-member');
saved = [];
for (let i = 0; i < 12; i++) {
    await c.handlers.sendMessage({ room: 'Gold Only', token: 'tok-member', text: `flood ${i}` });
}
check('a flood is throttled',
    errorsFrom(c.emitted).includes('You are sending messages too quickly. Wait a moment.'), true);
check('and only the burst got through', saved.length <= 8, true);

// ── moderation cannot reach across rooms ─────────────────────────────
section('a moderator of one room cannot reach into another');

deleted = [];
c = connect('tok-member');
await c.handlers.deleteMessage({ room: 'Gold Only', token: 'tok-member', messageId: 'm-elsewhere' });
check('a message from another room is left alone', deleted.length, 0);

// ── the member list is not public either ─────────────────────────────
section('the member list is not public');

c = connect();
await c.handlers.getMembers({ room: 'Gold Only' });
check('an unauthenticated member listing returns nothing',
    c.emitted.filter(e => e.event === 'membersList').length, 0);

c = connect('tok-outsider');
await c.handlers.getMembers({ room: 'Gold Only' });
check('and a non-member gets nothing either',
    c.emitted.filter(e => e.event === 'membersList').length, 0);

// ── report ───────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(64)}`);
if (failures.length) {
    console.log(`❌ ${failures.length} failed, ${passed} passed\n`);
    failures.forEach(f => console.log(`  ✗ ${f}\n`));
    process.exit(1);
}
console.log(`✅ all ${passed} assertions passed`);
}

main();
