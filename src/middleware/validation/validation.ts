import { body, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

interface ValidationRequest extends Request {
  validationErrors?: any[];
}

// Validation result handler
export const handleValidationErrors = (req: ValidationRequest, res: Response, next: NextFunction): void | Response => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  return next();
};

// Registration validation rules
export const validateRegistration = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ min: 1, max: 255 })
    .withMessage('Email must be between 1 and 255 characters'),

  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),

  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Full name must be between 1 and 100 characters'),

  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),

  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),

  body('targetLanguage')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Target language must be between 1 and 50 characters'),

  body('nativeLanguage')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Native language must be between 1 and 50 characters'),

  body('country')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Country must be between 1 and 100 characters'),

  body('proficiencyLevel')
    .optional()
    .isIn(['beginner', 'elementary', 'intermediate', 'advanced', 'proficient'])
    .withMessage('Proficiency level must be one of: beginner, elementary, intermediate, advanced, proficient'),

  body('role')
    .optional()
    .isIn(['student', 'teacher', 'admin'])
    .withMessage('Role must be one of: student, teacher, admin'),

  handleValidationErrors,
];

// Pagination validation
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),

  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'email', 'firstName', 'lastName', 'level', 'totalXP', 'streak'])
    .withMessage('Invalid sort field'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc', '1', '-1'])
    .withMessage('Sort order must be asc, desc, 1, or -1'),

  handleValidationErrors,
];

// Login validation rules
export const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  handleValidationErrors,
];

// Refresh token validation rules
export const validateRefreshToken = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
    .isString()
    .withMessage('Refresh token must be a string'),

  handleValidationErrors,
];

// Password reset request validation
export const validatePasswordResetRequest = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  handleValidationErrors,
];

// Password reset validation
export const validatePasswordReset = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isString()
    .withMessage('Reset token must be a string'),

  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),

  handleValidationErrors,
];

// Change password validation
export const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),

  handleValidationErrors,
];

