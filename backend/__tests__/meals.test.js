import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import mealsRoutes from '../src/routes/meals.js';
import { cleanDatabase, createTestUser, closeDatabase } from './setup.js';
import { db } from '../src/config/database.js';
import jwt from 'jsonwebtoken';

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use('/api/meals', mealsRoutes);

// Helper to get auth cookie
async function getAuthCookie(user = {}) {
  const testUser = await createTestUser(user);
  
  const token = jwt.sign(
    { userId: testUser.id, email: testUser.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  return { cookie: `token=${token}`, user: testUser };
}

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('GET /api/meals/:date', () => {
  test('should return all meals for a date', async () => {
    const { cookie } = await getAuthCookie();

    const response = await request(app)
        .get('/api/meals/2024-12-18')
        .set('Cookie', cookie)
        .expect(200);

    expect(response.body).toHaveProperty('dailyMeals');
    expect(response.body).toHaveProperty('dailyTotals');
    
    // Should have 4 meal types
    const meals = Object.values(response.body.dailyMeals);
    expect(meals).toHaveLength(4);
    
    // Check meal types
    const mealTypes = meals.map(m => m.type);
    expect(mealTypes).toContain('breakfast');
    expect(mealTypes).toContain('lunch');
    expect(mealTypes).toContain('dinner');
    expect(mealTypes).toContain('snack');
  });

  test('should fail without authentication', async () => {
    const response = await request(app)
      .get('/api/meals/2024-12-18')
      .expect(401);

    expect(response.body).toHaveProperty('error');
  });

  test('should only return meals for authenticated user', async () => {
    // Create two users
    const { cookie: cookie1 } = await getAuthCookie({ email: 'user1@test.com' });
    const { cookie: cookie2 } = await getAuthCookie({ email: 'user2@test.com' });

    // Get meals for user1
    const response1 = await request(app)
      .get('/api/meals/2024-12-18')
      .set('Cookie', cookie1)
      .expect(200);

    // Get meals for user2
    const response2 = await request(app)
      .get('/api/meals/2024-12-18')
      .set('Cookie', cookie2)
      .expect(200);

    // Meal IDs should be different
    const meals1 = Object.keys(response1.body.dailyMeals);
    const meals2 = Object.keys(response2.body.dailyMeals);
    
    expect(meals1).not.toEqual(meals2);
  });
});

describe('POST /api/meals/log-food', () => {
  test('should add food to meal successfully', async () => {
    const { cookie, user } = await getAuthCookie();

    // Get a meal ID first
    const mealsResponse = await request(app)
      .get('/api/meals/2024-12-18')
      .set('Cookie', cookie);

    const mealId = Object.values(mealsResponse.body.dailyMeals)[0].id;

    // Add a test food to cache
    await db.query(
      `INSERT INTO food_cache (fdc_id, description, brand_name, serving_size_unit, serving_size) 
       VALUES ($1, $2, $3, $4, $5)`,
      [123456, 'Test Food', 'Test Brand', 'g', 100]
    );

    // Add nutrients
    await db.query(
      `INSERT INTO food_nutrients (food_id, nutrient_name, value, unit_name) 
       VALUES ($1, $2, $3, $4)`,
      [123456, 'Energy', 100, 'kcal']
    );

    // Log food
    const response = await request(app)
      .post('/api/meals/log-food')
      .set('Cookie', cookie)
      .send({
        mealId: mealId,
        fdcId: 123456,
        quantity: 150
      })
      .expect(200);

    expect(response.body.message).toMatch(/successfully/i);
  });

  test('should fail with invalid data', async () => {
    const { cookie } = await getAuthCookie();

    const response = await request(app)
      .post('/api/meals/log-food')
      .set('Cookie', cookie)
      .send({
        mealId: 999,
        // Missing fdcId and quantity
      })
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  test('should fail without authentication', async () => {
    const response = await request(app)
      .post('/api/meals/log-food')
      .send({
        mealId: 1,
        fdcId: 123456,
        quantity: 100
      })
      .expect(401);

    expect(response.body).toHaveProperty('error');
  });
});

describe('DELETE /api/meals/delete-food/:mealId/:fdcId', () => {
  test('should delete food from meal successfully', async () => {
    const { cookie } = await getAuthCookie();

    // Setup: Get meal, add food
    const mealsResponse = await request(app)
      .get('/api/meals/2024-12-18')
      .set('Cookie', cookie);

    const mealId = Object.values(mealsResponse.body.dailyMeals)[0].id;

    // Add food to cache and meal
    await db.query(
      `INSERT INTO food_cache (fdc_id, description, serving_size_unit, serving_size) 
       VALUES ($1, $2, $3, $4)`,
      [123456, 'Test Food', 'g', 100]
    );

    await db.query(
      `INSERT INTO meal_foods (meal_id, food_id, quantity) VALUES ($1, $2, $3)`,
      [mealId, 123456, 100]
    );

    // Delete food
    const response = await request(app)
      .delete(`/api/meals/delete-food/${mealId}/123456`)
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.message).toMatch(/deleted successfully/i);
    expect(response.body.deletedFoodId).toBe("123456");
  });

  test('should fail when food not in meal', async () => {
    const { cookie } = await getAuthCookie();

    const mealsResponse = await request(app)
      .get('/api/meals/2024-12-18')
      .set('Cookie', cookie);

    const mealId = Object.values(mealsResponse.body.dailyMeals)[0].id;

    const response = await request(app)
      .delete(`/api/meals/delete-food/${mealId}/123456`)
      .set('Cookie', cookie)
      .expect(404);

    expect(response.body.error).toMatch(/not found/i);
  });
});