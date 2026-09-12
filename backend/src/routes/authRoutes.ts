import { Router } from 'express';
import { register, login, refreshToken, getMe, updateMe, checkUsername, connectBroker, deactivateAccount, authConfig, resendVerification, forgotPassword } from '../controllers/authController';
import { uploadImage } from '../controllers/adminController';
import { verifyToken, verifyTokenPendingMfa } from '../middleware/auth';

import { getFactors, removeFactor, startEnrollment, verifyFactor } from '../controllers/mfaController';

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
// Two-factor. The first two accept a first-factor session, because
// finishing the sign-in is exactly what they are for.
router.get('/mfa', verifyTokenPendingMfa, getFactors);
router.post('/mfa/verify', verifyTokenPendingMfa, verifyFactor);
router.post('/mfa/enroll', verifyToken, startEnrollment);
router.delete('/mfa/:factorId', verifyToken, removeFactor);

router.get('/me', verifyToken, getMe);
router.put('/me', verifyToken, updateMe);
router.post('/connect-broker', verifyToken, connectBroker);
router.post('/upload', verifyToken, uploadImage);
router.post('/deactivate', verifyToken, deactivateAccount);

export default router;
