const winston = require('winston');
const path = require('path');
const crypto = require('crypto');

// Generate unique request ID
const generateRequestId = () => {
  return crypto.randomBytes(8).toString('hex');
};

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, requestId, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]`;
    
    // Add request ID if present
    if (requestId) {
      log += ` [${requestId}]`;
    }
    
    log += `: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Define log format for JSON (production)
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports based on environment
const transports = [];

// Console transport - always enabled
transports.push(
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    ),
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  })
);

// File transports - only in production or if LOG_TO_FILE is set
if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      format: jsonFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Stream for Morgan HTTP logging (if needed later)
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Helper methods for common logging patterns
logger.logRequest = (req, message = 'Request received') => {
  logger.info(message, {
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection?.remoteAddress,
    userId: req.user?.id || req.admin?.id || 'anonymous',
  });
};

logger.logError = (error, req = null) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
  };

  if (req) {
    errorInfo.method = req.method;
    errorInfo.path = req.path;
    errorInfo.userId = req.user?.id || req.admin?.id || 'anonymous';
  }

  logger.error('Error occurred', errorInfo);
};

logger.logAuth = (action, userId, success, details = {}) => {
  const level = success ? 'info' : 'warn';
  logger[level](`Auth: ${action}`, {
    userId,
    success,
    ...details,
  });
};

logger.logAdmin = (action, adminId, entityType, entityId, details = {}) => {
  logger.info(`Admin action: ${action}`, {
    adminId,
    entityType,
    entityId,
    ...details,
  });
};

// ===========================================
// REQUEST LOGGING MIDDLEWARE
// ===========================================

const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Generate unique request ID for tracking
  req.requestId = generateRequestId();
  
  // Add request ID to response headers for client-side debugging
  res.setHeader('X-Request-ID', req.requestId);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel]('Request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection?.remoteAddress,
      userId: req.user?.id || req.admin?.id || 'anonymous',
    });
  });

  next();
};

// ===========================================
// REQUEST ID MIDDLEWARE (for use in other routes)
// ===========================================

const attachRequestId = (req, res, next) => {
  if (!req.requestId) {
    req.requestId = generateRequestId();
    res.setHeader('X-Request-ID', req.requestId);
  }
  next();
};

module.exports = {
  logger,
  requestLogger,
  attachRequestId,
  generateRequestId,
};
