import { Router } from 'express';
import { chatWithMaxAI, getAIUsage, getPlans } from '../controllers/aiController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.post('/chat', verifyToken, chatWithMaxAI);
router.get('/usage', verifyToken, getAIUsage);
router.get('/plans', verifyToken, getPlans);

export default router;