// Profile update validation (comprehensive profile system)
export const validateProfileUpdate = [
  // Basic profile fields
  body('displayName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Display name must be between 1 and 100 characters'),

  body('firstName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),

  body('lastName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),

  body('username')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),

  body('bio')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Bio must be between 1 and 2000 characters'),

  body('avatar_url')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^https?:\/\/.+/)
    .withMessage('Avatar URL must be a valid HTTP/HTTPS URL'),

  body('isPremium')
    .optional()
    .isBoolean()
    .withMessage('Premium status must be a boolean'),

  body('experienceLevel')
    .optional({ checkFalsy: true })
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Experience level must be one of: beginner, intermediate, advanced'),

  body('field')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 0, max: 100 })
    .withMessage('Field of study/expertise must be between 0 and 100 characters'),

  // Language and Learning Information
  body('targetLanguage')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Target language must be between 1 and 50 characters'),

  body('nativeLanguage')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Native language must be between 1 and 50 characters'),

  body('country')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Country must be between 1 and 100 characters'),

  body('proficiencyLevel')
    .optional({ checkFalsy: true })
    .isIn(['beginner', 'elementary', 'intermediate', 'advanced', 'proficient'])
    .withMessage('Proficiency level must be one of: beginner, elementary, intermediate, advanced, proficient'),

  // Personal Information validation
  body('personalInfo.dateOfBirth')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Date of birth must be a valid ISO 8601 date'),

  body('personalInfo.gender')
    .optional({ checkFalsy: true })
    .isIn(['male', 'female', 'non-binary', 'prefer-not-to-say', 'other'])
    .withMessage('Gender must be one of: male, female, non-binary, prefer-not-to-say, other'),

  body('personalInfo.address.street')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Street address must be between 1 and 200 characters'),

  body('personalInfo.address.city')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('City must be between 1 and 100 characters'),

  body('personalInfo.address.state')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('State must be between 1 and 100 characters'),

  body('personalInfo.address.country')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Country must be between 1 and 100 characters'),

  body('personalInfo.address.zipCode')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('ZIP code must be between 1 and 20 characters'),

  body('personalInfo.languages')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Languages array cannot have more than 10 entries'),

  body('personalInfo.languages.*.language')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Language name must be between 1 and 50 characters'),

  body('personalInfo.languages.*.proficiency')
    .optional({ checkFalsy: true })
    .isIn(['beginner', 'intermediate', 'advanced', 'native'])
    .withMessage('Language proficiency must be one of: beginner, intermediate, advanced, native'),

  // Goals and Interests
  body('goals')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Goals array cannot have more than 20 entries'),

  body('interests')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Interests array cannot have more than 20 entries'),

  // Professional Information
  body('professionalInfo.company')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Company name must be between 1 and 100 characters'),

  body('professionalInfo.position')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Position must be between 1 and 100 characters'),

  body('professionalInfo.industry')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Industry must be between 1 and 100 characters'),

  body('professionalInfo.skills')
    .optional()
    .isArray({ max: 30 })
    .withMessage('Skills array cannot have more than 30 entries'),

  body('professionalInfo.experienceYears')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Experience years must be between 0 and 50'),

  // Educational Information
  body('education')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Education array cannot have more than 20 entries'),

  body('education.*.institution')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Institution name must be between 1 and 200 characters'),

  body('education.*.degree')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Degree must be between 1 and 100 characters'),

  body('education.*.fieldOfStudy')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Field of study must be between 1 and 100 characters'),

  body('education.*.startYear')
    .optional()
    .isInt({ min: 1900, max: 2030 })
    .withMessage('Start year must be between 1900 and 2030'),

  body('education.*.endYear')
    .optional()
    .isInt({ min: 1900, max: 2030 })
    .withMessage('End year must be between 1900 and 2030'),

  body('education.*.grade')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Grade must be between 1 and 50 characters'),

  body('education.*.educationLevel')
    .optional()
    .isIn(['high-school', 'associate-degree', 'bachelors-degree', 'masters-degree', 'phd', 'certificate', 'diploma', 'other'])
    .withMessage('Education level must be one of the predefined options'),

  // Certifications
  body('certifications')
    .optional()
    .isArray({ max: 50 })
    .withMessage('Certifications array cannot have more than 50 entries'),

  body('certifications.*.name')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Certification name must be between 1 and 200 characters'),

  body('certifications.*.issuer')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Certification issuer must be between 1 and 200 characters'),

  body('certifications.*.issueDate')
    .optional()
    .isISO8601()
    .withMessage('Issue date must be a valid ISO 8601 date'),

  body('certifications.*.expiryDate')
    .optional()
    .isISO8601()
    .withMessage('Expiry date must be a valid ISO 8601 date'),

  body('certifications.*.credentialId')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Credential ID must be between 1 and 100 characters'),

  body('certifications.*.skills')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Certification skills array cannot have more than 20 entries'),

  // Social Links
  body('socialLinks')
    .optional()
    .isObject()
    .withMessage('Social links must be an object'),

  body('socialLinks.linkedin')
    .optional()
    .trim()
    .matches(/^https?:\/\/.+/)
    .withMessage('LinkedIn URL must be a valid HTTP/HTTPS URL'),

  body('socialLinks.github')
    .optional()
    .trim()
    .matches(/^https?:\/\/.+/)
    .withMessage('GitHub URL must be a valid HTTP/HTTPS URL'),

  body('socialLinks.website')
    .optional()
    .trim()
    .matches(/^https?:\/\/.+/)
    .withMessage('Website URL must be a valid HTTP/HTTPS URL'),

  // Learning Preferences
  body('learningPreferences.preferredLearningStyle')
    .optional()
    .isIn(['visual', 'auditory', 'kinesthetic', 'reading-writing', 'mixed'])
    .withMessage('Learning style must be one of: visual, auditory, kinesthetic, reading-writing, mixed'),

  body('learningPreferences.dailyLearningGoal')
    .optional()
    .isInt({ min: 5, max: 480 })
    .withMessage('Daily learning goal must be between 5 and 480 minutes'),

  body('learningPreferences.weeklyLearningGoal')
    .optional()
    .isInt({ min: 35, max: 3360 })
    .withMessage('Weekly learning goal must be between 35 and 3360 minutes'),

  body('learningPreferences.targetEnglishLevel')
    .optional()
    .isIn(['beginner', 'elementary', 'intermediate', 'advanced', 'proficient', 'native'])
    .withMessage('Target English level must be one of: beginner, elementary, intermediate, advanced, proficient, native'),

  body('learningPreferences.focusAreas')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Focus areas array cannot have more than 10 entries'),

  // Privacy Settings
  body('privacySettings.profileVisibility')
    .optional()
    .isIn(['public', 'friends-only', 'private'])
    .withMessage('Profile visibility must be one of: public, friends-only, private'),

  body('privacySettings.showContactInfo')
    .optional()
    .isBoolean()
    .withMessage('Show contact info must be a boolean'),

  body('privacySettings.showEducation')
    .optional()
    .isBoolean()
    .withMessage('Show education must be a boolean'),

  body('privacySettings.showCertifications')
    .optional()
    .isBoolean()
    .withMessage('Show certifications must be a boolean'),

  body('privacySettings.showAchievements')
    .optional()
    .isBoolean()
    .withMessage('Show achievements must be a boolean'),

  handleValidationErrors,
];

// User profile update validation (for /user/profile endpoint)
export const validateUserProfileUpdate = [
  body('firstName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),

  body('lastName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),

  body('username')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),

  handleValidationErrors,
];
