import { db } from '../config/database.js';
import { getOrCacheFood } from '../utils/foodCache.js';

// Helper function to ensure all 4 meals exist for a user on a specific date
async function getOrCreateMealsForDate(userId, date) {
  // Get existing meals for this user and date
  let result = await db.query(
    `SELECT id, meal_type FROM meals WHERE user_id = $1 AND meal_date = $2`,
    [userId, date]
  );

  const existingMeals = result.rows;
  const existingMealTypes = existingMeals.map(m => m.meal_type);

  // Define all required meal types
  const allMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];

  // Find missing meal types
  const missingMealTypes = allMealTypes.filter(
    type => !existingMealTypes.includes(type)
  );

  // Create missing meals
  for (const type of missingMealTypes) {
    const insertResult = await db.query(
      `INSERT INTO meals (user_id, meal_date, meal_type) VALUES ($1, $2, $3) RETURNING id, meal_type`,
      [userId, date, type]
    );
    existingMeals.push(insertResult.rows[0]);
  }

  return existingMeals;
}

export const getMealsByDate = async (req, res) => {
  try {
    const { mealDate } = req.params;
    const userId = req.user.userId; // From JWT token!

    if (!mealDate) {
      return res.status(400).json({ error: "Date parameter is required" });
    }

    // Ensure all 4 meals exist for this user and date
    await getOrCreateMealsForDate(userId, mealDate);

    // Fetch meals with foods for this specific user
    const query = `SELECT
      m.id,
      m.meal_date, 
      m.meal_type,
      f.fdc_id, 
      f.description, 
      f.brand_name,
      mf.quantity,
      fn.nutrient_name, 
      fn.value, 
      fn.unit_name
      FROM meals m 
      LEFT JOIN meal_foods mf ON mf.meal_id = m.id
      LEFT JOIN food_cache f ON f.fdc_id = mf.food_id
      LEFT JOIN food_nutrients fn ON fn.food_id = f.fdc_id
      WHERE m.user_id = $1 AND m.meal_date = $2
      ORDER BY 
        CASE m.meal_type
          WHEN 'breakfast' THEN 1
          WHEN 'lunch' THEN 2
          WHEN 'dinner' THEN 3
          WHEN 'snack' THEN 4
        END,
        m.id;`;

    const result = await db.query(query, [userId, mealDate]);

    // Structure SQL into formatted JSON
    const dailyMeals = {};

    for (let row of result.rows) {
      if (!dailyMeals[row.id]) {
        dailyMeals[row.id] = {
          id: row.id,
          type: row.meal_type,
          date: mealDate,
          foods: {},
          totals: { calories: 0, carbohydrates: 0, protein: 0, fats: 0 },
        };
      }

      if (row.fdc_id) {
        if (!dailyMeals[row.id].foods[row.fdc_id]) {
          dailyMeals[row.id].foods[row.fdc_id] = {
            fdcId: row.fdc_id,
            description: row.description,
            brand: row.brand_name,
            quantity: row.quantity,
            calories: 0,
            carbohydrates: 0,
            protein: 0,
            fats: 0
          };
        }

        // Normalize values to each food by its quantity
        let valueTo100GRatio = row.value / 100;
        let adjustedValue = valueTo100GRatio * row.quantity;

        if (row.nutrient_name === 'Energy') {
          dailyMeals[row.id].foods[row.fdc_id].calories += adjustedValue;
        }
        if (row.nutrient_name === 'Carbohydrate, by difference') {
          dailyMeals[row.id].foods[row.fdc_id].carbohydrates += adjustedValue;
        }
        if (row.nutrient_name === 'Protein') {
          dailyMeals[row.id].foods[row.fdc_id].protein += adjustedValue;
        }
        if (row.nutrient_name === 'Total lipid (fat)') {
          dailyMeals[row.id].foods[row.fdc_id].fats += adjustedValue;
        }
      }
    }

    // Calculate meal totals
    for (let mealId in dailyMeals) {
      const meal = dailyMeals[mealId];
      for (let fdcId in meal.foods) {
        const food = meal.foods[fdcId];
        meal.totals.calories += food.calories;
        meal.totals.protein += food.protein;
        meal.totals.carbohydrates += food.carbohydrates;
        meal.totals.fats += food.fats;
      }
    }

    // Calculate daily totals
    let dailyTotals = { calories: 0, protein: 0, carbohydrates: 0, fats: 0 };

    for (let mealId in dailyMeals) {
      const meal = dailyMeals[mealId];
      dailyTotals.calories += meal.totals.calories;
      dailyTotals.protein += meal.totals.protein;
      dailyTotals.carbohydrates += meal.totals.carbohydrates;
      dailyTotals.fats += meal.totals.fats;
    }

    res.json({ dailyMeals, dailyTotals });

  } catch (error) {
    console.error('Get meals error:', error);
    res.status(500).json({ error: "Something went wrong" });
  }
};

