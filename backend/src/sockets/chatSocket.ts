import { Server, Socket } from 'socket.io';
import ChatMessage from '../models/ChatMessage';
import Community from '../models/Community';
import User from '../models/User';
import { supabase } from '../config/supabase';

type Auth = { id: string; username: string; role: string };

/**
 * Verify a token and return the user behind it.
 *
 * Every event carries its own token and this used to be a full round trip
 * for each one: a Supabase `auth.getUser` plus a user row, every time
 * anybody typed, liked, or sent. The typing indicator alone fires every two
 * seconds per person, so a handful of people chatting was thousands of
 * Supabase requests an hour for nothing new.
 *
 * The answer is cached against the socket for the token it was issued for.
 * A token that changes — a new session — misses the cache and is verified
 * properly, and the entry expires so a revoked session cannot outlive it by
 * more than the TTL.
 */
const AUTH_TTL_MS = 60_000;

const authenticateSocket = async (socket: Socket, token: string): Promise<Auth | null> => {
    if (!token || typeof token !== 'string') return null;

    const cached = (socket.data as any).authCache;
    if (cached && cached.token === token && Date.now() - cached.at < AUTH_TTL_MS) {
        return cached.auth;
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return null;

        const dbUser = await User.findById(user.id);
        if (!dbUser) return null;

        const auth: Auth = {
            id: dbUser.id || dbUser._id || user.id,
            username: dbUser.username || user.user_metadata?.username || 'user',
            role: dbUser.role || 'user'
        };
        (socket.data as any).authCache = { token, auth, at: Date.now() };
        return auth;
    } catch (err) {
        console.error('Socket authentication error:', err);
        return null;
    }
};

/** The token a client supplied at connection time, if any. */
const connectionToken = (socket: Socket): string =>
    String((socket.handshake.auth as any)?.token || (socket.handshake.query as any)?.token || '');

/**
 * Membership in a community, cached per socket.
 *
 * `sendMessage` never checked this at all: the JOIN GROUP button in the app
 * was the only gate, and a gate that lives in the client is not a gate. Any
 * account could post into any community, including one it had been kicked
 * from.
 */
const MEMBER_TTL_MS = 30_000;

const communityMembership = async (
    socket: Socket, room: string, userId: string
): Promise<{ exists: boolean; isMember: boolean }> => {
    const key = `${room}::${userId}`;
    const cache = ((socket.data as any).memberCache ??= new Map<string, any>());
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < MEMBER_TTL_MS) return hit.value;

    const community = await Community.findOne({ name: room, isActive: true });
    let value: { exists: boolean; isMember: boolean };
    if (!community) {
        value = { exists: false, isMember: false };
    } else {
        const ids = (community.members || []).map((m: any) =>
            String(m && typeof m === 'object' ? (m.id ?? m._id) : m));
        value = { exists: true, isMember: ids.includes(String(userId)) };
    }
    cache.set(key, { value, at: Date.now() });
    return value;
};

/** Forget a cached membership answer after joining or leaving. */
const forgetMembership = (socket: Socket, room: string, userId: string) => {
    ((socket.data as any).memberCache as Map<string, any> | undefined)?.delete(`${room}::${userId}`);
};

/**
 * A token bucket per socket per action.
 *
 * Nothing limited how fast a client could emit. One loop calling
 * `sendMessage` cost an authentication, a mention lookup, an insert, a
 * re-read and a broadcast to every member — several database round trips
 * per iteration, as fast as the socket could carry them.
 */
const LIMITS: Record<string, { burst: number; perSecond: number }> = {
    send: { burst: 8, perSecond: 1 },
    typing: { burst: 6, perSecond: 2 },
    action: { burst: 20, perSecond: 4 },
    history: { burst: 8, perSecond: 1 },
};

