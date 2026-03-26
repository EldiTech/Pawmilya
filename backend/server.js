const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const db = require('./config/database');
const { logger, requestLogger } = require('./config/logger');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const petRoutes = require('./routes/pets');
const adoptionRoutes = require('./routes/adoptions');
const rescueRoutes = require('./routes/rescues');
const shelterRoutes = require('./routes/shelters');
const shelterTransferRoutes = require('./routes/shelterTransfers');
const adminRoutes = require('./routes/admin');
const rescuerApplicationRoutes = require('./routes/rescuerApplications');
const shelterApplicationRoutes = require('./routes/shelterApplications');
const shelterManagerRoutes = require('./routes/shelterManager');
const healthRoutes = require('./routes/health');
const aiRoutes = require('./routes/ai');
const paymentRoutes = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 3000;

// ===========================================
// SECURITY MIDDLEWARE
// ===========================================

// HTTPS redirect for production (when behind a proxy like nginx/load balancer)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Check if request was forwarded from HTTPS
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
  
  // Trust first proxy (required for secure cookies and correct IP detection)
  app.set('trust proxy', 1);
}

// Helmet - Set security HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin for images
  contentSecurityPolicy: false, // Disable for mobile app API
  hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
}));

// CORS Configuration - Restrict in production
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : '*', // Configure ALLOWED_ORIGINS in .env for production
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// Rate Limiting - General API limit
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', generalLimiter);

// Higher rate limit for public read-heavy endpoints
const publicReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Public GET endpoints can handle more traffic
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/pets', publicReadLimiter);
app.use('/api/shelters', publicReadLimiter);
app.use('/api/rescue-reports', publicReadLimiter);

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login attempts per windowMs
  message: { error: 'Too many login attempts, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/admin/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/email-signin', authLimiter);
app.use('/api/auth/send-signup-otp', authLimiter);
app.use('/api/auth/resend-otp', authLimiter);

// Body parsers - default 5mb limit for most routes
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Larger body limit for routes that handle base64 image uploads
const largeBodyParser = express.json({ limit: '20mb' });
app.use('/api/users/avatar', largeBodyParser);
app.use('/api/admin/pets', largeBodyParser);
app.use('/api/rescue-reports', largeBodyParser);
app.use('/api/shelter-manager/pets', largeBodyParser);
app.use('/api/shelter-manager/my-shelter', largeBodyParser);

// Images are now stored as base64 in database - no file uploads needed
// Removed: app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging middleware
app.use(requestLogger);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/adoptions', adoptionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/rescue-reports', rescueRoutes);
app.use('/api/shelters', shelterRoutes);
app.use('/api/shelter-transfers', shelterTransferRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rescuer-applications', rescuerApplicationRoutes);
app.use('/api/shelter-applications', shelterApplicationRoutes);
app.use('/api/shelter-manager', shelterManagerRoutes);
app.use('/api/ai', aiRoutes);

// Create notification endpoint (admin only)
const { authenticateAdmin: adminAuth } = require('./middleware/auth');
const { validate: validateBody, schemas: validationSchemas } = require('./middleware/validation');
app.post('/api/notifications', adminAuth, validateBody(validationSchemas.notification), async (req, res) => {
  try {
    const { user_id, type, title, message, data } = req.body;
    
    const result = await db.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [user_id, type, title, message, data ? JSON.stringify(data) : null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating notification:', { error: error.message });
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Health check endpoints (detailed monitoring)
app.use('/api/health', healthRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Pawmilya API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      pets: '/api/pets',
      adoptions: '/api/adoptions',
      rescues: '/api/rescue-reports',
      shelters: '/api/shelters',
      shelterTransfers: '/api/shelter-transfers',
      admin: '/api/admin',
      rescuerApplications: '/api/rescuer-applications',
      ai: '/api/ai',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
  });
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    requestId: req.requestId, // Include request ID for debugging
  });
});

// Start server with EADDRINUSE recovery
function startServer(port) {
  const server = app.listen(port, () => {
    logger.info(`
  ╔═══════════════════════════════════════════╗
  ║     🐾 Pawmilya API Server Started 🐾     ║
  ╠═══════════════════════════════════════════╣
  ║  Server: http://localhost:${port}            ║
  ║  Health: http://localhost:${port}/api/health ║
  ║  Mode: ${(process.env.NODE_ENV || 'development').padEnd(15)}           ║
  ╚═══════════════════════════════════════════╝
    `);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.warn(`Port ${port} is in use, attempting to free it...`);
      const { execSync } = require('child_process');
      try {
        // Find and kill the process using the port (Windows)
        const result = execSync(`netstat -ano | findstr ":${port}" | findstr "LISTENING"`, { encoding: 'utf8' });
        const lines = result.trim().split('\n');
        const pids = [...new Set(lines.map(line => line.trim().split(/\s+/).pop()).filter(pid => pid && pid !== '0'))];
        for (const pid of pids) {
          try {
            execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf8' });
            logger.info(`Killed process ${pid} on port ${port}`);
          } catch (e) { /* process may have already exited */ }
        }
        // Retry after a short delay
        setTimeout(() => startServer(port), 1500);
      } catch (e) {
        logger.error(`Could not free port ${port}. Please manually kill the process and restart.`);
        process.exit(1);
      }
    } else {
      logger.error('Server error:', { error: error.message, stack: error.stack });
    }
  });

  return server;
}

const server = startServer(PORT);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason: String(reason) });
});
