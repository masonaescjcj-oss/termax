import { Router } from 'express';
import { verifyToken, requireAdmin } from '../middleware/auth';
import {
    getCampaigns,
    joinCampaign,
    verifyCampaignTasks,
    completeClientTask,
    claimReward,
    adminListCampaigns,
    adminCreateCampaign,
    adminUpdateCampaign,
    adminDeleteCampaign
} from '../controllers/campaignController';

const router = Router();

// User endpoints
router.get('/', verifyToken, getCampaigns);
router.post('/:id/join', verifyToken, joinCampaign);
router.post('/:id/verify', verifyToken, verifyCampaignTasks);
router.post('/:id/complete-task', verifyToken, completeClientTask);
router.post('/:id/claim', verifyToken, claimReward);

// Admin endpoints
router.get('/admin/list', verifyToken, requireAdmin, adminListCampaigns);
router.post('/admin/create', verifyToken, requireAdmin, adminCreateCampaign);
router.put('/admin/:id', verifyToken, requireAdmin, adminUpdateCampaign);
router.delete('/admin/:id', verifyToken, requireAdmin, adminDeleteCampaign);

export default router;
