import { Server, Socket } from 'socket.io';
import ChatMessage from '../models/ChatMessage';
import Community from '../models/Community';
import User from '../models/User';
import { supabase } from '../config/supabase';

// Helper: verify token and return user id + role
const authenticateSocket = async (token: string): Promise<{ id: string; username: string; role: string } | null> => {
    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return null;

        const dbUser = await User.findById(user.id);
        if (!dbUser) return null;

        return {
            id: dbUser.id || dbUser._id || user.id,
            username: dbUser.username || user.user_metadata?.username || 'user',
            role: dbUser.role || 'user'
        };
    } catch (err) {
        console.error('Socket authentication error:', err);
        return null;
    }
};

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
        socket.on('joinChat', async (room: string) => {
            socket.join(`chat_${room}`);
            console.log(`💬 Client ${socket.id} joined chat: ${room}`);

            try {
                // Send last 50 messages to the user who just joined
                const messages = await ChatMessage.find({ room })
                    .sort({ createdAt: -1 })
                    .limit(50)
                    .populate('replyTo', 'username text mediaUrl')
                    .lean();
                
                const plainMessages = (Array.isArray(messages) ? messages : []).map(toPlainMessage);
                const userIds = Array.from(new Set(plainMessages.map(m => m.userId).filter(Boolean)));
                const users = await User.find({ _id: { $in: userIds } });
                const userNftMap = new Map(users.map(u => [u.id || u._id, u.activeNft]));
                plainMessages.forEach(m => {
                    m.activeNft = userNftMap.get(m.userId) || null;
                });
                socket.emit('chatHistory', plainMessages.reverse());

                // Send community info (admins, members count)
                const community = await Community.findOne({ name: room, isActive: true })
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
            try {
                const anchorMsg = await ChatMessage.findById(data.beforeId).lean();
                if (!anchorMsg) return;

                const olderMessages = await ChatMessage.find({ 
                    room: data.room, 
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
            try {
                const auth = await authenticateSocket(data.token);
                if (!auth) return;
                socket.to(`chat_${data.room}`).emit('userTyping', { username: auth.username });
            } catch {}
        });

        // Handle incoming chat message
        socket.on('sendMessage', async (data: { room: string, text?: string, mediaUrl?: string, replyTo?: string, token: string }) => {
            console.log('[ChatSocket] Received sendMessage event:', { room: data.room, text: data.text, replyTo: data.replyTo, hasToken: !!data.token });
            try {
                if ((!data.text && !data.mediaUrl) || !data.room || !data.token) {
                    console.log('[ChatSocket] Validation failed. Missing text/media or room or token.', { hasText: !!data.text, hasMedia: !!data.mediaUrl, room: data.room, hasToken: !!data.token });
                    return;
                }

                // Authenticate user from token
                const auth = await authenticateSocket(data.token);
                if (!auth) {
                    console.log('[ChatSocket] Authentication failed for token');
                    socket.emit('chatError', 'Failed to send message. Authentication may have expired.');
                    return;
                }
                const user = await User.findById(auth.id);
                if (!user) {
                    console.log('[ChatSocket] User profile not found in database for authenticated ID:', auth.id);
                    return;
                }

                // Extract mentions
                const mentionRegex = /@([a-zA-Z0-9_]+)/g;
                let mentionIds: any[] = [];
                if (data.text) {
                    const matchUsernames: string[] = [];
                    let match;
                    while ((match = mentionRegex.exec(data.text)) !== null) {
                        matchUsernames.push(match[1]);
                    }
                    if (matchUsernames.length > 0) {
                        const users = await User.find({ username: { $in: matchUsernames } });
                        mentionIds = users.map(u => u._id);
                    }
                }

                const newMsg = new ChatMessage({
                    room: data.room,
                    userId: user._id,
                    username: `@${user.username}`,
                    avatarUrl: user.avatarUrl || 'default',
                    text: data.text ? data.text.trim() : '',
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
                const plainMsg = toPlainMessage(populatedMsg);
                plainMsg.activeNft = user.activeNft || null;
                console.log('[Chat] Broadcasting newMessage:', JSON.stringify(plainMsg, null, 2));
                io.to(`chat_${data.room}`).emit('newMessage', plainMsg);
            } catch (error) {
                console.error('Error processing chat message:', error);
                socket.emit('chatError', 'Failed to send message. Authentication may have expired.');
            }
        });

        // ═══════════════════════════════════════════════════════════
        // DELETE MESSAGE — user can delete own, admin/mod can delete any
        // ═══════════════════════════════════════════════════════════
        socket.on('deleteMessage', async (data: { messageId: string, token: string, room: string }) => {
            try {
                const auth = await authenticateSocket(data.token);
                if (!auth) return;

                const msg = await ChatMessage.findById(data.messageId);
                if (!msg) return;

                // Check permission: own message OR group admin/mod OR global admin
                const isOwn = msg.userId.toString() === auth.id;
                const isAdmin = auth.role === 'admin' || auth.role === 'moderator';
                const isGroupMod = await isGroupAdmin(data.room, auth.id);

                if (!isOwn && !isAdmin && !isGroupMod) {
                    socket.emit('chatError', 'You do not have permission to delete this message.');
                    return;
                }

                await ChatMessage.findByIdAndDelete(data.messageId);
                io.to(`chat_${data.room}`).emit('messageDeleted', { messageId: data.messageId });
            } catch (err) {
                console.error('Error deleting message:', err);
            }
        });

        // ═══════════════════════════════════════════════════════════
        // LIKE TOGGLE
        // ═══════════════════════════════════════════════════════════
        socket.on('likeMessage', async (data: { messageId: string, token: string, room: string }) => {
            try {
                const auth = await authenticateSocket(data.token);
                if (!auth) return;
                const msg = await ChatMessage.findById(data.messageId);
                if (!msg) return;

                const userIdObj = auth.id;
                const likeIndex = msg.likes.findIndex(id => id.toString() === userIdObj);
                
                if (likeIndex === -1) {
                    msg.likes.push(userIdObj); // Like
                } else {
                    msg.likes.splice(likeIndex, 1); // Unlike
                }
                
                await msg.save();
                io.to(`chat_${data.room}`).emit('messageUpdated', { messageId: msg._id, likes: msg.likes.length, likedBy: msg.likes });
            } catch (err) {}
        });

        // ═══════════════════════════════════════════════════════════
        // PIN MESSAGE (admin/mod only)
        // ═══════════════════════════════════════════════════════════
        socket.on('pinMessage', async (data: { messageId: string, token: string, room: string }) => {
            try {
                const auth = await authenticateSocket(data.token);
                if (!auth) return;

                const isAdmin = auth.role === 'admin' || await isGroupAdmin(data.room, auth.id);
                if (!isAdmin) return;

                const community = await Community.findOne({ name: data.room });
                if (!community) return;

                community.pinnedMessageId = data.messageId as any;
                await community.save();

                const pinnedMsg = await ChatMessage.findById(data.messageId).lean();
                io.to(`chat_${data.room}`).emit('messagePinned', pinnedMsg);
            } catch (err) {}
        });

        socket.on('unpinMessage', async (data: { token: string, room: string }) => {
            try {
                const auth = await authenticateSocket(data.token);
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
                const auth = await authenticateSocket(data.token);
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

                // Notify frontend to remove user
                io.to(`chat_${data.room}`).emit('userKicked', { userId: data.targetUserId });
                
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
                const auth = await authenticateSocket(data.token);
                if (!auth) return;

                const community = await Community.findOne({ name: data.room, isActive: true });
                if (!community) return;

                const memberIds = (community.members || []).map((m: any) => m && typeof m === 'object' ? (m.id || m._id) : m);
                if (!memberIds.includes(auth.id)) {
                    community.members.push(auth.id as any);
                    community.memberCount = community.members.length;
                    await community.save();
                }
                socket.emit('joinedCommunity', { room: data.room, memberCount: community.memberCount });
                io.to(`chat_${data.room}`).emit('memberCountUpdate', community.memberCount);
            } catch (err) {}
        });

        socket.on('leaveCommunity', async (data: { room: string, token: string }) => {
            try {
                const auth = await authenticateSocket(data.token);
                if (!auth) return;

                const community = await Community.findOne({ name: data.room });
                if (!community) return;

                community.members = (community.members || []).filter((m: any) => {
                    const id = m && typeof m === 'object' ? (m.id || m._id) : m;
                    return id !== auth.id;
                }) as any;
                community.memberCount = community.members.length;
                await community.save();

                socket.emit('leftCommunity', { room: data.room });
                io.to(`chat_${data.room}`).emit('memberCountUpdate', community.memberCount);
            } catch (err) {}
        });

        // ═══════════════════════════════════════════════════════════
        // ADMIN: PROMOTE / DEMOTE
        // ═══════════════════════════════════════════════════════════
        socket.on('promoteAdmin', async (data: { room: string, targetUserId: string, token: string }) => {
            try {
                const auth = await authenticateSocket(data.token);
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
                const auth = await authenticateSocket(data.token);
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
            try {
                const community = await Community.findOne({ name: data.room, isActive: true })
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
