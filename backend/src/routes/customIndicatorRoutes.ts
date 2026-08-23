import { Router } from 'express';
import {
    createIndicator, listIndicators, toggleIndicator, deleteIndicator, indicatorValues,
    exportIndicator, importIndicator,
} from '../controllers/customIndicatorController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.get('/', verifyToken, listIndicators);
router.post('/', verifyToken, createIndicator);
router.get('/values', verifyToken, indicatorValues);
router.post('/import', verifyToken, importIndicator);
router.get('/:id/export', verifyToken, exportIndicator);
router.post('/:id/toggle', verifyToken, toggleIndicator);
router.delete('/:id', verifyToken, deleteIndicator);

export default router;
