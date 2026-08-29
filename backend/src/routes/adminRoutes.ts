import { Router } from 'express';
import { verifyToken, requireAdmin } from '../middleware/auth';
import {
    getStats,
    getUsers, updateUserRole, updateUserPlan,
    addBroker, deleteBroker, listBrokers, editBroker,
    createCommunity, deleteCommunity, listCommunities, addCommunityModerator, editCommunity, assignCommunityAdmin,
    createPromotedSymbol, editPromotedSymbol, deletePromotedSymbol, listPromotedSymbols, togglePinSymbol,
    getPendingReviews, approveReview, deleteReview,
    uploadImage,
    listLotties, uploadLottie, deleteLottie,
    getAIConfig, updateAIConfig,
    searchUsers, getUserDetail, setUserActive, setAccountBalance,
    listOpenPositions, adminClosePosition,
    listAllReviews, listAllBrokers, restoreBroker,
    getAuditLog
} from '../controllers/adminController';

const router = Router();

// All admin routes require auth + admin role
router.use(verifyToken, requireAdmin);

// Upload
router.post('/upload', uploadImage);

// Dashboard
router.get('/stats', getStats);

// Users
router.get('/users', getUsers);                 // legacy: newest 100, no search
router.get('/users/search', searchUsers);       // paged + searchable
router.get('/users/:id', getUserDetail);
router.post('/users/role', updateUserRole);
router.post('/users/plan', updateUserPlan);
router.post('/users/active', setUserActive);
router.post('/users/balance', setAccountBalance);

// Positions
router.get('/positions', listOpenPositions);
router.post('/positions/:id/close', adminClosePosition);

// Brokers
router.get('/brokers', listBrokers);
router.get('/brokers/all', listAllBrokers);     // ?includeInactive=1
router.post('/brokers/:id/restore', restoreBroker);
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
router.get('/reviews/all', listAllReviews);     // ?scope=pending|approved|all
router.post('/reviews/:id/approve', approveReview);
router.delete('/reviews/:id', deleteReview);

// Lotties / Emoji NFTs
router.get('/lotties', listLotties);
router.post('/lotties/upload', uploadLottie);
router.delete('/lotties/:key', deleteLottie);

// Audit trail
router.get('/audit', getAuditLog);

// AI Config
router.get('/ai-config', getAIConfig);
router.post('/ai-config', updateAIConfig);

export default router;
