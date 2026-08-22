import { Router } from 'express';
import { getTradeDna, getTradeAutopsy, getPreTradeCheck } from '../controllers/insightsController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.get('/dna', verifyToken, getTradeDna);
router.get('/autopsy/:positionId', verifyToken, getTradeAutopsy);
router.get('/pre-trade', verifyToken, getPreTradeCheck);

export default router;
