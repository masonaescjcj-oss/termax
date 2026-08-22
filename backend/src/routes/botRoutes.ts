import { Router } from 'express';
import { createBot, listBots, startBot, stopBot, deleteBot } from '../controllers/botsController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.get('/', verifyToken, listBots);
router.post('/', verifyToken, createBot);
router.post('/:id/start', verifyToken, startBot);
router.post('/:id/stop', verifyToken, stopBot);
router.delete('/:id', verifyToken, deleteBot);

export default router;
