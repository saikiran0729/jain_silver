/**
 * Swagger/OpenAPI Documentation for Jain Silver API
 * Install dependencies: npm install swagger-ui-express swagger-jsdoc
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Jain Silver API',
      version: '1.0.0',
      description: 'Backend API for Jain Silver application - Silver rates, user management, admin dashboard, news, and store information',
      contact: {
        name: 'Jain Silver Support',
        email: 'support@jainsilver.com'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'https://jain-silver-phi.vercel.app/api',
        description: 'Production server'
      },
      {
        url: 'http://localhost:5000/api',
        description: 'Local development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
            isVerified: { type: 'boolean' },
            role: { type: 'string', enum: ['user', 'admin'] },
            documents: {
              type: 'object',
              properties: {
                aadhar: {
                  type: 'object',
                  properties: {
                    front: { type: 'string' },
                    back: { type: 'string' }
                  }
                },
                pan: {
                  type: 'object',
                  properties: {
                    image: { type: 'string' }
                  }
                },
                selfie: { type: 'string' }
              }
            }
          }
        },
        SilverRate: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            ratePerGram: { type: 'number' },
            rate: { type: 'number' },
            weight: {
              type: 'object',
              properties: {
                value: { type: 'number' },
                unit: { type: 'string' }
              }
            },
            purity: { type: 'string' },
            manualAdjustment: { type: 'number' },
            lastUpdated: { type: 'string', format: 'date-time' }
          }
        },
        News: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            content: { type: 'string' },
            image: { type: 'string' },
            author: { type: 'string' },
            published: { type: 'boolean' },
            publishedAt: { type: 'string', format: 'date-time' },
            category: { type: 'string', enum: ['announcement', 'update', 'offer', 'general'] },
            tags: { type: 'array', items: { type: 'string' } },
            views: { type: 'number' }
          }
        },
        StoreInfo: {
          type: 'object',
          properties: {
            welcomeMessage: { type: 'string' },
            address: { type: 'string' },
            phoneNumber: { type: 'string' },
            storeTimings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  day: { type: 'string' },
                  openTime: { type: 'string' },
                  closeTime: { type: 'string' },
                  isClosed: { type: 'boolean' }
                }
              }
            },
            instagram: { type: 'string' },
            facebook: { type: 'string' },
            youtube: { type: 'string' },
            bankDetails: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  bankName: { type: 'string' },
                  accountNumber: { type: 'string' },
                  ifscCode: { type: 'string' },
                  accountHolderName: { type: 'string' },
                  branch: { type: 'string' }
                }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            error: { type: 'string' }
          }
        }
      }
    },
    tags: [
      { name: 'Auth', description: 'Authentication and user registration' },
      { name: 'Users', description: 'User management endpoints' },
      { name: 'Admin', description: 'Admin dashboard and management' },
      { name: 'Rates', description: 'Silver rates management' },
      { name: 'News', description: 'News posts management' },
      { name: 'Store', description: 'Store information management' }
    ]
  },
  apis: ['./routes/*.js'] // Path to the API files
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerUi, swaggerSpec };

