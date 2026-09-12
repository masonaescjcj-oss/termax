import { Server, Socket } from 'socket.io';
import { authenticateSocket } from './chatSocket';

// ═══════════════════════════════════════════════════════════════
//  TRADE SOCKET — Real-time position updates and notifications per user
// ═══════════════════════════════════════════════════════════════

let ioInstance: Server | null = null;

/**
 * The room is joined with a token, never a bare user id: the old
 * `joinUserRoom(userId)` let any connected client subscribe to any other
 * trader's fills, closes and stop-outs by guessing an id.
 */
async function join(socket: Socket, payload: any): Promise<void> {
    const token = typeof payload === 'string' ? '' : String(payload?.token || '');
    const auth = await authenticateSocket(socket, token);
    if (!auth) {
        socket.emit('userRoomError', { message: 'A valid session token is required.' });
        return;
    }
    const prev = (socket.data as any).userRoom as string | undefined;
    if (prev && prev !== auth.id) socket.leave(`user:${prev}`);
    (socket.data as any).userRoom = auth.id;
    socket.join(`user:${auth.id}`);
    socket.emit('userRoomJoined', { userId: auth.id });
}

export function setupTradeSockets(io: Server) {
    ioInstance = io;

    io.on('connection', (socket) => {
        // A token in the handshake joins immediately; otherwise the client
        // sends { token } on `joinUserRoom`.
        const handshakeToken = String((socket.handshake.auth as any)?.token || '');
        if (handshakeToken) void join(socket, { token: handshakeToken });

        socket.on('joinUserRoom', (payload: any) => { void join(socket, payload); });

        socket.on('leaveUserRoom', () => {
            const prev = (socket.data as any).userRoom as string | undefined;
            if (prev) socket.leave(`user:${prev}`);
            (socket.data as any).userRoom = undefined;
        });
    });
}

// Called by the trade controller after open/close/modify, and by notify().
export function emitPositionUpdate(userId: string, event: string, data: any) {
    if (ioInstance) {
        ioInstance.to(`user:${userId}`).emit(event, data);
    }
}
