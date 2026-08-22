import { Router } from 'express';
import { getHeatmap, getAnalysis, getCalendar, getAnalytics, getSmcData, getMtfData, getLiquidityMap, getAiInsight } from '../controllers/toolsController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.get('/heatmap', getHeatmap);
router.get('/analysis', getAnalysis);
router.get('/calendar', getCalendar);
router.get('/analytics', verifyToken, getAnalytics);
router.get('/smc', getSmcData);
router.get('/mtf', getMtfData);
router.get('/liquidity-map', getLiquidityMap);
router.get('/insight/:symbol', getAiInsight);

export default router;
