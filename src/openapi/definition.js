const { version } = require('../../package.json');

const venueRef = { $ref: '#/components/schemas/Venue' };
const errorRef = { $ref: '#/components/schemas/Error' };

function jsonResponse(description, schema) {
  return {
    description,
    content: {
      'application/json': { schema },
    },
  };
}

function venueOperations(suffix) {
  return {
    get: {
      operationId: `listVenues${suffix}`,
      summary: 'List venues',
      responses: {
        200: jsonResponse('Registered venues', { type: 'array', items: venueRef }),
        500: jsonResponse('Server error', errorRef),
      },
    },
    post: {
      operationId: `createVenue${suffix}`,
      summary: 'Create a venue',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateVenue' },
          },
        },
      },
      responses: {
        201: jsonResponse('Created venue', venueRef),
        400: jsonResponse('Invalid venue data', errorRef),
        500: jsonResponse('Server error', errorRef),
      },
    },
  };
}

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Ticket D-Saster Venue Service',
    version: process.env.APP_VERSION || version,
  },
  paths: {
    '/venues': venueOperations(''),
    '/api/venues': venueOperations('Api'),
    '/health': {
      get: {
        operationId: 'getHealth',
        summary: 'Health check',
        responses: {
          200: jsonResponse('Service is healthy', { $ref: '#/components/schemas/HealthStatus' }),
        },
      },
    },
  },
  components: {
    schemas: {
      CreateVenue: {
        type: 'object',
        required: ['name', 'description', 'location'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          location: { type: 'string' },
          ownerId: { type: 'string', description: 'Optional owner ID accepted by the current service.' },
        },
      },
      Venue: {
        type: 'object',
        required: ['id', 'name', 'description', 'location', 'ownerId', 'createdAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          location: { type: 'string' },
          ownerId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string' },
        },
      },
      HealthStatus: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', example: 'ok' },
        },
      },
    },
  },
};
