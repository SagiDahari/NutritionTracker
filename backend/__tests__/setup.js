import { db } from '../src/config/database.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Clean up database before each test
export async function cleanDatabase() {

    const result = await db.query('SELECT current_database()');
    const dbName = result.rows[0].current_database;
  
    if (!dbName.includes('test')) {
        throw new Error(`❌ REFUSING TO CLEAN: ${dbName}`);
    }

    await db.query('DELETE FROM meal_foods');
    await db.query('DELETE FROM meals');
    await db.query('DELETE FROM user_goals');
    await db.query('DELETE FROM users');
    await db.query('DELETE FROM food_nutrients');
    await db.query('DELETE FROM food_cache');
}

// Create a test user
export async function createTestUser(userData = {}) {
  const defaultUser = {
    email: 'test@example.com',
    password: 'password123',
    username: 'Test User'
  };
  
  const user = { ...defaultUser, ...userData };
  
  const passwordHash = await bcrypt.hash(user.password, 10);
  
  const result = await db.query(
    'INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id, email, username',
    [user.email, passwordHash, user.username]
  );
  
  // Create default goals for user
  await db.query(
    'INSERT INTO user_goals (user_id) VALUES ($1)',
    [result.rows[0].id]
  );
  
  return { ...result.rows[0], password: user.password };
}

// Get authentication cookie for a user
export async function getAuthCookie(userData = {}) {

  const testUser = await createTestUser(userData);

  const token = jwt.sign(
    { userId: testUser.id, email: testUser.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { 
    cookie: `token=${token}`, 
    user: testUser 
  };
}

// Create a test food
export async function createTestFood(foodData = {}) {

  const defaultFood = {
    fdcId: Math.floor(Math.random() * 1000000),  // Random ID
    description: 'Test Food',
    brandName: null,
    servingSizeUnit: 'g',
    servingSize: 100,
    hasRealServing: true,
    calories: 100,
    protein: 10,
    carbs: 10,
    fats: 5
  };
  
  const food = { ...defaultFood, ...foodData };
  
  // Insert food into cache
  await db.query(
    `INSERT INTO food_cache (fdc_id, description, brand_name, serving_size_unit, serving_size, has_real_serving) 
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (fdc_id) DO UPDATE 
     SET description = EXCLUDED.description,
         brand_name = EXCLUDED.brand_name,
         serving_size_unit = EXCLUDED.serving_size_unit,
         serving_size = EXCLUDED.serving_size,
         has_real_serving = EXCLUDED.has_real_serving`,
    [food.fdcId, food.description, food.brandName, food.servingSizeUnit, food.servingSize, food.hasRealServing]
  );
  
  // Delete existing nutrients for this food (if any)
  await db.query('DELETE FROM food_nutrients WHERE food_id = $1', [food.fdcId]);
  
  // Add nutrients
  const nutrients = [
    { name: 'Energy', value: food.calories, unitName: 'kcal' },
    { name: 'Protein', value: food.protein, unitName: 'g' },
    { name: 'Carbohydrate, by difference', value: food.carbs, unitName: 'g' },
    { name: 'Total lipid (fat)', value: food.fats, unitName: 'g' }
  ];

  for (const nutrient of nutrients) {
    await db.query(
      `INSERT INTO food_nutrients (food_id, nutrient_name, value, unit_name) 
       VALUES ($1, $2, $3, $4)`,
      [food.fdcId, nutrient.name, nutrient.value, nutrient.unitName]
    );
  }
  
  return food;
}

// Close database connection after all tests
export async function closeDatabase() {
  await db.end();
}