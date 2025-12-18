import express from 'express';
import { getUserGoals, updateUserGoals } from '../controllers/usersController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/goals', authenticateToken, getUserGoals);
router.put('/goals', authenticateToken, updateUserGoals);

export default router;