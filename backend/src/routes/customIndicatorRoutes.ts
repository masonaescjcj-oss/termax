import { Router } from 'express';
import {
    createIndicator, listIndicators, toggleIndicator, deleteIndicator, indicatorValues,
} from '../controllers/customIndicatorController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.get('/', verifyToken, listIndicators);
router.post('/', verifyToken, createIndicator);
router.get('/values', verifyToken, indicatorValues);
router.post('/:id/toggle', verifyToken, toggleIndicator);
router.delete('/:id', verifyToken, deleteIndicator);

export default router;
