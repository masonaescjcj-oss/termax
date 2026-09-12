import { Router } from 'express';
import { getCandles, getPromotedSymbols, getPrices, getScreener, getMarketSentiment } from '../controllers/marketController';

const router = Router();

router.get('/prices', getPrices);
router.get('/candles/:symbol', getCandles);
router.get('/promoted', getPromotedSymbols);
router.get('/screener', getScreener);
router.get('/sentiment', getMarketSentiment);

export default router;