const allow = (socket: Socket, kind: keyof typeof LIMITS | string): boolean => {
    const spec = LIMITS[kind] ?? LIMITS.action;
    const buckets = ((socket.data as any).buckets ??= new Map<string, { tokens: number; at: number }>());
    const now = Date.now();
    const b = buckets.get(kind) ?? { tokens: spec.burst, at: now };
    b.tokens = Math.min(spec.burst, b.tokens + ((now - b.at) / 1000) * spec.perSecond);
    b.at = now;
    if (b.tokens < 1) { buckets.set(kind, b); return false; }
    b.tokens -= 1;
    buckets.set(kind, b);
    return true;
};

/** A room name is a community name, not free-form text. */
const cleanRoom = (room: unknown): string | null => {
    const r = String(room ?? '').trim();
    if (!r || r.length > 80) return null;
    return r;
};

// Anything larger than this is not a chat message. Media arrives as a
// base64 data URI on the same channel, gets stored in the row, and is then
// re-broadcast to everyone in the room — so an unbounded one is an
// unbounded cost multiplied by the member count.
const MAX_TEXT = 4_000;
const MAX_MEDIA = 2_000_000;

// Helper: check if user is admin/mod of a community
const isGroupAdmin = async (roomName: string, userId: string): Promise<boolean> => {
    const community = await Community.findOne({ name: roomName, isActive: true });
    if (!community) return false;
    return community.admins.some(id => id.toString() === userId) ||
           community.moderators.some(id => id.toString() === userId);
};

// Helper: convert any message (class instance or plain object) to a plain JSON-safe object
// Guarantees _id is always present for client compatibility
const toPlainMessage = (msg: any): any => {
    if (!msg) return null;
    const plain = typeof msg.toJSON === 'function' ? msg.toJSON() : { ...msg };
    if (!plain._id && plain.id) plain._id = plain.id;
    if (!plain.id && plain._id) plain.id = plain._id;
    return plain;
};

