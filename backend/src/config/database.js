import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Prevent accidental test runs on development database
if (process.env.NODE_ENV === 'test') {
  if (!process.env.DB_NAME || !process.env.DB_NAME.includes('test')) {
    console.log(`trying to access the db: ${process.env.DB_NAME} from the enviorment ${process.env.NODE_ENV}`)
    throw new Error('Test mode requires database name containing "test"');
  }
}
let db;
// Production 
if (process.env.DATABASE_URL) {
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else {
  // Development and Testing
  db = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });
}

// Verify connection on startup
db.on('connect', async (client) => {
  const result = await client.query('SELECT current_database()');
  const dbName = result.rows[0].current_database;

  if (process.env.NODE_ENV === 'test' && !dbName.includes('test')) {
    console.error(`❌ CONNECTED TO WRONG DATABASE: ${dbName}`);
    process.exit(1);
  }
});

export { db }