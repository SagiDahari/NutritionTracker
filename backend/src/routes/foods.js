import express from 'express'
import { searchFood, getFood } from '../controllers/foodsController.js'

const router = express.Router();

router.get('/search', searchFood);
router.get('/:fdcId', getFood);

export default router;
