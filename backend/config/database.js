const { Pool } = require('pg');
require('dotenv').config();

// ===========================================
// ENVIRONMENT VALIDATION
// ===========================================

if (!process.env.DATABASE_URL && !process.env.DB_PASSWORD) {
  console.error('❌ FATAL: Set DATABASE_URL or DB_PASSWORD environment variable');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

// ===========================================
// DATABASE CONNECTION POOL CONFIGURATION
// ===========================================

const isProduction = process.env.NODE_ENV === 'production';
const useConnectionString = Boolean(process.env.DATABASE_URL);
const sslEnabled = process.env.DB_SSL === 'true' || isProduction || useConnectionString;
const sslConfig = sslEnabled
  ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
  : false;

const poolConfig = useConnectionString
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'Pawmilya',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: sslConfig,
    };

Object.assign(poolConfig, {
  
  // Connection Pool Settings
  max: parseInt(process.env.DB_POOL_MAX) || 20,                    // Maximum connections in pool
  min: parseInt(process.env.DB_POOL_MIN) || 2,                     // Minimum connections in pool
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000, // Close idle connections after 30s
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT) || 5000, // Connection timeout 5s
  
});

const pool = new Pool(poolConfig);

// ===========================================
// CONNECTION POOL EVENT HANDLERS
// ===========================================

// Log when a new client is created
pool.on('connect', (client) => {
  if (!isProduction) {
    console.log('🔗 New database client connected');
  }
});

// Log pool errors
pool.on('error', (err, client) => {
  console.error('❌ Unexpected database pool error:', err.message);
});

// Log when a client is removed from the pool
pool.on('remove', (client) => {
  if (!isProduction) {
    console.log('🔌 Database client removed from pool');
  }
});

// ===========================================
// DATABASE HELPER FUNCTIONS
// ===========================================

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Connected to PostgreSQL database: Pawmilya');
    return true;
  } catch (err) {
    console.error('❌ Error connecting to database:', err.message);
    return false;
  }
};

// Get pool statistics
const getPoolStats = () => {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
};

// Graceful shutdown
const closePool = async () => {
  console.log('🔒 Closing database connection pool...');
  await pool.end();
  console.log('✅ Database pool closed');
};

// Execute a query with error handling
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries in development
    if (!isProduction && duration > 1000) {
      console.warn(`⚠️ Slow query (${duration}ms):`, text.substring(0, 100));
    }
    
    return result;
  } catch (error) {
    console.error('❌ Database query error:', error.message);
    throw error;
  }
};

// Execute a transaction
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Initial connection test
testConnection();

// ===========================================
// EXPORTS
// ===========================================

module.exports = {
  query,
  pool,
  transaction,
  getPoolStats,
  closePool,
  testConnection,
};
