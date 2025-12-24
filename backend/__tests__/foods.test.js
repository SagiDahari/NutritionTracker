import request from 'supertest';
import express from 'express';
import foodsRoutes from '../src/routes/foods.js';
import { 
  cleanDatabase, 
  createTestFood,
  closeDatabase 
} from './setup.js';
import { db } from '../src/config/database.js';

const app = express();
app.use(express.json());
app.use('/api/foods', foodsRoutes);

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('GET /api/foods/search', () => {
  test('should return search results from USDA API', async () => {
    const response = await request(app)
      .get('/api/foods/search')
      .query({ food: 'apple' })
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    
    if (response.body.length > 0) {
      const firstResult = response.body[0];
      expect(firstResult).toHaveProperty('fdcId');
      expect(firstResult).toHaveProperty('description');
    }
  }, 10000);  // 10 second timeout for API call

  test('should fail with missing search query', async () => {
    const response = await request(app)
      .get('/api/foods/search')
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/Query parameter/i);
  });

  test('should fail with empty search query', async () => {
    const response = await request(app)
      .get('/api/foods/search')
      .query({ food: '' })
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  test('should handle search with no results gracefully', async () => {
    const response = await request(app)
      .get('/api/foods/search')
      .query({ food: 'xyzabc123impossible' })
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(0);
  }, 10000);

  test('should return foods with nutritional information', async () => {
    const response = await request(app)
      .get('/api/foods/search')
      .query({ food: 'chicken breast' })
      .expect(200);

    if (response.body.length > 0) {
      const food = response.body[0];
      expect(food).toHaveProperty('fdcId');
      expect(food).toHaveProperty('description');
      
      // Should have some nutritional data
      if (food.foodNutrients) {
        expect(typeof food.foodNutrients).toBe('object');
      }
    }
  }, 10000);
});

describe('GET /api/foods/:fdcId', () => {
  test('should return food from cache if available', async () => {
    // Create test food in cache
    const testFood = await createTestFood({
      fdcId: 123456,
      description: 'Test Chicken Breast',
      calories: 165
    });

    const response = await request(app)
      .get(`/api/foods/${testFood.fdcId}`)
      .expect(200);

    expect(response.body.source).toBe('cache');
    expect(response.body.data).toHaveProperty('fdc_id', '123456');
    expect(response.body.data).toHaveProperty('description', 'Test Chicken Breast');
  });

  test('should fetch from USDA API if not in cache', async () => {
    // Use a real FDC ID from USDA database
    const fdcId = 171477;  // Chicken breast, roasted

    const response = await request(app)
      .get(`/api/foods/${fdcId}`)
      .expect(200);

    // Should fetch from API (not cache)
    expect(response.body.source).toBe('api');
    expect(response.body.data).toHaveProperty('fdcId', fdcId);
    expect(response.body.data).toHaveProperty('description');
    expect(response.body.data).toHaveProperty('foodNutrients');
    expect(Array.isArray(response.body.data.foodNutrients)).toBe(true);
  }, 10000);

  test('should cache food after fetching from API', async () => {
    const fdcId = 171477;

    // First request - fetch from API
    await request(app)
      .get(`/api/foods/${fdcId}`)
      .expect(200);

    // Verify it was cached
    const cached = await db.query(
      'SELECT * FROM food_cache WHERE fdc_id = $1',
      [fdcId]
    );

    expect(cached.rows.length).toBe(1);
    expect(cached.rows[0].fdc_id).toBe(fdcId.toString());

    // Second request - should come from cache
    const response = await request(app)
      .get(`/api/foods/${fdcId}`)
      .expect(200);

    expect(response.body.source).toBe('cache');
  }, 15000);

  test('should fail with invalid FDC ID format', async () => {
    const response = await request(app)
      .get('/api/foods/invalid')
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  test('should fail with non-existent FDC ID', async () => {
    const response = await request(app)
      .get('/api/foods/999999999')
      .expect(400);

    expect(response.body).toHaveProperty('error');
  }, 10000);

  test('should include nutritional data structure', async () => {
    const testFood = await createTestFood({
      fdcId: 789012,
      description: 'Test Food',
      calories: 200,
      protein: 20,
      carbs: 30,
      fats: 8
    });

    const response = await request(app)
      .get('/api/foods/789012')
      .expect(200);

    expect(response.body.data).toHaveProperty('foodNutrients');
    expect(Array.isArray(response.body.data.foodNutrients)).toBe(true);

    // Check nutrient structure
    const nutrients = response.body.data.foodNutrients;
    if (nutrients.length > 0) {
      const nutrient = nutrients[0];
      expect(nutrient).toHaveProperty('nutrient_name');
      expect(nutrient).toHaveProperty('value');
      expect(nutrient).toHaveProperty('unit_name');
    }
  });

  test('should handle serving size information', async () => {
    const testFood = await createTestFood({
      fdcId: 345678,
      description: 'Test Food with Serving',
      servingSizeUnit: 'g',
      servingSize: 100
    });

    const response = await request(app)
      .get('/api/foods/345678')
      .expect(200);

    expect(response.body.data).toHaveProperty('serving_size_unit', 'g');
    expect(response.body.data).toHaveProperty('serving_size', '100');
  });
});

describe('Food Cache Functionality', () => {
  test('should store all nutrients when caching', async () => {
    const fdcId = 171477;

    // Fetch from API (will cache it)
    await request(app)
      .get(`/api/foods/${fdcId}`)
      .expect(200);

    // Check nutrients were stored
    const nutrients = await db.query(
      'SELECT * FROM food_nutrients WHERE food_id = $1',
      [fdcId]
    );

    expect(nutrients.rows.length).toBeGreaterThan(0);

    // Should have common nutrients
    const nutrientNames = nutrients.rows.map(n => n.nutrient_name);
    expect(nutrientNames).toContain('Energy');
    expect(nutrientNames).toContain('Protein');
  }, 15000);

  test('should update cache if food is refetched', async () => {
    const testFood = await createTestFood({
      fdcId: 111222,
      description: 'Old Description',
      calories: 100
    });

    // Manually update description in cache
    await db.query(
      'UPDATE food_cache SET description = $1 WHERE fdc_id = $2',
      ['New Description', 111222]
    );

    // Fetch from cache
    const response = await request(app)
      .get('/api/foods/111222')
      .expect(200);

    expect(response.body.data.description).toBe('New Description');
  });
});