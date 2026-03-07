const Joi = require('joi');

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

// Password requirements:
// - Minimum 8 characters
// - At least one uppercase letter
// - At least one lowercase letter
// - At least one number
// - At least one special character
const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password cannot exceed 128 characters',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
    'any.required': 'Password is required',
  });

// Email schema
const emailSchema = Joi.string()
  .email()
  .max(255)
  .required()
  .messages({
    'string.email': 'Please provide a valid email address',
    'string.max': 'Email cannot exceed 255 characters',
    'any.required': 'Email is required',
  });

// Phone schema (Philippine format)
const phoneSchema = Joi.string()
  .pattern(/^(\+63|0)?[0-9]{10,11}$/)
  .required()
  .messages({
    'string.pattern.base': 'Please provide a valid phone number',
    'any.required': 'Phone number is required',
  });

// ===========================================
// AUTH VALIDATION SCHEMAS
// ===========================================

const registerSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: Joi.string()
    .min(2)
    .max(100)
    .pattern(/^[a-zA-Z\s\-']+$/)
    .required()
    .messages({
      'string.min': 'Full name must be at least 2 characters',
      'string.max': 'Full name cannot exceed 100 characters',
      'string.pattern.base': 'Full name can only contain letters, spaces, hyphens, and apostrophes',
      'any.required': 'Full name is required',
    }),
  phone: phoneSchema,
});

const loginSchema = Joi.object({
  email: emailSchema,
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});

// ===========================================
// USER VALIDATION SCHEMAS
// ===========================================

const updateProfileSchema = Joi.object({
  full_name: Joi.string().min(2).max(100).pattern(/^[a-zA-Z\s\-']+$/).allow(''),
  phone: Joi.string().pattern(/^(\+63|0)?[0-9]{10,11}$/).allow(''),
  address: Joi.string().max(500).allow(''),
  city: Joi.string().max(100).allow(''),
  state: Joi.string().max(100).allow(''),
  date_of_birth: Joi.date().max('now').allow(null),
  bio: Joi.string().max(1000).allow(''),
});

const changePasswordSchema = Joi.object({
  current_password: Joi.string().required(),
  new_password: passwordSchema,
});

// ===========================================
// ADOPTION VALIDATION SCHEMAS
// ===========================================

const adoptionApplicationSchema = Joi.object({
  pet_id: Joi.number().integer().positive().required(),
  living_situation: Joi.string().max(100).required(),
  has_yard: Joi.boolean(),
  yard_fenced: Joi.boolean(),
  rental_allows_pets: Joi.boolean(),
  household_members: Joi.number().integer().min(1).max(20),
  has_children: Joi.boolean(),
  children_ages: Joi.string().max(200),
  has_other_pets: Joi.boolean(),
  other_pets_details: Joi.string().max(500),
  previous_pet_experience: Joi.string().max(1000),
  reason_for_adoption: Joi.string().max(2000).required(),
  work_schedule: Joi.string().max(500),
  emergency_contact_name: Joi.string().max(100).required(),
  emergency_contact_phone: Joi.string().pattern(/^(\+63|0)?[0-9]{10,11}$/).required(),
  veterinarian_name: Joi.string().max(100),
  veterinarian_phone: Joi.string().pattern(/^(\+63|0)?[0-9]{10,11}$/),
  additional_notes: Joi.string().max(2000),
});

// ===========================================
// RESCUE REPORT VALIDATION SCHEMAS
// ===========================================

const rescueReportSchema = Joi.object({
  title: Joi.string().min(5).max(200).required(),
  description: Joi.string().min(10).max(2000).required(),
  animal_type: Joi.string().max(50),
  estimated_count: Joi.number().integer().min(1).max(100),
  condition: Joi.string().valid('injured', 'sick', 'healthy', 'unknown'),
  urgency: Joi.string().valid('critical', 'high', 'normal', 'low'),
  location_description: Joi.string().min(5).max(500).required(),
  address: Joi.string().max(500),
  city: Joi.string().max(100),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  reporter_name: Joi.string().max(100),
  reporter_phone: Joi.string().pattern(/^(\+63|0)?[0-9]{10,11}$/),
  reporter_email: Joi.string().email().max(255),
  images: Joi.array().items(Joi.string()).max(5),
});

// ===========================================
// ===========================================
// RESCUER APPLICATION VALIDATION SCHEMAS
// ===========================================

const rescuerApplicationSchema = Joi.object({
  full_name: Joi.string().min(2).max(100).required(),
  phone: Joi.string().pattern(/^(\+63|0)?[0-9]{10,11}$/).required(),
  address: Joi.string().max(500).required(),
  city: Joi.string().max(100).required(),
  experience: Joi.string().max(2000),
  reason: Joi.string().max(2000).required(),
  availability: Joi.string().max(200),
  transportation_type: Joi.string().max(100),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
});

// ===========================================
// PET VALIDATION SCHEMAS
// ===========================================

const petSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  category_id: Joi.number().integer().positive(),
  breed_id: Joi.number().integer().positive(),
  breed_name: Joi.string().max(100),
  gender: Joi.string().valid('male', 'female'),
  size: Joi.string().valid('small', 'medium', 'large', 'extra_large'),
  color: Joi.string().max(100),
  age_years: Joi.number().integer().min(0).max(30),
  age_months: Joi.number().integer().min(0).max(11),
  description: Joi.string().max(2000),
  location: Joi.string().max(500),
  adoption_fee: Joi.number().min(0),
  shelter_id: Joi.number().integer().positive(),
  vaccination_status: Joi.string().valid('none', 'partial', 'complete'),
  is_neutered: Joi.boolean(),
  is_house_trained: Joi.boolean(),
  is_good_with_kids: Joi.boolean(),
  is_good_with_other_pets: Joi.boolean(),
  special_needs: Joi.string().max(1000),
  images: Joi.array().items(Joi.string()).max(10),
});

