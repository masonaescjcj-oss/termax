import { Router } from 'express';
import { executeOrder, getPositions, closePosition, modifyPosition, getAuth, authCallback, calculateLotSize, addAdvancedRule } from '../controllers/tradeController';
import { verifyToken } from '../middleware/auth';

const router = Router();

// Requires a signed-in user: the consent URL embeds a state parameter bound
// to them, which is what /callback verifies on the way back.
router.get('/auth', verifyToken, getAuth);
// The broker redirects the user's browser here, so it cannot carry our JWT.
// Authorisation comes from the signed single-use state parameter instead.
router.get('/callback', authCallback);
router.get('/positions', verifyToken, getPositions);
router.post('/execute', verifyToken, executeOrder);
router.post('/close', verifyToken, closePosition);
router.post('/modify', verifyToken, modifyPosition);
router.post('/calculate-lot', verifyToken, calculateLotSize);
router.post('/advanced-manager', verifyToken, addAdvancedRule);

export default router;
