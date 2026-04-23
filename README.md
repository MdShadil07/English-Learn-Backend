# English Practice Backend API

A comprehensive, industry-level backend API for the English learning platform built with Node.js, Express, TypeScript, and MongoDB.

## 🚀 Features

### Authentication & Security
- **JWT Authentication** with access and refresh tokens
- **Password Hashing** using bcrypt with configurable rounds
- **Rate Limiting** to prevent abuse with multiple strategies
- **Input Validation** with comprehensive express-validator schemas
- **CORS Configuration** for frontend integration
- **Helmet Security** headers
- **Request Compression** and logging
- **MongoDB Injection Protection** with query sanitization
- **XSS Protection** with input cleaning
- **HTTP Parameter Pollution Protection**

### Advanced Profile Management System
- **Comprehensive User Profiles** with personal, professional, and educational information
- **Dynamic Profile Completeness** calculation using virtual fields
- **File Upload System** with cloud storage integration (AWS S3, local storage)
- **Document Management** for certificates, resumes, portfolios
- **Social Media Integration** with LinkedIn, GitHub, portfolio links
- **Privacy Settings** with granular control over data sharing
- **Learning Preferences** tracking and management
- **Professional Information** management for career-focused users

### Database Models
- **User Management** with comprehensive profile fields
- **UserProfile Model** with 50+ fields for complete user information
- **Progress Tracking** with XP, levels, and skill metrics
- **Refresh Token Management** for secure authentication
- **User Level System** with streak tracking and achievements

### Performance & Monitoring
- **Redis Caching** for improved performance and reduced database load
- **Performance Monitoring** with request tracking and metrics
- **Health Check Endpoints** for system monitoring
- **Database Transaction Support** for data consistency
- **Optimistic Locking** to prevent concurrent update conflicts
- **Background Job Processing** for heavy operations

### API Endpoints
- **Authentication**: Register, Login, Token Refresh, Logout
- **Profile Management**: Get/Update profile, Change password, Upload files
- **Progress Tracking**: XP calculations, Level progression
- **User Management**: User statistics and management
- **File Management**: Upload, download, and delete user files

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/                 # Configuration files
│   │   ├── database.ts        # MongoDB connection
│   │   ├── redis.ts           # Redis configuration
│   │   ├── auth.ts            # JWT and auth configuration
│   │   └── swagger.ts         # API documentation configuration
│   ├── controllers/           # Route controllers
│   │   ├── Profile/          # Profile management controllers
│   │   ├── Auth/             # Authentication controllers
│   │   └── User/             # User management controllers
│   ├── middleware/           # Custom middleware
│   │   ├── auth.ts          # JWT verification middleware
│   │   ├── validation.ts    # Input validation middleware
│   │   ├── rateLimit.ts     # Rate limiting middleware
│   │   ├── security.ts      # Security middleware
│   │   ├── upload.ts        # File upload middleware
│   │   └── index.ts         # Middleware exports
│   ├── models/              # MongoDB models
│   │   ├── User.ts          # User schema and methods
│   │   ├── UserProfile.ts   # Comprehensive profile schema (50+ fields)
│   │   ├── Progress.ts      # Progress tracking schema
│   │   ├── RefreshToken.ts  # Refresh token schema
│   │   ├── UserLevel.ts     # User level schema
│   │   └── index.ts         # Model exports
│   ├── routes/              # API routes
│   │   ├── Profile/         # Profile routes with file upload
│   │   ├── Auth/            # Authentication routes
│   │   └── index.ts         # Route registration
│   ├── services/            # Business logic services
│   │   ├── Profile/         # Profile service layer with caching
│   │   ├── cloudStorage.ts  # Cloud storage service (AWS S3, local)
│   │   ├── profileUpload.ts # File upload service
│   │   └── index.ts         # Service exports
│   ├── utils/               # Utility functions
│   │   ├── errorHandler.ts  # Enhanced error handling utilities
│   │   ├── performanceMonitor.ts # Performance monitoring system
│   │   └── index.ts         # Utility exports
│   ├── index.ts             # Main server entry point
│   └── types/               # TypeScript type definitions
├── tests/                   # Comprehensive test suites
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   └── e2e/                # End-to-end tests
├── uploads/                # File upload directory (development)
├── logs/                   # Application logs
└── docs/                   # Additional documentation
```

## 🛠️ Installation

### Prerequisites
- Node.js 18+ and npm
- MongoDB (local or cloud instance)
- TypeScript support

### Setup

1. **Clone and install dependencies:**
```bash
cd backend
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:
```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/english-practice
# Or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/english-practice

# Redis Configuration (optional, for caching and performance)
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your-super-secret-refresh-token-key
REFRESH_TOKEN_EXPIRES_IN=30d

# File Upload Configuration
CLOUD_STORAGE_PROVIDER=local
# For AWS S3:
# CLOUD_STORAGE_PROVIDER=aws
# AWS_ACCESS_KEY_ID=your-access-key
# AWS_SECRET_ACCESS_KEY=your-secret-key
# AWS_REGION=us-east-1
# AWS_S3_BUCKET=your-bucket-name

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Security
BCRYPT_ROUNDS=12
API_KEY=your-api-key-for-server-to-server-communication

# Logging
LOG_LEVEL=info
LOG_DIR=./logs

# Performance Monitoring
REQUEST_TIMEOUT=30000
PERFORMANCE_MONITORING=true

# Frontend
FRONTEND_URL=http://localhost:3000
CLIENT_URL=http://localhost:3000
```