// ===========================================
// SHELTER VALIDATION SCHEMAS
// ===========================================

const shelterSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  description: Joi.string().max(2000),
  address: Joi.string().max(500).required(),
  city: Joi.string().max(100).required(),
  state: Joi.string().max(100),
  postal_code: Joi.string().max(20),
  phone: Joi.string().pattern(/^(\+63|0)?[0-9]{10,11}$/),
  email: Joi.string().email().max(255),
  website: Joi.string().uri().max(500),
  operating_hours: Joi.string().max(500),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  capacity: Joi.number().integer().min(0),
  images: Joi.array().items(Joi.string()).max(10),
});

// ===========================================
// PAYMENT VALIDATION SCHEMAS
// ===========================================

const paymentSchema = Joi.object({
  paymentAmount: Joi.number().min(0).required(),
  deliveryDetails: Joi.object({
    fullName: Joi.string().min(2).max(100).required(),
    phone: Joi.string().pattern(/^(\+63|0)?[0-9]{10,11}$/).required(),
    address: Joi.string().max(500).required(),
    city: Joi.string().max(100).required(),
    postalCode: Joi.string().max(20),
    notes: Joi.string().max(1000),
  }).required(),
});

// ===========================================
// NOTIFICATION VALIDATION SCHEMAS
// ===========================================

const notificationSchema = Joi.object({
  type: Joi.string().max(50).required(),
  title: Joi.string().max(200).required(),
  message: Joi.string().max(1000).required(),
  data: Joi.object(),
});

// ===========================================
// VALIDATION MIDDLEWARE
// ===========================================

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Return all errors
      stripUnknown: true, // Remove unknown fields
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
    }

    // Replace req.body with validated and sanitized value
    req.body = value;
    next();
  };
};

// ===========================================
// SHELTER APPLICATION VALIDATION SCHEMAS
// ===========================================

const shelterApplicationSchema = Joi.object({
  shelter_name: Joi.string().min(2).max(200).required(),
  shelter_type: Joi.string().valid('government', 'private', 'ngo', 'rescue_group'),
  description: Joi.string().max(2000),
  address: Joi.string().max(500).required(),
  city: Joi.string().max(100).required(),
  state: Joi.string().max(100).allow('', null),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  contact_person_name: Joi.string().max(100),
  phone: Joi.string().pattern(/^(\+63|0)?[0-9]{10,11}$/),
  email: Joi.string().email().max(255),
  animals_accepted: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
  shelter_capacity: Joi.number().integer().min(0).max(10000),
  services_offered: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()),
  operating_hours: Joi.string().max(500),
  logo_image: Joi.string().allow('', null),
  cover_image: Joi.string().allow('', null),
  business_permit: Joi.string().allow('', null),
  registration_certificate: Joi.string().allow('', null),
  government_id: Joi.string().allow('', null),
  other_documents: Joi.string().allow('', null),
});

// ===========================================
// EXPORTS
// ===========================================

module.exports = {
  validate,
  schemas: {
    register: registerSchema,
    login: loginSchema,
    updateProfile: updateProfileSchema,
    changePassword: changePasswordSchema,
    adoptionApplication: adoptionApplicationSchema,
    rescueReport: rescueReportSchema,
    rescuerApplication: rescuerApplicationSchema,
    shelterApplication: shelterApplicationSchema,
    pet: petSchema,
    shelter: shelterSchema,
    payment: paymentSchema,
    notification: notificationSchema,
  },
};
