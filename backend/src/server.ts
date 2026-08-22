import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { supabase } from './config/supabase';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupMarketSockets } from './sockets/marketSocket';
import { setupChatSockets } from './sockets/chatSocket';
import { setupTradeSockets } from './sockets/tradeSocket';
import { initTradingEngine } from './controllers/tradeController';
import { initBot } from './bot';
import { seedCampaigns } from './controllers/campaignController';
import { initVenues } from './services/venues';
import { botRunner } from './services/bots/runner';
import { feedRouter } from './services/feeds';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        // Create HTTP server
        const httpServer = createServer(app);

        // Initialize Socket.io
        const io = new Server(httpServer, {
            cors: {
                origin: '*', // Customize in production
                methods: ['GET', 'POST']
            }
        });

        // Setup market sockets
        setupMarketSockets(io);
        
        // Setup chat sockets
        setupChatSockets(io);

        // Setup trade sockets (real-time position updates)
        setupTradeSockets(io);

        // Start server IMMEDIATELY (non-blocking)
        httpServer.listen(Number(PORT), '0.0.0.0', () => {
            console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
        });

        // Background non-blocking initializations
        setTimeout(async () => {
            try {
                const { error } = await supabase.from('users').select('id').limit(1);
                if (error && error.code !== 'PGRST116') {
                    console.warn('⚠️ Supabase tables/schema notice:', error.message);
                } else {
                    console.log('✅ Connected to Supabase!');
                }
            } catch (e: any) {
                console.log('Supabase check notice:', e.message);
            }

            try {
                await seedCampaigns();
            } catch (e: any) {
                console.log('Seed campaigns notice:', e.message);
            }

            try {
                await initTradingEngine();
            } catch (e: any) {
                console.log('Trading engine init notice:', e.message);
            }

            try {
                // After the feeds, so the live venue can share the broker's
                // authenticated connection rather than opening a second one.
                initVenues();
            } catch (e: any) {
                console.log('Venue init notice:', e.message);
            }

            try {
                // Bots resume their forward tests. The feed hook makes each
                // registered bot's symbol stream even when no client watches
                // its chart — a bot is a subscriber in its own right.
                botRunner.setFeedHook((symbol) => {
                    feedRouter.subscribe([symbol]).catch((e: any) =>
                        console.warn(`[Feed] Could not subscribe ${symbol} for bots:`, e.message));
                });
                await botRunner.loadActive();
            } catch (e: any) {
                console.log('Bot runner notice:', e.message);
            }

            try {
                initBot();
            } catch (e: any) {
                console.log('Bot init notice:', e.message);
            }
        }, 100);

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