3. **Start development server:**
```bash
npm run dev
```

4. **Build for production:**
```bash
npm run build
npm start
```

## 🔧 Configuration

### Database Configuration
The app connects to MongoDB using the URI specified in `MONGODB_URI`. Supports both local and cloud instances.

### Authentication Configuration
- **JWT_SECRET**: Secret key for signing JWT tokens
- **JWT_EXPIRES_IN**: Token expiration time (default: 7d)
- **REFRESH_TOKEN_SECRET**: Secret for refresh tokens
- **REFRESH_TOKEN_EXPIRES_IN**: Refresh token expiration (default: 30d)

### Security Features
- **Rate Limiting**: Configurable request limits per time window
- **Password Security**: bcrypt hashing with configurable rounds
- **Input Validation**: Comprehensive validation using Joi schemas
- **CORS**: Configurable cross-origin resource sharing

## 📚 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe",
  "targetLanguage": "English",
  "nativeLanguage": "Spanish",
  "country": "Spain",
  "proficiencyLevel": "intermediate"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123!"
}
```

#### Refresh Token
```http
POST /api/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

#### Get Profile
```http
GET /api/auth/profile
Authorization: Bearer your-access-token
```

#### Update Profile
```http
PUT /api/profile
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Smith",
  "username": "janesmith",
  "bio": "Learning English for professional development",
  "personalInfo": {
    "dateOfBirth": "1990-01-01",
    "gender": "female",
    "nationality": "USA",
    "phone": "+1234567890"
  },
  "role": "professional",
  "experienceLevel": "intermediate",
  "field": "software-engineer",
  "goals": ["improve-speaking-skills", "business-english"],
  "interests": ["technology", "business", "science"],
  "learningPreferences": {
    "preferredLearningStyle": "visual",
    "dailyLearningGoal": 45,
    "focusAreas": ["speaking", "vocabulary"]
  },
  "privacySettings": {
    "profileVisibility": "public",
    "activityTracking": {
      "trackLearningProgress": true,
      "trackTimeSpent": true
    }
  }
}
```

#### Change Password
```http
POST /api/profile/change-password
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword456"
}
```

#### Upload Avatar
```http
POST /api/profile/avatar
Authorization: Bearer your-access-token
Content-Type: multipart/form-data

avatar: (binary file - JPEG, PNG, WebP, GIF, max 2MB)
```

#### Upload Document
```http
POST /api/profile/document
Authorization: Bearer your-access-token
Content-Type: multipart/form-data

document: (binary file - PDF, DOC, DOCX, TXT, max 10MB)
documentType: "resume" | "certificate" | "portfolio" | "general"
name: "Document Name" (for certificates)
description: "Document description"
issueDate: "2024-01-01" (for certificates)
```

#### Delete File
```http
DELETE /api/profile/file/{fileType}/{fileKey}
Authorization: Bearer your-access-token
```

#### Get File URL
```http
GET /api/profile/file/{fileKey}
Authorization: Bearer your-access-token
```

### Interactive API Documentation
Visit `/api-docs` when the server is running for comprehensive interactive API documentation with Swagger UI.

### Progress Endpoints

#### Calculate XP Reward
```http
POST /api/progress/calculate-xp-reward
Content-Type: application/json

{
  "action": "send_message",
  "multiplier": 1.0,
  "customXP": 10
}
```

