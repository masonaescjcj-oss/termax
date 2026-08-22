import { Router } from 'express';
import { createBacktest, listBacktests, getBacktest, deleteBacktest } from '../controllers/backtestController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.get('/', verifyToken, listBacktests);
router.post('/', verifyToken, createBacktest);
router.get('/:id', verifyToken, getBacktest);
router.delete('/:id', verifyToken, deleteBacktest);

export default router;
