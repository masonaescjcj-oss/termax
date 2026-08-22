import { Router } from 'express';
import { createBot, listBots, startBot, stopBot, deleteBot, getBotReport, goLiveBot, buildBot } from '../controllers/botsController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.get('/', verifyToken, listBots);
router.post('/', verifyToken, createBot);
router.post('/build', verifyToken, buildBot);
router.post('/:id/start', verifyToken, startBot);
router.post('/:id/stop', verifyToken, stopBot);
router.get('/:id/report', verifyToken, getBotReport);
router.post('/:id/go-live', verifyToken, goLiveBot);
router.delete('/:id', verifyToken, deleteBot);

export default router;
