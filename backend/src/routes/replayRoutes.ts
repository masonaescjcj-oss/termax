import { Router } from 'express';
import { startReplay } from '../controllers/replayController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.post('/', verifyToken, startReplay);

export default router;
