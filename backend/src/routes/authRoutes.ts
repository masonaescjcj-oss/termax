import { Router } from 'express';
import { register, login, refreshToken, getMe, updateMe, checkUsername, connectBroker, deactivateAccount } from '../controllers/authController';
import { uploadImage } from '../controllers/adminController';
import { verifyToken } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/check-username', checkUsername);

// Protected routes (require JWT)
router.get('/me', verifyToken, getMe);
router.put('/me', verifyToken, updateMe);
router.post('/connect-broker', verifyToken, connectBroker);
router.post('/upload', verifyToken, uploadImage);
router.post('/deactivate', verifyToken, deactivateAccount);

export default router;
