const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Gracified LMS API',
      version: '1.0.0',
      description: 'API documentation for the Gracified Learning Management System',
      contact: {
        name: 'Developer Support',
      },
    },
    servers: [
      {
        url: process.env.BACKEND_URL || 'http://localhost:5000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js'], // Path to the API docs (where you write your swagger comments)
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs,
};
