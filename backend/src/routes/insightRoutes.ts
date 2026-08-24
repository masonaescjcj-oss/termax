import { Router } from 'express';
import { getTradeDna, getTradeAutopsy, getPreTradeCheck, getRiskGuard, updateRiskGuard, getWeeklyDigest, getPortfolio } from '../controllers/insightsController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.get('/dna', verifyToken, getTradeDna);
router.get('/autopsy/:positionId', verifyToken, getTradeAutopsy);
router.get('/pre-trade', verifyToken, getPreTradeCheck);
router.get('/digest', verifyToken, getWeeklyDigest);
router.get('/portfolio', verifyToken, getPortfolio);
router.get('/risk-guard', verifyToken, getRiskGuard);
router.post('/risk-guard', verifyToken, updateRiskGuard);

export default router;
