import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { clearTriggeredAlerts, createAlert, deleteAlert, listAlerts, rearmAlert } from '../controllers/alertsController';

const router = Router();

router.get('/', verifyToken, listAlerts);
router.post('/', verifyToken, createAlert);
router.delete('/triggered', verifyToken, clearTriggeredAlerts);
router.delete('/:id', verifyToken, deleteAlert);
router.post('/:id/rearm', verifyToken, rearmAlert);

export default router;
