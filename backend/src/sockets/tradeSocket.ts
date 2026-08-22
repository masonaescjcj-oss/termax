import { Server } from 'socket.io';

// ═══════════════════════════════════════════════════════════════
//  TRADE SOCKET — Real-time position updates per user
// ═══════════════════════════════════════════════════════════════

let ioInstance: Server | null = null;

export function setupTradeSockets(io: Server) {
    ioInstance = io;

    io.on('connection', (socket) => {
        // Client joins their own user room for private position updates
        socket.on('joinUserRoom', (userId: string) => {
            if (userId) {
                socket.join(`user:${userId}`);
                console.log(`📊 User ${userId} joined trade room`);
            }
        });

        socket.on('leaveUserRoom', (userId: string) => {
            if (userId) {
                socket.leave(`user:${userId}`);
            }
        });
    });
}

// Called by trade controller after open/close/modify
export function emitPositionUpdate(userId: string, event: string, data: any) {
    if (ioInstance) {
        ioInstance.to(`user:${userId}`).emit(event, data);
    }
}
