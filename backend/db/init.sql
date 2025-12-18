CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    username VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()  
);

CREATE TABLE IF NOT EXISTS user_goals (
    user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    calories INT DEFAULT 2000,
    protein INT DEFAULT 150,
    carbohydrates INT DEFAULT 250,
    fats INT DEFAULT 65,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS food_cache (
    fdc_id BIGINT PRIMARY KEY,
    description TEXT,
    brand_name TEXT,
    serving_size_unit TEXT,
    serving_size NUMERIC,
    has_real_serving BOOLEAN
);

CREATE TABLE IF NOT EXISTS food_nutrients (
    id SERIAL PRIMARY KEY,
    food_id BIGINT REFERENCES food_cache(fdc_id) ON DELETE CASCADE,
    nutrient_name TEXT,
    value NUMERIC,
    unit_name TEXT
);

CREATE TABLE IF NOT EXISTS meals (
    id SERIAL PRIMARY KEY,
    meal_date DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
    user_id INT REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_meals_user_date ON meals(user_id, meal_date);

CREATE TABLE IF NOT EXISTS meal_foods (
    id SERIAL PRIMARY KEY,
    meal_id INT REFERENCES meals(id) ON DELETE CASCADE,
    food_id BIGINT REFERENCES food_cache(fdc_id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL DEFAULT 100,   
    UNIQUE(meal_id, food_id)               
);





