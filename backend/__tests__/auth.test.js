import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from '../src/routes/auth.js';
import { cleanDatabase, createTestUser, closeDatabase } from './setup.js';


// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);

// Run before each test
beforeEach(async () => {
  await cleanDatabase();
});

// Run after all tests
afterAll(async () => {
  await closeDatabase();
});

describe('POST /api/auth/register', () => {
  test('should register a new user successfully', async () => {
    const newUser = {
      email: 'newuser@example.com',
      password: 'password123',
      username: 'New User'
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(newUser)
      .expect(201);

    // Check response structure
    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user).toHaveProperty('id');
    expect(response.body.user.email).toBe(newUser.email);
    expect(response.body.user.username).toBe(newUser.username);
    
    // Check that password is NOT in response
    expect(response.body.user).not.toHaveProperty('password');
    expect(response.body.user).not.toHaveProperty('password_hash');
    
    // Check that cookie was set
    expect(response.headers['set-cookie']).toBeDefined();
    expect(response.headers['set-cookie'][0]).toMatch(/token=/);
  });

  test('should fail with missing fields', async () => {
    const invalidUser = {
      email: 'test@example.com'
      // Missing password and username
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(invalidUser)
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  test('should fail with invalid email', async () => {
    const invalidUser = {
      email: 'not-an-email',
      password: 'password123',
      username: 'Test User'
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(invalidUser)
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  test('should fail with short password', async () => {
    const invalidUser = {
      email: 'test@example.com',
      password: '123',  // Too short
      username: 'Test User'
    };

    const response = await request(app)
      .post('/api/auth/register')
      .send(invalidUser)
      .expect(400);

    expect(response.body.details[0].message).toMatch(/8 characters/i);
  });

  test('should fail with duplicate email', async () => {
    const user = {
      email: 'duplicate@example.com',
      password: 'password123',
      username: 'User One'
    };

    // Register first user
    await request(app)
      .post('/api/auth/register')
      .send(user)
      .expect(201);

    // Try to register with same email
    const response = await request(app)
      .post('/api/auth/register')
      .send({ ...user, username: 'User Two' })
      .expect(400);

    expect(response.body.error).toMatch(/already registered/i);
  });
});

describe('POST /api/auth/login', () => {
  test('should login successfully with correct credentials', async () => {
    // Create test user
    const testUser = await createTestUser({
      email: 'login@example.com',
      password: 'password123'
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'password123'
      })
      .expect(200);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe(testUser.email);
    
    // Check cookie
    expect(response.headers['set-cookie']).toBeDefined();
  });

  test('should fail with wrong password', async () => {
    const testUser = await createTestUser({
      email: 'login@example.com',
      password: 'password123'
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'wrongpassword'
      })
      .expect(401);

    expect(response.body.error).toMatch(/invalid/i);
  });

  test('should fail with non-existent email', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'password123'
      })
      .expect(401);

    expect(response.body.error).toMatch(/invalid/i);
  });

  test('should fail with missing fields', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com' })
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });
});

describe('POST /api/auth/logout', () => {
  test('should logout successfully', async () => {
    const response = await request(app)
      .post('/api/auth/logout')
      .expect(200);

    expect(response.body.message).toMatch(/logged out/i);
    
    // Check that cookie was cleared
    const cookies = response.headers['set-cookie'];
    if (cookies) {
      expect(cookies[0]).toMatch(/token=;/);
    }
  });
});

describe('GET /api/auth/me', () => {
  test('should return current user when authenticated', async () => {
    // Register and get cookie
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'me@example.com',
        password: 'password123',
        username: 'Me User'
      });

    const cookie = registerResponse.headers['set-cookie'];

    // Get current user
    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe('me@example.com');
  });

  test('should fail when not authenticated', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .expect(401);

    expect(response.body.error).toMatch(/token/i);
  });
});