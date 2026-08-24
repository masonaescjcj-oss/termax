import { Router } from 'express';
import {
    getJournalMonth, getJournalDay, saveJournalNote, deleteJournalNote, getJournalCard,
} from '../controllers/journalController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.get('/month', verifyToken, getJournalMonth);
router.get('/day', verifyToken, getJournalDay);
router.get('/card', verifyToken, getJournalCard);
router.post('/note/:positionId', verifyToken, saveJournalNote);
router.delete('/note/:positionId', verifyToken, deleteJournalNote);

export default router;
