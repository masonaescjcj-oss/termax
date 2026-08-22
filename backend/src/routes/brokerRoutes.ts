import { Router } from 'express';
import { getBrokers, getBrokerById, addReview, getBrokerReviews, initMockBrokers } from '../controllers/brokerController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.get('/', getBrokers);
router.post('/init', initMockBrokers); // Temp route to seed DB
router.get('/:id', getBrokerById);
router.post('/:id/reviews', verifyToken, addReview);
router.get('/:id/reviews', getBrokerReviews);

export default router;