#### Get Level Info
```http
POST /api/progress/get-level-info
Content-Type: application/json

{
  "totalXP": 1250
}
```

## 🔐 Security Features

### Authentication
- JWT-based authentication with access and refresh tokens
- Secure password hashing with bcrypt
- Refresh token rotation for enhanced security
- Account lockout protection

### Rate Limiting
- General API rate limiting (100 requests/15 minutes)
- Strict auth rate limiting (5 attempts/15 minutes)
- Password reset rate limiting (3 attempts/hour)

### Input Validation
- Comprehensive validation schemas for all endpoints
- SQL injection protection through parameterized queries
- XSS protection through input sanitization

### Security Headers
- Helmet.js security headers
- CORS configuration
- Content Security Policy

## 🚀 Deployment

### Development
```bash
npm run dev
```
Starts the development server with hot reload using tsx.

### Production
```bash
npm run build
npm start
```
Builds the TypeScript code and starts the production server.

## 🧪 Testing

Run the comprehensive test suite:
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suite
npm run test:profile

# Run tests in watch mode
npm run test:watch

# Run performance tests
npm run test:performance
```

### Test Coverage
- ✅ Unit tests for all services and utilities
- ✅ Integration tests for API endpoints
- ✅ Performance tests for high-load scenarios
- ✅ Security tests for authentication and authorization
- ✅ File upload and validation tests

## 📊 Monitoring & Health Checks

### Health Endpoints
- `GET /health` - Basic health check with system metrics
- `GET /metrics` - Performance metrics and statistics
- `GET /api-docs` - Interactive API documentation (Swagger UI)
- `GET /api-docs.json` - OpenAPI specification

### Performance Monitoring
- Real-time request response time tracking
- Memory usage monitoring and alerts
- Database connection status monitoring
- Cache hit rate monitoring
- Error rate tracking and alerting
- Slow query detection

### Logging System
- Structured logging with multiple levels (error, warn, info, debug)
- Request/response logging with correlation IDs
- Error tracking with stack traces and context
- Security incident logging
- Performance metrics logging
- Log rotation and cleanup

## 🎯 Profile System Features

### Comprehensive User Profiles
The UserProfile model supports 50+ fields including:

- **Basic Information**: Name, avatar, bio, premium status
- **Personal Information**: Date of birth, gender, nationality, languages spoken
- **Professional Information**: Company, position, experience, skills, resume
- **Educational Background**: Institutions, degrees, certifications, grades
- **Learning Preferences**: Learning style, daily/weekly goals, focus areas
- **Privacy Settings**: Visibility controls, activity tracking preferences
- **Social Links**: LinkedIn, GitHub, portfolio, personal website
- **Documents**: File uploads for certificates, resumes, portfolios

### Dynamic Profile Completeness
- Virtual field that calculates completion percentage in real-time
- Based on filled essential fields (name, bio, location, contact info, etc.)
- Updates automatically when profile is modified
- Used for user engagement and feature recommendations

### File Management System
- **Avatar Upload**: Image files (JPEG, PNG, WebP, GIF) up to 2MB
- **Document Upload**: PDF, DOC, DOCX, TXT files up to 10MB
- **Cloud Storage**: AWS S3 integration with local fallback
- **Security**: File type validation, size limits, ownership verification
- **Organization**: Files organized by type and user

### Advanced Features
- **Optimistic Locking**: Prevents concurrent update conflicts
- **Database Transactions**: Ensures data consistency
- **Caching Strategy**: Redis-based caching for performance
- **Search Optimization**: Full-text search with MongoDB text indexes
- **Rate Limiting**: Multiple rate limiting strategies for different operations

## 📈 Performance

- **Database Indexing**: Optimized indexes for fast queries
- **Request Compression**: Automatic response compression
- **Connection Pooling**: MongoDB connection pooling
- **Caching**: JWT token caching for better performance

## 🤝 Contributing

1. Follow the existing code structure
2. Add proper TypeScript types
3. Include comprehensive error handling
4. Write clear documentation
5. Add tests for new features

## 🔄 Migration from Previous Version

If migrating from a previous backend version:
1. Backup your database
2. Update environment variables
3. Run `npm install` to update dependencies
4. The new structure is backward compatible with the frontend

## 📄 License

MIT License - see LICENSE file for details.
