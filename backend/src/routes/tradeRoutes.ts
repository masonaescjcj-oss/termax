import { Router } from 'express';
import { executeOrder, getPositions, closePosition, modifyPosition, getAuth, authCallback, calculateLotSize, addAdvancedRule } from '../controllers/tradeController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.get('/auth', getAuth);
router.get('/callback', authCallback);
router.get('/positions', verifyToken, getPositions);
router.post('/execute', verifyToken, executeOrder);
router.post('/close', verifyToken, closePosition);
router.post('/modify', verifyToken, modifyPosition);
router.post('/calculate-lot', verifyToken, calculateLotSize);
router.post('/advanced-manager', verifyToken, addAdvancedRule);

export default router;
