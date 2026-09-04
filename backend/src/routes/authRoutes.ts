import { Router } from 'express';
import { register, login, refreshToken, getMe, updateMe, checkUsername, connectBroker, deactivateAccount, authConfig, resendVerification, forgotPassword } from '../controllers/authController';
import { uploadImage } from '../controllers/adminController';
import { verifyToken } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/config', authConfig);              // which sign-up flow the client should show
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/check-username', checkUsername);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', forgotPassword);

// Protected routes (require JWT)
router.get('/me', verifyToken, getMe);
router.put('/me', verifyToken, updateMe);
router.post('/connect-broker', verifyToken, connectBroker);
router.post('/upload', verifyToken, uploadImage);
router.post('/deactivate', verifyToken, deactivateAccount);

export default router;
