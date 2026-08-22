import { Router } from 'express';
import { chatWithMaxAI, getAIUsage } from '../controllers/aiController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.post('/chat', verifyToken, chatWithMaxAI);
router.get('/usage', verifyToken, getAIUsage);

export default router;
