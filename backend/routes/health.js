const express = require('express');
const db = require('../config/database');
const tokenBlacklist = require('../config/tokenBlacklist');

const router = express.Router();

// ===========================================
// HEALTH CHECK ENDPOINTS
// ===========================================

// Basic health check (for load balancers)
router.get('/', async (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Detailed health check (for monitoring)
router.get('/detailed', async (req, res) => {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {},
  };

  // Check database connection
  try {
    const dbStart = Date.now();
    await db.query('SELECT 1');
    health.checks.database = {
      status: 'healthy',
      responseTime: Date.now() - dbStart,
    };
  } catch (error) {
    health.status = 'unhealthy';
    health.checks.database = {
      status: 'unhealthy',
      error: error.message,
    };
  }

  // Get pool statistics if available
  if (typeof db.getPoolStats === 'function') {
    try {
      health.checks.pool = db.getPoolStats();
    } catch (e) {
      health.checks.pool = { error: 'Unable to get pool stats' };
    }
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  health.checks.memory = {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
    external: Math.round(memUsage.external / 1024 / 1024) + ' MB',
    rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
  };

  // Token blacklist stats
  try {
    if (typeof tokenBlacklist.getStats === 'function') {
      health.checks.tokenBlacklist = await tokenBlacklist.getStats();
    }
  } catch (e) {
    health.checks.tokenBlacklist = { error: 'Unable to get blacklist stats' };
  }

  // Overall response time
  health.responseTime = Date.now() - startTime;

  // Set appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Readiness check (for Kubernetes)
router.get('/ready', async (req, res) => {
  try {
    // Check if database is accessible
    await db.query('SELECT 1');
    res.json({ ready: true });
  } catch (error) {
    res.status(503).json({ 
      ready: false, 
      error: 'Database not available',
    });
  }
});

// Liveness check (for Kubernetes)
router.get('/live', (req, res) => {
  // Basic check - if we can respond, we're alive
  res.json({ alive: true });
});

// Public stats endpoint for Mission screen
router.get('/stats', async (req, res) => {
  try {
    // Get adoption count (approved adoptions)
    const adoptionsResult = await db.query(
      `SELECT COUNT(*) as count FROM adoptions WHERE status = 'approved'`
    );
    
    // Get rescue count (completed rescues)
    const rescuesResult = await db.query(
      `SELECT COUNT(*) as count FROM rescues WHERE status IN ('completed', 'rescued')`
    );
    
    // Get shelter count (active shelters)
    const sheltersResult = await db.query(
      `SELECT COUNT(*) as count FROM shelters WHERE is_active = true`
    );
    
    // Get volunteer/user count
    const usersResult = await db.query(
      `SELECT COUNT(*) as count FROM users WHERE status = 'active'`
    );

    res.json({
      success: true,
      stats: {
        adoptions: parseInt(adoptionsResult.rows[0]?.count || 0),
        rescues: parseInt(rescuesResult.rows[0]?.count || 0),
        shelters: parseInt(sheltersResult.rows[0]?.count || 0),
        users: parseInt(usersResult.rows[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    // Return default stats on error
    res.json({
      success: false,
      stats: null,
    });
  }
});

// Metrics endpoint (basic)
router.get('/metrics', async (req, res) => {
  const metrics = [];
  const memUsage = process.memoryUsage();
  
  // Process metrics
  metrics.push(`# HELP process_uptime_seconds Process uptime in seconds`);
  metrics.push(`# TYPE process_uptime_seconds gauge`);
  metrics.push(`process_uptime_seconds ${process.uptime()}`);
  
  metrics.push(`# HELP process_memory_heap_bytes Process heap memory usage`);
  metrics.push(`# TYPE process_memory_heap_bytes gauge`);
  metrics.push(`process_memory_heap_bytes ${memUsage.heapUsed}`);
  
  metrics.push(`# HELP process_memory_rss_bytes Process resident set size`);
  metrics.push(`# TYPE process_memory_rss_bytes gauge`);
  metrics.push(`process_memory_rss_bytes ${memUsage.rss}`);

  // Database pool metrics
  if (typeof db.getPoolStats === 'function') {
    const poolStats = db.getPoolStats();
    metrics.push(`# HELP db_pool_total Database pool total connections`);
    metrics.push(`# TYPE db_pool_total gauge`);
    metrics.push(`db_pool_total ${poolStats.totalConnections}`);
    
    metrics.push(`# HELP db_pool_idle Database pool idle connections`);
    metrics.push(`# TYPE db_pool_idle gauge`);
    metrics.push(`db_pool_idle ${poolStats.idleConnections}`);
    
    metrics.push(`# HELP db_pool_waiting Database pool waiting clients`);
    metrics.push(`# TYPE db_pool_waiting gauge`);
    metrics.push(`db_pool_waiting ${poolStats.waitingClients}`);
  }

  res.set('Content-Type', 'text/plain');
  res.send(metrics.join('\n'));
});

module.exports = router;