export const setupChatSockets = (io: Server) => {
    io.on('connection', (socket: Socket) => {

        // Join a chat room (community slug)
        //
        // This used to take a bare room name from anyone connected and hand
        // back the room's history and member counts with no check at all —
        // a private community was private only in the client.
        socket.on('joinChat', async (room: string) => {
            const roomName = cleanRoom(room);
            if (!roomName || !allow(socket, 'history')) return;

            const auth = await authenticateSocket(socket, connectionToken(socket));
            if (!auth) {
                socket.emit('chatError', 'Sign in to open this chat.');
                return;
            }

            const { exists } = await communityMembership(socket, roomName, auth.id);
            if (!exists) {
                socket.emit('chatError', 'That community does not exist.');
                return;
            }

            socket.join(`chat_${roomName}`);
            console.log(`💬 ${auth.username} joined chat: ${roomName}`);

            try {
                // Send last 50 messages to the user who just joined. The
                // limit is real now — see ChatMessage.find.
                const messages = await ChatMessage.find({ room: roomName })
                    .sort({ createdAt: -1 })
                    .limit(50)
                    .populate('replyTo', 'username text mediaUrl')
                    .lean();

                const plainMessages = (Array.isArray(messages) ? messages : []).map(toPlainMessage);
                const userIds = Array.from(new Set(plainMessages.map(m => m.userId).filter(Boolean)));
                // `_id: { $in }` was ignored by the model, so this read the
                // whole users table on every join.
                const users = userIds.length ? await User.find({ _id: { $in: userIds } }) : [];
                const userNftMap = new Map(users.map(u => [u.id || u._id, u.activeNft]));
                plainMessages.forEach(m => {
                    m.activeNft = userNftMap.get(m.userId) || null;
                });
                socket.emit('chatHistory', plainMessages.reverse());

                // Send community info (admins, members count)
                const community = await Community.findOne({ name: roomName, isActive: true })
                    .populate('admins', 'username avatarUrl')
                    .populate('moderators', 'username avatarUrl')
                    .populate('pinnedMessageId')
                    .lean();
                if (community) {
                    socket.emit('communityInfo', {
                        id: community._id,
                        name: community.name,
                        slug: community.slug,
                        description: community.description,
                        imageUrl: community.imageUrl,
                        iconColor: community.iconColor,
                        category: community.category,
                        memberCount: community.memberCount,
                        admins: community.admins,
                        moderators: community.moderators,
                        pinnedMessageId: community.pinnedMessageId ? (community.pinnedMessageId as any)._id : null,
                        pinnedMessage: community.pinnedMessageId
                    });
                }
            } catch (error) {
                console.error('Error fetching chat history:', error);
            }
        });

        // Leave a chat room
        socket.on('leaveChat', (room: string) => {
            socket.leave(`chat_${room}`);
        });

        // Load older messages (pagination)
        socket.on('loadOlder', async (data: { room: string, beforeId: string }) => {
            const roomName = cleanRoom(data?.room);
            if (!roomName || !allow(socket, 'history')) return;

            const auth = await authenticateSocket(socket, connectionToken(socket));
            if (!auth) return;

            try {
                const anchorMsg = await ChatMessage.findById(data.beforeId).lean();
                if (!anchorMsg) return;
                // The anchor has to belong to the room being paged, or an id
                // from anywhere would page another room's history.
                if (anchorMsg.room !== roomName) return;

                const olderMessages = await ChatMessage.find({
                    room: roomName,
                    createdAt: { $lt: anchorMsg.createdAt }
                })
                    .sort({ createdAt: -1 })
                    .limit(50)
                    .populate('replyTo', 'username text mediaUrl')
                    .lean();

                const plainOlder = (Array.isArray(olderMessages) ? olderMessages : []).map(toPlainMessage);
                socket.emit('olderMessages', plainOlder.reverse());
            } catch (error) {
                console.error('Error loading older messages:', error);
                socket.emit('olderMessages', []);
            }
        });

        // Typing indicator
        socket.on('typing', async (data: { room: string, token: string }) => {
            const roomName = cleanRoom(data?.room);
            if (!roomName || !allow(socket, 'typing')) return;
            try {
                const auth = await authenticateSocket(socket, data.token);
                if (!auth) return;
                socket.to(`chat_${roomName}`).emit('userTyping', { username: auth.username });
            } catch {}
        });

        // Handle incoming chat message
        socket.on('sendMessage', async (data: { room: string, text?: string, mediaUrl?: string, replyTo?: string, token: string }) => {
            try {
                const roomName = cleanRoom(data?.room);
                if ((!data.text && !data.mediaUrl) || !roomName || !data.token) {
                    return;
                }

                if (!allow(socket, 'send')) {
                    socket.emit('chatError', 'You are sending messages too quickly. Wait a moment.');
                    return;
                }

                const text = typeof data.text === 'string' ? data.text.trim() : '';
                if (text.length > MAX_TEXT) {
                    socket.emit('chatError', `A message can be at most ${MAX_TEXT} characters.`);
                    return;
                }
                if (data.mediaUrl && String(data.mediaUrl).length > MAX_MEDIA) {
                    socket.emit('chatError', 'That attachment is too large. Try a smaller image or a shorter recording.');
                    return;
                }
                if (!text && !data.mediaUrl) return;

                // Authenticate user from token
                const auth = await authenticateSocket(socket, data.token);
                if (!auth) {
                    socket.emit('chatError', 'Your session expired. Sign in again to send messages.');
                    return;
                }

                // Membership was never checked here. The JOIN GROUP button
                // was the only thing standing between any account and any
                // community, and a gate in the client is not a gate.
                const { exists, isMember } = await communityMembership(socket, roomName, auth.id);
                if (!exists) {
                    socket.emit('chatError', 'That community does not exist.');
                    return;
                }
                if (!isMember && auth.role !== 'admin') {
                    socket.emit('chatError', 'Join this community before posting in it.');
                    return;
                }

                const user = await User.findById(auth.id);
                if (!user) return;

                // Extract mentions
                const mentionRegex = /@([a-zA-Z0-9_]+)/g;
                let mentionIds: any[] = [];
                if (text) {
                    const matchUsernames: string[] = [];
                    let match;
                    // A message full of @names would otherwise be an
                    // unbounded lookup; nobody mentions twenty people.
                    while ((match = mentionRegex.exec(text)) !== null && matchUsernames.length < 20) {
                        matchUsernames.push(match[1]);
                    }
                    if (matchUsernames.length > 0) {
                        const users = await User.find({ username: { $in: matchUsernames } });
                        mentionIds = users.map(u => u._id);
                    }
                }

                const newMsg = new ChatMessage({
                    room: roomName,
                    userId: user._id,
                    username: `@${user.username}`,
                    avatarUrl: user.avatarUrl || 'default',
                    text,
                    mediaUrl: data.mediaUrl || null,
                    replyTo: data.replyTo || null,
                    mentions: mentionIds,
                    isPro: user.role === 'admin' || user.role === 'moderator'
                });

                await newMsg.save();
                
                // Populate replyTo details before broadcasting
                const populatedMsg = await ChatMessage.findById(newMsg._id)
                    .populate('replyTo', 'username text mediaUrl')
                    .lean();

                // Broadcast to everyone in the room
                // Re-reading the row can come back empty — it was deleted
                // between the write and the read, or the read failed — and
                // assigning to that null took the whole send down with a
                // generic "failed to send" that told nobody anything.
                const plainMsg = toPlainMessage(populatedMsg) ?? toPlainMessage(newMsg);
                if (!plainMsg) return;
                plainMsg.activeNft = user.activeNft || null;
                // The whole message used to be pretty-printed to the server
                // log — including a megabytes-long base64 image or voice
                // note, once per message.
                io.to(`chat_${roomName}`).emit('newMessage', plainMsg);
            } catch (error) {
                console.error('Error processing chat message:', error);
                socket.emit('chatError', 'Failed to send message. Authentication may have expired.');
            }
        });

        // ═══════════════════════════════════════════════════════════
        // DELETE MESSAGE — user can delete own, admin/mod can delete any
        // ═══════════════════════════════════════════════════════════
        socket.on('deleteMessage', async (data: { messageId: string, token: string, room: string }) => {
            const roomName = cleanRoom(data?.room);
            if (!roomName || !allow(socket, 'action')) return;
            try {
                const auth = await authenticateSocket(socket, data.token);
                if (!auth) return;

                const msg = await ChatMessage.findById(data.messageId);
                if (!msg) return;

                // The room is supplied by the caller and the permission
                // check is made against it, so a moderator of one community
                // could delete a message in another simply by naming their
                // own room alongside someone else's message id.
                if (msg.room !== roomName) return;

                // Check permission: own message OR group admin/mod OR global admin
                const isOwn = msg.userId.toString() === auth.id;
                const isAdmin = auth.role === 'admin' || auth.role === 'moderator';
                const isGroupMod = await isGroupAdmin(roomName, auth.id);

                if (!isOwn && !isAdmin && !isGroupMod) {
                    socket.emit('chatError', 'You do not have permission to delete this message.');
                    return;
                }

                await ChatMessage.findByIdAndDelete(data.messageId);
                io.to(`chat_${roomName}`).emit('messageDeleted', { messageId: data.messageId });
            } catch (err) {
                console.error('Error deleting message:', err);
            }
        });

        // ═══════════════════════════════════════════════════════════
        // LIKE TOGGLE
        // ═══════════════════════════════════════════════════════════
        socket.on('likeMessage', async (data: { messageId: string, token: string, room: string }) => {
            const roomName = cleanRoom(data?.room);
            if (!roomName || !allow(socket, 'action')) return;
            try {
                const auth = await authenticateSocket(socket, data.token);
                if (!auth) return;
                const msg = await ChatMessage.findById(data.messageId);
                if (!msg || msg.room !== roomName) return;

                const userIdObj = auth.id;
                const likeIndex = msg.likes.findIndex(id => id.toString() === userIdObj);
                
                if (likeIndex === -1) {
                    msg.likes.push(userIdObj); // Like
                } else {
                    msg.likes.splice(likeIndex, 1); // Unlike
                }
                
                await msg.save();
                io.to(`chat_${roomName}`).emit('messageUpdated', { messageId: msg._id, likes: msg.likes.length, likedBy: msg.likes });
            } catch (err) {}
        });

        // ═══════════════════════════════════════════════════════════
        // PIN MESSAGE (admin/mod only)
        // ═══════════════════════════════════════════════════════════
        socket.on('pinMessage', async (data: { messageId: string, token: string, room: string }) => {
            const roomName = cleanRoom(data?.room);
            if (!roomName || !allow(socket, 'action')) return;
            try {
                const auth = await authenticateSocket(socket, data.token);
                if (!auth) return;

                const isAdmin = auth.role === 'admin' || await isGroupAdmin(roomName, auth.id);
                if (!isAdmin) return;

                const community = await Community.findOne({ name: roomName });
                if (!community) return;

                // Pinning a message from somewhere else would put another
                // room's content at the top of this one.
                const target = await ChatMessage.findById(data.messageId).lean();
                if (!target || target.room !== roomName) return;

                community.pinnedMessageId = data.messageId as any;
                await community.save();

                io.to(`chat_${roomName}`).emit('messagePinned', target);
            } catch (err) {}
        });

        socket.on('unpinMessage', async (data: { token: string, room: string }) => {
            try {
                const auth = await authenticateSocket(socket, data.token);
                if (!auth) return;

                const isAdmin = auth.role === 'admin' || await isGroupAdmin(data.room, auth.id);
                if (!isAdmin) return;

                const community = await Community.findOne({ name: data.room });
                if (!community) return;

                community.pinnedMessageId = null as any;
                await community.save();

                io.to(`chat_${data.room}`).emit('messageUnpinned');
            } catch (err) {}
        });

        // ═══════════════════════════════════════════════════════════
        // KICK USER (admin/mod only)
        // ═══════════════════════════════════════════════════════════
        socket.on('kickUser', async (data: { targetUserId: string, token: string, room: string }) => {
            try {
                const auth = await authenticateSocket(socket, data.token);
                if (!auth) return;

                const isAdmin = auth.role === 'admin' || await isGroupAdmin(data.room, auth.id);
                if (!isAdmin) return;

                const community = await Community.findOne({ name: data.room });
                if (!community) return;

                // Prevent kicking other admins unless global admin
                if (auth.role !== 'admin') {
                    const isTargetAdmin = community.admins?.includes(data.targetUserId as any) || community.moderators?.includes(data.targetUserId as any);
                    if (isTargetAdmin) {
                        socket.emit('chatError', 'You cannot kick another admin.');
                        return;
                    }
                }

                // Remove from members
                await Community.updateOne(
                    { _id: community._id },
                    { $pull: { members: data.targetUserId } }
                );

                // Notify frontend to remove user. The kicked member's own
                // sockets are also removed from the room: telling the client
                // to leave is a request, and a removed member should not
                // keep receiving the room's messages if it ignores it.
                io.to(`chat_${data.room}`).emit('userKicked', { userId: data.targetUserId });
                for (const [, s2] of io.sockets.sockets) {
                    if ((s2.data as any)?.authCache?.auth?.id === data.targetUserId) {
                        forgetMembership(s2, data.room, data.targetUserId);
                        s2.leave(`chat_${data.room}`);
                    }
                }
                
                // Also update member count
                const updatedComm = await Community.findById(community._id);
                if (updatedComm) {
                    io.to(`chat_${data.room}`).emit('memberCountUpdate', updatedComm.members.length);
                }
            } catch (err) {}
        });

        // ═══════════════════════════════════════════════════════════
        // JOIN / LEAVE COMMUNITY
        // ═══════════════════════════════════════════════════════════
        socket.on('joinCommunity', async (data: { room: string, token: string }) => {
            try {
                const auth = await authenticateSocket(socket, data.token);
                if (!auth) return;

                const community = await Community.findOne({ name: data.room, isActive: true });
                if (!community) return;

                const memberIds = (community.members || []).map((m: any) => m && typeof m === 'object' ? (m.id || m._id) : m);
                if (!memberIds.includes(auth.id)) {
                    community.members.push(auth.id as any);
                    community.memberCount = community.members.length;
                    await community.save();
                }
                forgetMembership(socket, data.room, auth.id);
                socket.emit('joinedCommunity', { room: data.room, memberCount: community.memberCount });
                io.to(`chat_${data.room}`).emit('memberCountUpdate', community.memberCount);
            } catch (err) {}
        });

        socket.on('leaveCommunity', async (data: { room: string, token: string }) => {
            try {
                const auth = await authenticateSocket(socket, data.token);
                if (!auth) return;

                const community = await Community.findOne({ name: data.room });
                if (!community) return;

                community.members = (community.members || []).filter((m: any) => {
                    const id = m && typeof m === 'object' ? (m.id || m._id) : m;
                    return id !== auth.id;
                }) as any;
                community.memberCount = community.members.length;
                await community.save();

                forgetMembership(socket, data.room, auth.id);
                socket.leave(`chat_${data.room}`);
                socket.emit('leftCommunity', { room: data.room });
                io.to(`chat_${data.room}`).emit('memberCountUpdate', community.memberCount);
            } catch (err) {}
        });

        // ═══════════════════════════════════════════════════════════
        // ADMIN: PROMOTE / DEMOTE
        // ═══════════════════════════════════════════════════════════
        socket.on('promoteAdmin', async (data: { room: string, targetUserId: string, token: string }) => {
            try {
                const auth = await authenticateSocket(socket, data.token);
                if (!auth) return;

                // Only global admin or community creator can promote
                const community = await Community.findOne({ name: data.room });
                if (!community) return;

                const isCreator = community.createdBy?.toString() === auth.id;
                const isGlobalAdmin = auth.role === 'admin';
                if (!isCreator && !isGlobalAdmin) {
                    socket.emit('chatError', 'Only the group creator or global admin can promote admins.');
                    return;
                }

                if (!community.admins.some(id => id.toString() === data.targetUserId)) {
                    community.admins.push(data.targetUserId as any);
                    await community.save();
                }

                const targetUser = await User.findById(data.targetUserId).select('username');
                io.to(`chat_${data.room}`).emit('adminPromoted', { userId: data.targetUserId, username: targetUser?.username });
            } catch (err) {}
        });

        socket.on('demoteAdmin', async (data: { room: string, targetUserId: string, token: string }) => {
            try {
                const auth = await authenticateSocket(socket, data.token);
                if (!auth) return;

                const community = await Community.findOne({ name: data.room });
                if (!community) return;

                const isCreator = community.createdBy?.toString() === auth.id;
                const isGlobalAdmin = auth.role === 'admin';
                if (!isCreator && !isGlobalAdmin) return;

                community.admins = community.admins.filter(id => id.toString() !== data.targetUserId) as any;
                community.moderators = community.moderators.filter(id => id.toString() !== data.targetUserId) as any;
                await community.save();

                io.to(`chat_${data.room}`).emit('adminDemoted', { userId: data.targetUserId });
            } catch (err) {}
        });

        // ═══════════════════════════════════════════════════════════
        // GET MEMBERS LIST
        // ═══════════════════════════════════════════════════════════
        socket.on('getMembers', async (data: { room: string }) => {
            const roomName = cleanRoom(data?.room);
            if (!roomName || !allow(socket, 'action')) return;

            // This listed every member of any community, with usernames, to
            // anyone who could open a socket.
            const auth = await authenticateSocket(socket, connectionToken(socket));
            if (!auth) return;
            const { isMember } = await communityMembership(socket, roomName, auth.id);
            if (!isMember && auth.role !== 'admin') return;

            try {
                const community = await Community.findOne({ name: roomName, isActive: true })
                    .populate('members', 'username avatarUrl role')
                    .populate('admins', 'username avatarUrl role')
                    .lean();
                if (!community) return;

                socket.emit('membersList', {
                    members: community.members,
                    admins: community.admins,
                    moderators: community.moderators
                });
            } catch (err) {}
        });
    });
};
