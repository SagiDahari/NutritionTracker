import axios from 'axios';
import { getOrCacheFood } from '../utils/foodCache.js';

const URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

export const searchFood = async (req, res) => {
  try {
    const { food } = req.query;

    if (!food) {
      return res.status(400).json({ error: "Query parameter is required" });
    }

    const response = await axios.get(URL, {
      headers: {
        'x-api-key': process.env.API_KEY
      },
      params: {
        query: food,
      }
    });

    const result = response.data;
    const foodsList = [];

    for (let food of result.foods) {
      let nutrients = {};

      for (let nutrient of food.foodNutrients) {
        if ([1008, 1005, 1004, 1003].includes(nutrient.nutrientId)) {
          if (!nutrients[nutrient.nutrientName]) {
            nutrients[nutrient.nutrientName] = nutrient.value;
          }
        }
      }

      const foodData = {
        fdcId: food.fdcId,
        description: food.description,
        brandName: food.brandName || '',
        foodNutrients: nutrients,
      };

      foodsList.push(foodData);
    }

    res.json(foodsList);
  } catch (error) {
    console.error('Search food error:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

export const getFood = async (req, res) => {
  try {
    const { fdcId } = req.params;

    const food = await getOrCacheFood(fdcId);
    res.json(food);
  } catch (error) {
    console.error('Get food error:', error);
    res.status(500).json({ error: "Failed to fetch food data" });
  }
};