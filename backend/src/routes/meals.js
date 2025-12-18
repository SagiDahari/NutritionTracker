import express from 'express'
import { getMealsByDate, getMealById, logFood, deleteFood, deleteMeal } from '../controllers/mealsController.js'
import { authenticateToken } from '../middleware/auth.js'

const router = express.Router();

router.get('/:mealDate', authenticateToken, getMealsByDate);
router.get('/meal/:id', authenticateToken, getMealById); // API route
router.post('/log-food', authenticateToken, logFood);
router.delete('/delete-food/:mealId/:fdcId', authenticateToken, deleteFood);
router.delete('/delete-meal/:mealId', authenticateToken, deleteMeal); // Might be a redundant route.

export default router;