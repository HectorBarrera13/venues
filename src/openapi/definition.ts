interface PackageManifest {
  version: string;
}

const { version } = require('../../package.json') as PackageManifest;

export type JsonSchema = Record<string, unknown>;

export interface MediaTypeObject {
  schema: JsonSchema;
}

export interface RequestBodyObject {
  required: boolean;
  content: Record<string, MediaTypeObject>;
}

export interface ResponseObject {
  description: string;
  content?: Record<string, MediaTypeObject>;
}

export interface SecuritySchemeObject {
  type: string;
  description?: string;
  name?: string;
  in?: string;
  scheme?: string;
  bearerFormat?: string;
}

export interface OperationObject {
  operationId: string;
  summary: string;
  security?: Array<Record<string, string[]>>;
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
}

export interface PathItemObject {
  get?: OperationObject;
  post?: OperationObject;
}

export interface InfoObject {
  title: string;
  version: string;
}

export interface ComponentsObject {
  securitySchemes?: Record<string, SecuritySchemeObject>;
  schemas: Record<string, JsonSchema>;
}

export interface OpenAPIDocument {
  openapi: string;
  info: InfoObject;
  paths: Record<string, PathItemObject>;
  components: ComponentsObject;
}

const venueRef: JsonSchema = { $ref: '#/components/schemas/Venue' };
const errorRef: JsonSchema = { $ref: '#/components/schemas/Error' };

function jsonResponse(description: string, schema: JsonSchema): ResponseObject {
  return {
    description,
    content: {
      'application/json': { schema },
    },
  };
}

function venueOperations(suffix: string): PathItemObject {
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
      security: [{ bearerAuth: [] }],
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
        401: jsonResponse('Unauthorized: missing or invalid authentication token', errorRef),
        403: jsonResponse('Forbidden: insufficient permissions', errorRef),
        500: jsonResponse('Server error', errorRef),
      },
    },
  };
}

export const openApiDefinition: OpenAPIDocument = {
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
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      CreateVenue: {
        type: 'object',
        required: ['name', 'description', 'location'],
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          location: { type: 'string' },
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

export default openApiDefinition;