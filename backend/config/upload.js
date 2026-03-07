const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
const rescueUploadsDir = path.join(uploadsDir, 'rescues');
const avatarsDir = path.join(uploadsDir, 'avatars');
const petsDir = path.join(uploadsDir, 'pets');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(rescueUploadsDir)) {
  fs.mkdirSync(rescueUploadsDir, { recursive: true });
}

if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

if (!fs.existsSync(petsDir)) {
  fs.mkdirSync(petsDir, { recursive: true });
}

// Configure storage for rescue images
const rescueStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, rescueUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// Configure storage for avatar images
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `avatar_${req.user.id}_${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// Configure storage for pet images
const petStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, petsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `pet_${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter for images only
const imageFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'), false);
  }
};

// Multer upload configurations
const uploadRescueImages = multer({
  storage: rescueStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 5, // Max 5 files at once
  },
});

// Avatar upload configuration
const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 1,
  },
});

// Pet images upload configuration
const uploadPetImages = multer({
  storage: petStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 5, // Max 5 files at once
  },
});

module.exports = {
  uploadRescueImages,
  uploadAvatar,
  uploadPetImages,
  uploadsDir,
  rescueUploadsDir,
  avatarsDir,
  petsDir,
};
