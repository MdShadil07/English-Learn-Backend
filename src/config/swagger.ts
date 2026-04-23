import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'English Practice Learning Platform API',
    version: '1.0.0',
    description: 'Comprehensive API for the English Practice Learning Platform - A full-featured language learning system with user management, profile management, progress tracking, and more.',
    contact: {
      name: 'English Practice Team',
      email: 'support@englishpractice.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:5000/api',
      description: 'Development server'
    },
    {
      url: 'https://api.englishpractice.com',
      description: 'Production server'
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT Authorization header using the Bearer scheme. Enter your token in the text input below.'
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API Key for server-to-server authentication'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', description: 'User ID' },
          email: { type: 'string', format: 'email', description: 'User email address' },
          firstName: { type: 'string', description: 'First name' },
          lastName: { type: 'string', description: 'Last name' },
          username: { type: 'string', description: 'Username' },
          avatar: { type: 'string', description: 'Avatar URL' },
          dateOfBirth: { type: 'string', format: 'date', description: 'Date of birth' },
          country: { type: 'string', description: 'Country' },
          nativeLanguage: { type: 'string', description: 'Native language' },
          targetLanguage: { type: 'string', description: 'Target language' },
          proficiencyLevel: {
            type: 'string',
            enum: ['beginner', 'elementary', 'intermediate', 'advanced', 'proficient'],
            description: 'Proficiency level'
          },
          isEmailVerified: { type: 'boolean', description: 'Email verification status' },
          isActive: { type: 'boolean', description: 'Account active status' },
          lastLoginAt: { type: 'string', format: 'date-time', description: 'Last login timestamp' },
          createdAt: { type: 'string', format: 'date-time', description: 'Account creation date' },
          updatedAt: { type: 'string', format: 'date-time', description: 'Last update date' }
        }
      },
      UserProfile: {
        type: 'object',
        properties: {
          _id: { type: 'string', description: 'Profile ID' },
          userId: { type: 'string', description: 'Associated user ID' },
          full_name: { type: 'string', description: 'Full name' },
          avatar_url: { type: 'string', description: 'Avatar URL' },
          bio: { type: 'string', description: 'User biography' },
          isPremium: { type: 'boolean', description: 'Premium status' },
          location: { type: 'string', description: 'Location' },
          phone: { type: 'string', description: 'Phone number' },
          address: { type: 'string', description: 'Address' },
          personalInfo: { $ref: '#/components/schemas/PersonalInfo' },
          role: {
            type: 'string',
            enum: ['student', 'teacher', 'professional', 'admin', 'content-creator'],
            description: 'User role'
          },
          experienceLevel: {
            type: 'string',
            enum: ['beginner', 'intermediate', 'advanced'],
            description: 'Experience level'
          },
          field: { type: 'string', description: 'Field of expertise' },
          goals: { type: 'array', items: { type: 'string' }, description: 'Learning goals' },
          interests: { type: 'array', items: { type: 'string' }, description: 'Interests' },
          professionalInfo: { $ref: '#/components/schemas/ProfessionalInfo' },
          education: { type: 'array', items: { $ref: '#/components/schemas/Education' }, description: 'Education history' },
          certifications: { type: 'array', items: { $ref: '#/components/schemas/Certification' }, description: 'Certifications' },
          documents: { type: 'array', items: { $ref: '#/components/schemas/Document' }, description: 'User documents' },
          socialLinks: { $ref: '#/components/schemas/SocialLinks' },
          learningPreferences: { $ref: '#/components/schemas/LearningPreferences' },
          privacySettings: { $ref: '#/components/schemas/PrivacySettings' },
          lastActivityAt: { type: 'string', format: 'date-time', description: 'Last activity timestamp' },
          createdAt: { type: 'string', format: 'date-time', description: 'Profile creation date' },
          updatedAt: { type: 'string', format: 'date-time', description: 'Last update date' }
        }
      },
      PersonalInfo: {
        type: 'object',
        properties: {
          dateOfBirth: { type: 'string', format: 'date', description: 'Date of birth' },
          gender: {
            type: 'string',
            enum: ['male', 'female', 'non-binary', 'prefer-not-to-say', 'other'],
            description: 'Gender'
          },
          phone: { type: 'string', description: 'Phone number' },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              state: { type: 'string' },
              country: { type: 'string' },
              zipCode: { type: 'string' }
            }
          },
          nationality: { type: 'string', description: 'Nationality' },
          languages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                language: { type: 'string' },
                proficiency: {
                  type: 'string',
                  enum: ['beginner', 'intermediate', 'advanced', 'native']
                }
              }
            }
          }
        }
      },
      ProfessionalInfo: {
        type: 'object',
        properties: {
          company: { type: 'string', description: 'Company name' },
          position: { type: 'string', description: 'Job position' },
          experienceYears: { type: 'number', minimum: 0, maximum: 50, description: 'Years of experience' },
          industry: { type: 'string', description: 'Industry' },
          skills: { type: 'array', items: { type: 'string' }, description: 'Professional skills' },
          interests: { type: 'array', items: { type: 'string' }, description: 'Professional interests' },
          careerGoals: { type: 'string', description: 'Career goals' },
          resumeUrl: { type: 'string', description: 'Resume/CV URL' }
        }
      },
      Education: {
        type: 'object',
        properties: {
          institution: { type: 'string', description: 'Educational institution' },
          degree: { type: 'string', description: 'Degree obtained' },
          fieldOfStudy: { type: 'string', description: 'Field of study' },
          startYear: { type: 'number', description: 'Start year' },
          endYear: { type: 'number', description: 'End year' },
          grade: { type: 'string', description: 'Grade/GPA' },
          description: { type: 'string', description: 'Description' },
          isCurrentlyEnrolled: { type: 'boolean', description: 'Currently enrolled' },
          educationLevel: {
            type: 'string',
            enum: ['high-school', 'associate-degree', 'bachelors-degree', 'masters-degree', 'phd', 'certificate', 'diploma', 'other']
          }
        }
      },
      Certification: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Certification name' },
          issuer: { type: 'string', description: 'Issuing organization' },
          issueDate: { type: 'string', format: 'date', description: 'Issue date' },
          expiryDate: { type: 'string', format: 'date', description: 'Expiry date' },
          credentialId: { type: 'string', description: 'Credential ID' },
          credentialUrl: { type: 'string', description: 'Credential URL' },
          description: { type: 'string', description: 'Description' },
          skills: { type: 'array', items: { type: 'string' }, description: 'Related skills' },
          isVerified: { type: 'boolean', description: 'Verification status' }
        }
      },
      Document: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Document name' },
          url: { type: 'string', description: 'Document URL' },
          type: {
            type: 'string',
            enum: ['certificate', 'resume', 'portfolio', 'general'],
            description: 'Document type'
          },
          size: { type: 'number', description: 'File size in bytes' },
          uploadedAt: { type: 'string', format: 'date-time', description: 'Upload timestamp' }
        }
      },
      SocialLinks: {
        type: 'object',
        properties: {
          linkedin: { type: 'string', description: 'LinkedIn profile URL' },
          github: { type: 'string', description: 'GitHub profile URL' },
          twitter: { type: 'string', description: 'Twitter profile URL' },
          website: { type: 'string', description: 'Personal website URL' },
          instagram: { type: 'string', description: 'Instagram profile URL' },
          youtube: { type: 'string', description: 'YouTube channel URL' },
          portfolio: { type: 'string', description: 'Portfolio URL' },
          other: { type: 'string', description: 'Other social media URL' }
        }
      },
      LearningPreferences: {
        type: 'object',
        properties: {
          preferredLearningStyle: {
            type: 'string',
            enum: ['visual', 'auditory', 'kinesthetic', 'reading-writing', 'mixed'],
            description: 'Preferred learning style'
          },
          dailyLearningGoal: { type: 'number', minimum: 5, maximum: 480, description: 'Daily learning goal in minutes' },
          weeklyLearningGoal: { type: 'number', minimum: 35, maximum: 3360, description: 'Weekly learning goal in minutes' },
          targetEnglishLevel: {
            type: 'string',
            enum: ['beginner', 'elementary', 'intermediate', 'advanced', 'proficient', 'native'],
            description: 'Target English level'
          },
          focusAreas: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['speaking', 'listening', 'reading', 'writing', 'grammar', 'vocabulary', 'pronunciation', 'business-english', 'academic-english']
            },
            description: 'Focus areas'
          }
        }
      },
      PrivacySettings: {
        type: 'object',
        properties: {
          profileVisibility: {
            type: 'string',
            enum: ['public', 'friends-only', 'private'],
            description: 'Profile visibility setting'
          },
          showContactInfo: { type: 'boolean', description: 'Show contact information' },
          showEducation: { type: 'boolean', description: 'Show education' },
          showCertifications: { type: 'boolean', description: 'Show certifications' },
          showAchievements: { type: 'boolean', description: 'Show achievements' },
          activityTracking: { $ref: '#/components/schemas/ActivityTracking' },
          communicationPreferences: { $ref: '#/components/schemas/CommunicationPreferences' },
          security: { $ref: '#/components/schemas/SecuritySettings' },
          dataManagement: { $ref: '#/components/schemas/DataManagement' },
          dataSharing: { $ref: '#/components/schemas/DataSharing' },
          emergency: { $ref: '#/components/schemas/EmergencySettings' }
        }
      },
      ActivityTracking: {
        type: 'object',
        properties: {
          trackLearningProgress: { type: 'boolean' },
          trackTimeSpent: { type: 'boolean' },
          trackCourseCompletions: { type: 'boolean' },
          trackQuizResults: { type: 'boolean' },
          trackLoginHistory: { type: 'boolean' },
          trackDeviceInfo: { type: 'boolean' },
          trackLocationData: { type: 'boolean' }
        }
      },
      CommunicationPreferences: {
        type: 'object',
        properties: {
          emailNotifications: { type: 'boolean' },
          pushNotifications: { type: 'boolean' },
          smsNotifications: { type: 'boolean' },
          marketingEmails: { type: 'boolean' },
          weeklyReports: { type: 'boolean' },
          achievementAlerts: { type: 'boolean' },
          reminderNotifications: { type: 'boolean' }
        }
      },
      SecuritySettings: {
        type: 'object',
        properties: {
          twoFactorEnabled: { type: 'boolean' },
          loginAlerts: { type: 'boolean' },
          suspiciousActivityAlerts: { type: 'boolean' },
          sessionTimeout: { type: 'number', minimum: 15, maximum: 1440 }
        }
      },
      DataManagement: {
        type: 'object',
        properties: {
          autoDeleteInactive: { type: 'boolean' },
          dataRetentionPeriod: { type: 'number', minimum: 6, maximum: 60 },
          downloadData: { type: 'boolean' },
          deleteAccount: { type: 'boolean' }
        }
      },
      DataSharing: {
        type: 'object',
        properties: {
          shareWithPartners: { type: 'boolean' },
          shareAnonymousUsage: { type: 'boolean' },
          shareForResearch: { type: 'boolean' },
          allowPersonalization: { type: 'boolean' },
          thirdPartyIntegrations: { type: 'boolean' }
        }
      },
      EmergencySettings: {
        type: 'object',
        properties: {
          emergencyContact: { type: 'string' },
          emergencyPhone: { type: 'string' },
          emergencyEmail: { type: 'string' },
          allowEmergencyAccess: { type: 'boolean' }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', description: 'Error message' },
          error: { type: 'string', description: 'Error type' },
          timestamp: { type: 'string', format: 'date-time', description: 'Error timestamp' },
          requestId: { type: 'string', description: 'Request ID for tracking' },
          path: { type: 'string', description: 'Request path' },
          method: { type: 'string', description: 'Request method' }
        }
      }
    }
  },
  security: [
    {
      BearerAuth: []
    }
  ]
};

const options = {
  swaggerDefinition,
  apis: [
    './src/routes/**/*.ts',
    './src/controllers/**/*.ts',
    './src/models/**/*.ts'
  ]
};

export const swaggerSpec = swaggerJSDoc(options);

export const setupSwagger = (app: Application): void => {
  // Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'English Practice API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      url: '/api-docs.json'
    }
  }));

  // Swagger JSON endpoint
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // API documentation info
  app.get('/api', (req, res) => {
    res.json({
      success: true,
      message: 'English Practice Learning Platform API',
      version: '1.0.0',
      documentation: '/api-docs',
      health: '/health',
      metrics: '/metrics'
    });
  });
};

export default {
  swaggerSpec,
  setupSwagger
};
