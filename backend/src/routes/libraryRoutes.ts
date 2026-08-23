import { Router } from 'express';
import { publishStrategy, listLibrary, cloneStrategy, unpublishStrategy } from '../controllers/libraryController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.get('/', verifyToken, listLibrary);
router.post('/publish', verifyToken, publishStrategy);
router.post('/:id/clone', verifyToken, cloneStrategy);
router.delete('/:id', verifyToken, unpublishStrategy);

export default router;
