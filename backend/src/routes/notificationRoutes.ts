import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { listNotifications, markNotificationsRead, registerPushToken, removePushToken } from '../controllers/alertsController';

const router = Router();

router.get('/', verifyToken, listNotifications);
router.post('/read', verifyToken, markNotificationsRead);
router.post('/push-token', verifyToken, registerPushToken);
router.delete('/push-token', verifyToken, removePushToken);

export default router;
