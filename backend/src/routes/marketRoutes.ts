import { Router } from 'express';
import { getCandles, getPromotedSymbols, getPrices } from '../controllers/marketController';

const router = Router();

router.get('/prices', getPrices);
router.get('/candles/:symbol', getCandles);
router.get('/promoted', getPromotedSymbols);

export default router;
