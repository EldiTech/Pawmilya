const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ===========================================
// CLOUD STORAGE ABSTRACTION LAYER
// ===========================================
// This module provides a unified interface for file storage.
// Currently implements local storage, but can be extended for:
// - AWS S3
// - Google Cloud Storage
// - Azure Blob Storage
// - Cloudinary

const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local';
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Ensure upload directory exists
if (STORAGE_TYPE === 'local' && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ===========================================
// STORAGE INTERFACE
// ===========================================

class StorageProvider {
  async upload(file, options = {}) {
    throw new Error('upload() must be implemented');
  }

  async delete(fileKey) {
    throw new Error('delete() must be implemented');
  }

  async getUrl(fileKey) {
    throw new Error('getUrl() must be implemented');
  }
}

// ===========================================
// LOCAL FILE STORAGE
// ===========================================

class LocalStorage extends StorageProvider {
  constructor() {
    super();
    this.baseDir = UPLOAD_DIR;
    this.baseUrl = BASE_URL;
  }

  async upload(fileData, options = {}) {
    const {
      folder = 'general',
      filename = null,
      contentType = null,
    } = options;

    // Generate unique filename
    const ext = this._getExtension(contentType) || '.jpg';
    const uniqueName = filename || `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
    
    // Create folder if needed
    const folderPath = path.join(this.baseDir, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const filePath = path.join(folderPath, uniqueName);
    const fileKey = `${folder}/${uniqueName}`;

    // Handle different input types
    if (Buffer.isBuffer(fileData)) {
      fs.writeFileSync(filePath, fileData);
    } else if (typeof fileData === 'string') {
      // Check if it's base64
      if (fileData.startsWith('data:')) {
        const base64Data = fileData.split(',')[1];
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
      } else if (fileData.startsWith('/') || fileData.includes('\\')) {
        // It's a file path, copy the file
        fs.copyFileSync(fileData, filePath);
      } else {
        // Assume it's raw base64
        fs.writeFileSync(filePath, Buffer.from(fileData, 'base64'));
      }
    }

    return {
      key: fileKey,
      url: `${this.baseUrl}/uploads/${fileKey}`,
      size: fs.statSync(filePath).size,
    };
  }

  async delete(fileKey) {
    const filePath = path.join(this.baseDir, fileKey);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    
    return false;
  }

  async getUrl(fileKey) {
    const filePath = path.join(this.baseDir, fileKey);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    return `${this.baseUrl}/uploads/${fileKey}`;
  }

  async exists(fileKey) {
    const filePath = path.join(this.baseDir, fileKey);
    return fs.existsSync(filePath);
  }

  _getExtension(contentType) {
    const extensions = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    return extensions[contentType] || null;
  }
}

// ===========================================
// AWS S3 STORAGE (placeholder for future)
// ===========================================

class S3Storage extends StorageProvider {
  constructor() {
    super();
    // Requires: npm install @aws-sdk/client-s3
    // this.client = new S3Client({ region: process.env.AWS_REGION });
    // this.bucket = process.env.S3_BUCKET;
    console.warn('S3Storage: Not fully implemented. Install @aws-sdk/client-s3');
  }

  async upload(fileData, options = {}) {
    throw new Error('S3 storage not configured. Set STORAGE_TYPE=local or configure AWS credentials.');
  }

  async delete(fileKey) {
    throw new Error('S3 storage not configured.');
  }

  async getUrl(fileKey) {
    throw new Error('S3 storage not configured.');
  }
}

// ===========================================
// CLOUDINARY STORAGE (placeholder for future)
// ===========================================

class CloudinaryStorage extends StorageProvider {
  constructor() {
    super();
    // Requires: npm install cloudinary
    console.warn('CloudinaryStorage: Not fully implemented. Install cloudinary package.');
  }

  async upload(fileData, options = {}) {
    throw new Error('Cloudinary storage not configured. Set STORAGE_TYPE=local or configure Cloudinary credentials.');
  }

  async delete(fileKey) {
    throw new Error('Cloudinary storage not configured.');
  }

  async getUrl(fileKey) {
    throw new Error('Cloudinary storage not configured.');
  }
}

// ===========================================
// STORAGE FACTORY
// ===========================================

function createStorage() {
  switch (STORAGE_TYPE.toLowerCase()) {
    case 's3':
    case 'aws':
      return new S3Storage();
    case 'cloudinary':
      return new CloudinaryStorage();
    case 'local':
    default:
      return new LocalStorage();
  }
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Convert base64 image to storage URL
 * @param {string} base64Data - Base64 encoded image data
 * @param {object} options - Upload options (folder, filename)
 * @returns {Promise<string>} - URL of uploaded image
 */
async function uploadBase64Image(base64Data, options = {}) {
  if (!base64Data) return null;
  
  // If already a URL, return as-is
  if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
    return base64Data;
  }
  
  const storage = createStorage();
  const result = await storage.upload(base64Data, options);
  return result.url;
}

/**
 * Delete an image from storage
 * @param {string} fileUrl - URL or key of the file
 * @returns {Promise<boolean>} - Success status
 */
async function deleteImage(fileUrl) {
  if (!fileUrl) return false;
  
  // Extract key from URL
  const key = fileUrl.includes('/uploads/') 
    ? fileUrl.split('/uploads/')[1]
    : fileUrl;
  
  const storage = createStorage();
  return storage.delete(key);
}

/**
 * Get the optimal image format based on request
 * @param {string} accept - Accept header from request
 * @returns {string} - Content type to use
 */
function getOptimalFormat(accept = '') {
  if (accept.includes('image/webp')) return 'image/webp';
  if (accept.includes('image/avif')) return 'image/avif';
  return 'image/jpeg';
}

// Export singleton instance and utilities
const storage = createStorage();

module.exports = {
  storage,
  createStorage,
  uploadBase64Image,
  deleteImage,
  getOptimalFormat,
  LocalStorage,
  S3Storage,
  CloudinaryStorage,
};
