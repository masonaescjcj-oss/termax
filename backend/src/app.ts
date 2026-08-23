import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import marketRoutes from './routes/marketRoutes';
import aiRoutes from './routes/aiRoutes';
import tradeRoutes from './routes/tradeRoutes';
import toolsRoutes from './routes/toolsRoutes';
import authRoutes from './routes/authRoutes';
import brokerRoutes from './routes/brokerRoutes';
import adminRoutes from './routes/adminRoutes';
import communityRoutes from './routes/communityRoutes';
import campaignRoutes from './routes/campaignRoutes';
import botRoutes from './routes/botRoutes';
import backtestRoutes from './routes/backtestRoutes';
import insightRoutes from './routes/insightRoutes';
import customIndicatorRoutes from './routes/customIndicatorRoutes';
import libraryRoutes from './routes/libraryRoutes';

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    console.log(`[HTTP] ${req.method} ${req.url} - Started`);
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        console.log(`[HTTP Body]`, JSON.stringify(req.body, null, 2));
    }
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[HTTP] ${req.method} ${req.url} - Response: ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// Serve static files (like uploaded images)
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Health Check Route
app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'OK', message: 'Server is running healthily' });
});

// APIs
app.use('/api/v1/market', marketRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/trade', tradeRoutes);
app.use('/api/v1/tools', toolsRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/brokers', brokerRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/communities', communityRoutes);
app.use('/api/v1/campaigns', campaignRoutes);
app.use('/api/v1/bots', botRoutes);
app.use('/api/v1/backtests', backtestRoutes);
app.use('/api/v1/insights', insightRoutes);
app.use('/api/v1/indicators', customIndicatorRoutes);
app.use('/api/v1/library', libraryRoutes);

// Basic Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

export default app;
