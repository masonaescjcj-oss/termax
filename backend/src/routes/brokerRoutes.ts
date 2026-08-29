import { Router } from 'express';
import { getBrokers, getBrokerById, addReview, getBrokerReviews, initMockBrokers } from '../controllers/brokerController';
import { verifyToken, requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', getBrokers);
// Seeding the broker directory is an admin action: it writes to the table
// the whole broker section reads from.
router.post('/init', verifyToken, requireAdmin, initMockBrokers);
router.get('/:id', getBrokerById);
router.post('/:id/reviews', verifyToken, addReview);
router.get('/:id/reviews', getBrokerReviews);

export default router;
