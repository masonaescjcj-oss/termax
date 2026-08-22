import { Router } from 'express';
import { verifyToken, requireAdmin } from '../middleware/auth';
import {
    getStats,
    getUsers, updateUserRole,
    addBroker, deleteBroker, listBrokers, editBroker,
    createCommunity, deleteCommunity, listCommunities, addCommunityModerator, editCommunity, assignCommunityAdmin,
    createPromotedSymbol, editPromotedSymbol, deletePromotedSymbol, listPromotedSymbols, togglePinSymbol,
    getPendingReviews, approveReview, deleteReview,
    uploadImage,
    listLotties, uploadLottie, deleteLottie,
    getAIConfig, updateAIConfig
} from '../controllers/adminController';

const router = Router();

// All admin routes require auth + admin role
router.use(verifyToken, requireAdmin);

// Upload
router.post('/upload', uploadImage);

// Dashboard
router.get('/stats', getStats);

// Users
router.get('/users', getUsers);
router.post('/users/role', updateUserRole);

// Brokers
router.get('/brokers', listBrokers);
router.post('/brokers', addBroker);
router.put('/brokers/:id', editBroker);
router.delete('/brokers/:id', deleteBroker);

// Communities
router.get('/communities', listCommunities);
router.post('/communities', createCommunity);
router.put('/communities/:id', editCommunity);
router.delete('/communities/:id', deleteCommunity);
router.post('/communities/moderator', addCommunityModerator);
router.post('/communities/:id/admins', assignCommunityAdmin);

// Promoted Symbols
router.get('/symbols', listPromotedSymbols);
router.post('/symbols', createPromotedSymbol);
router.put('/symbols/:id', editPromotedSymbol);
router.delete('/symbols/:id', deletePromotedSymbol);
router.post('/symbols/:id/pin', togglePinSymbol);

// Reviews
router.get('/reviews', getPendingReviews);
router.post('/reviews/:id/approve', approveReview);
router.delete('/reviews/:id', deleteReview);

// Lotties / Emoji NFTs
router.get('/lotties', listLotties);
router.post('/lotties/upload', uploadLottie);
router.delete('/lotties/:key', deleteLottie);

// AI Config
router.get('/ai-config', getAIConfig);
router.post('/ai-config', updateAIConfig);

export default router;
