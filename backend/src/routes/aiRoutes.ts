import { Router } from 'express';
import { chatWithMaxAI } from '../controllers/aiController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.post('/chat', verifyToken, chatWithMaxAI);

export default router;
