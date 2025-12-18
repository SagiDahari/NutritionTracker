import axios from 'axios'
import { db } from '../config/database.js'

export async function getFoodFromCache(fdcId) {
  const result = await db.query('SELECT * FROM food_cache WHERE fdc_id = $1'
    , [fdcId]);

  if (result.rows.length === 0) return null;

  const foodNutrients = await db.query('SELECT nutrient_name, value, unit_name FROM food_nutrients WHERE food_id = $1'
    , [fdcId])

  return {
    ...result.rows[0],
    foodNutrients: foodNutrients.rows
  }
}

export async function addFoodToCache(food) {
  await db.query(
    'INSERT INTO food_cache (fdc_id, description, brand_name, serving_size_unit, serving_size, has_real_serving) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (fdc_id) DO NOTHING'
    , [food.fdcId,
    food.description,
    food.brandName || null,
    food.servingSizeUnit,
    food.servingSize,
    food.hasRealServing
    ]
  );

  for (let nutrient of food.foodNutrients) {
    await db.query('INSERT INTO food_nutrients (food_id, nutrient_name, value, unit_name) VALUES ($1, $2, $3, $4)'
      , [
        food.fdcId,
        nutrient.nutrientName,
        nutrient.value,
        nutrient.unitName
      ]
    )
  }

}

export async function getOrCacheFood(fdcId) {
  // 1. Try cache first
    let cachedFood = await getFoodFromCache(fdcId);
    if (cachedFood) {
      return { source: "cache", data: cachedFood };
    }
    // 2. Fetch from API
  const apiResponse = await axios.get(
    `https://api.nal.usda.gov/fdc/v1/food/${fdcId}`, {
      headers: { "x-api-key": process.env.API_KEY }
    }
  );
  const apiFood = apiResponse.data;

  // 3. Map API response
  const nutrients = [];
  for (let n of apiFood.foodNutrients) {
    if ([1008, 1005, 1004, 1003].includes(n.nutrient.id)) {
      nutrients.push({
        nutrientName: n.nutrient.name,
        value: n.amount,
        unitName: n.nutrient.unitName,
      });
    }
  }

  const foodData = {
    fdcId: apiFood.fdcId,
    description: apiFood.description,
    brandName: apiFood.brandName,
    servingSizeUnit: apiFood.servingSizeUnit || "g",
    servingSize: apiFood.servingSize || 100,
    foodNutrients: nutrients,
    hasRealServing: Boolean(apiFood.servingSize),
  };

  // 4. Save to DB/cache
  await addFoodToCache(foodData);

  return { source: "api", data: foodData };
}