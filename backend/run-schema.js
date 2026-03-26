const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const useConnectionString = Boolean(process.env.DATABASE_URL);
const sslEnabled = process.env.DB_SSL === 'true' || useConnectionString;
const sslConfig = sslEnabled
  ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
  : false;

const pool = new Pool(
  useConnectionString
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: sslConfig,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'Pawmilya',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '2004',
        ssl: sslConfig,
      }
);

async function runSchema() {
  try {
    console.log('Running schema.sql...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf-8');
    await pool.query(schemaSql);
    console.log('Schema created successfully.');
  } catch (err) {
    console.error('Error running schema:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSchema();