export const getMealById = async (req, res) => { // Not relevant for the UI 
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!id) {
      return res.status(400).json({ error: "Meal ID is required" });
    }

    // Query with user_id check to ensure user can only access their own meals
    const query = `SELECT
      m.id,
      m.meal_date, 
      m.meal_type,
      f.fdc_id, 
      f.description, 
      f.brand_name,
      mf.quantity, 
      fn.nutrient_name, 
      fn.value, 
      fn.unit_name
      FROM meals m 
      LEFT JOIN meal_foods mf ON mf.meal_id = m.id
      LEFT JOIN food_cache f ON f.fdc_id = mf.food_id
      LEFT JOIN food_nutrients fn ON fn.food_id = f.fdc_id
      WHERE m.id = $1 AND m.user_id = $2
      ORDER BY m.id;`;

    const result = await db.query(query, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Meal not found or you don't have permission to access it"
      });
    }

    const meal = {
      id: id,
      type: result.rows[0].meal_type,
      date: result.rows[0].meal_date,
      foods: {},
      totals: { calories: 0, carbohydrates: 0, protein: 0, fats: 0 }
    };

    for (let row of result.rows) {
      if (!meal.foods[row.fdc_id]) {
        meal.foods[row.fdc_id] = {
          fdcId: row.fdc_id,
          description: row.description,
          brand: row.brand_name,
          quantity: row.quantity,
          calories: 0,
          carbohydrates: 0,
          protein: 0,
          fats: 0
        };
      }

      let valueTo100GRatio = row.value / 100;
      let adjustedValue = valueTo100GRatio * row.quantity;

      if (row.nutrient_name === 'Energy') {
        meal.foods[row.fdc_id].calories += adjustedValue;
      }
      if (row.nutrient_name === 'Carbohydrate, by difference') {
        meal.foods[row.fdc_id].carbohydrates += adjustedValue;
      }
      if (row.nutrient_name === 'Protein') {
        meal.foods[row.fdc_id].protein += adjustedValue;
      }
      if (row.nutrient_name === 'Total lipid (fat)') {
        meal.foods[row.fdc_id].fats += adjustedValue;
      }
    }

    // Calculate meal totals
    for (let fdcId in meal.foods) {
      const food = meal.foods[fdcId];
      meal.totals.calories += food.calories;
      meal.totals.carbohydrates += food.carbohydrates;
      meal.totals.protein += food.protein;
      meal.totals.fats += food.fats;
    }

    res.json(meal);

  } catch (error) {
    console.error('Get meal error:', error);
    res.status(500).json({ error: "Something went wrong" });
  }
};

export const logFood = async (req, res) => {
  try {
    const { fdcId, mealId, quantity } = req.body;
    const userId = req.user.userId;

    if (!fdcId || !mealId || !quantity) {
      return res.status(400).json({ error: "fdcId, mealId, and quantity are required" });
    }

    // Verify that the meal belongs to this user
    const mealCheck = await db.query(
      'SELECT id FROM meals WHERE id = $1 AND user_id = $2',
      [mealId, userId]
    );

    if (mealCheck.rows.length === 0) {
      return res.status(403).json({ error: "You don't have permission to add food to this meal" });
    }

    const foodData = await getOrCacheFood(fdcId);

    // Insert into meal_foods
    await db.query(
      `INSERT INTO meal_foods (meal_id, food_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (meal_id, food_id) DO UPDATE SET quantity = meal_foods.quantity + EXCLUDED.quantity`,
      [mealId, fdcId, quantity]
    );

    res.json({ message: "Food logged successfully!", food: foodData });
  } catch (error) {
    console.error('Log food error:', error);
    res.status(500).json({ error: "Something went wrong" });
  }
};

export const deleteFood = async (req, res) => {
  try {
    const { mealId, fdcId } = req.params;
    const userId = req.user.userId;

    if (!mealId || !fdcId) {
      return res.status(400).json({ error: "Meal ID and Food ID are required" });
    }

    // Verify that the meal belongs to this user
    const mealCheck = await db.query(
      'SELECT id FROM meals WHERE id = $1 AND user_id = $2',
      [mealId, userId]
    );

    if (mealCheck.rows.length === 0) {
      return res.status(403).json({ error: "You don't have permission to modify this meal" });
    }

    const result = await db.query(
      "DELETE FROM meal_foods WHERE meal_id = $1 AND food_id = $2 RETURNING food_id;",
      [mealId, fdcId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Food not found in this meal"
      });
    }

    res.status(200).json({
      message: `Food with ID ${fdcId} deleted successfully from meal ${mealId}`,
      deletedFoodId: result.rows[0].food_id
    });
  } catch (error) {
    console.error('Delete food error:', error);
    res.status(500).json({ error: "Something went wrong" });
  }
};

export const deleteMeal = async (req, res) => { // Not relevant for the UI 
  try {
    const { mealId } = req.params;
    const userId = req.user.userId;

    if (!mealId) {
      return res.status(400).json({ error: "Meal ID is required" });
    }

    // Delete only if the meal belongs to this user
    const result = await db.query(
      "DELETE FROM meals WHERE id = $1 AND user_id = $2 RETURNING meal_type, meal_date",
      [mealId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Meal not found or you don't have permission to delete it"
      });
    }

    res.status(200).json({
      message: `Meal ${mealId} was deleted`,
      deletedMealType: result.rows[0].meal_type,
      deletedMealDate: result.rows[0].meal_date
    });

  } catch (error) {
    console.error('Delete meal error:', error);
    res.status(500).json({ error: "Something went wrong" });
  }
};