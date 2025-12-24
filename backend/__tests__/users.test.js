import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import usersRoutes from '../src/routes/users.js';
import { 
  cleanDatabase, 
  getAuthCookie, 
  closeDatabase 
} from './setup.js';
import { db } from '../src/config/database.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use('/api/users', usersRoutes);

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('GET /api/users/goals', () => {
  test('should return default goals for new user', async () => {
    const { cookie } = await getAuthCookie();

    const response = await request(app)
      .get('/api/users/goals')
      .set('Cookie', cookie)
      .expect(200);

    // Check default values
    expect(response.body).toHaveProperty('calories');
    expect(response.body).toHaveProperty('protein');
    expect(response.body).toHaveProperty('carbohydrates');
    expect(response.body).toHaveProperty('fats');
    
    // Default values should be numbers
    expect(typeof response.body.calories).toBe('number');
    expect(typeof response.body.protein).toBe('number');
    expect(typeof response.body.carbohydrates).toBe('number');
    expect(typeof response.body.fats).toBe('number');
  });

  test('should fail without authentication', async () => {
    const response = await request(app)
      .get('/api/users/goals')
      .expect(401);

    expect(response.body).toHaveProperty('error');
  });

  test('should return correct goals for specific user', async () => {
    // Create two users
    const { cookie: cookie1, user: user1 } = await getAuthCookie({ 
      email: 'user1@test.com' 
    });
    const { cookie: cookie2 } = await getAuthCookie({ 
      email: 'user2@test.com' 
    });

    // Set different goals for user1
    await db.query(
      'UPDATE user_goals SET calories = $1, protein = $2 WHERE user_id = $3',
      [2500, 180, user1.id]
    );

    // Get goals for user1
    const response1 = await request(app)
      .get('/api/users/goals')
      .set('Cookie', cookie1)
      .expect(200);

    // Get goals for user2
    const response2 = await request(app)
      .get('/api/users/goals')
      .set('Cookie', cookie2)
      .expect(200);

    // Goals should be different
    expect(response1.body.calories).toBe(2500);
    expect(response1.body.protein).toBe(180);
    expect(response2.body.calories).not.toBe(2500);
  });
});

describe('PUT /api/users/goals', () => {
  test('should update goals successfully', async () => {
    const { cookie } = await getAuthCookie();

    const newGoals = {
      calories: 2200,
      protein: 165,
      carbohydrates: 275,
      fats: 73
    };

    const response = await request(app)
      .put('/api/users/goals')
      .set('Cookie', cookie)
      .send(newGoals)
      .expect(200);

    expect(response.body.message).toMatch(/updated successfully/i);
    expect(response.body.goals).toMatchObject(newGoals);

    // Verify goals were actually updated in database
    const verifyResponse = await request(app)
      .get('/api/users/goals')
      .set('Cookie', cookie)
      .expect(200);

    expect(verifyResponse.body).toMatchObject(newGoals);
  });

  test('should fail with invalid data - negative calories', async () => {
    const { cookie } = await getAuthCookie();

    const invalidGoals = {
      calories: -100,  // Negative!
      protein: 150,
      carbohydrates: 250,
      fats: 70
    };

    const response = await request(app)
      .put('/api/users/goals')
      .set('Cookie', cookie)
      .send(invalidGoals)
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  test('should fail with invalid data - calories too high', async () => {
    const { cookie } = await getAuthCookie();

    const invalidGoals = {
      calories: 15000,  // Too high!
      protein: 150,
      carbohydrates: 250,
      fats: 70
    };

    const response = await request(app)
      .put('/api/users/goals')
      .set('Cookie', cookie)
      .send(invalidGoals)
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  test('should fail with missing fields', async () => {
    const { cookie } = await getAuthCookie();

    const incompleteGoals = {
      calories: 2000,
      protein: 150
      // Missing carbohydrates and fats
    };

    const response = await request(app)
      .put('/api/users/goals')
      .set('Cookie', cookie)
      .send(incompleteGoals)
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  test('should fail with non-numeric values', async () => {
    const { cookie } = await getAuthCookie();

    const invalidGoals = {
      calories: "two thousand",  // String!
      protein: 150,
      carbohydrates: 250,
      fats: 70
    };

    const response = await request(app)
      .put('/api/users/goals')
      .set('Cookie', cookie)
      .send(invalidGoals)
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  test('should fail without authentication', async () => {
    const newGoals = {
      calories: 2000,
      protein: 150,
      carbohydrates: 250,
      fats: 70
    };

    const response = await request(app)
      .put('/api/users/goals')
      .send(newGoals)
      .expect(401);

    expect(response.body).toHaveProperty('error');
  });

  test('should not affect other users goals', async () => {
    // Create two users
    const { cookie: cookie1 } = await getAuthCookie({ 
      email: 'user1@test.com' 
    });
    const { cookie: cookie2 } = await getAuthCookie({ 
      email: 'user2@test.com' 
    });

    // User1 updates their goals
    const user1Goals = {
      calories: 3000,
      protein: 200,
      carbohydrates: 400,
      fats: 100
    };

    await request(app)
      .put('/api/users/goals')
      .set('Cookie', cookie1)
      .send(user1Goals)
      .expect(200);

    // Check user2's goals are unchanged
    const user2Response = await request(app)
      .get('/api/users/goals')
      .set('Cookie', cookie2)
      .expect(200);

    expect(user2Response.body.calories).not.toBe(3000);
  });

  test('should accept valid boundary values', async () => {
    const { cookie } = await getAuthCookie();

    // Minimum valid values
    const minGoals = {
      calories: 1,
      protein: 0,
      carbohydrates: 0,
      fats: 0
    };

    const response = await request(app)
      .put('/api/users/goals')
      .set('Cookie', cookie)
      .send(minGoals)
      .expect(200);

    expect(response.body.goals).toMatchObject(minGoals);
  });

  test('should fail with decimal values', async () => {
    const { cookie } = await getAuthCookie();

    const decimalGoals = {
      calories: 2000.7,
      protein: 150.3,
      carbohydrates: 250.9,
      fats: 70.1
    };

    const response = await request(app)
      .put('/api/users/goals')
      .set('Cookie', cookie)
      .send(decimalGoals)
      .expect(400);
  });
});