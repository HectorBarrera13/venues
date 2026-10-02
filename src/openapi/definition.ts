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

export interface ParameterObject {
  name: string;
  in: string;
  required: boolean;
  description?: string;
  schema: JsonSchema;
}

export interface OperationObject {
  operationId: string;
  summary: string;
  description?: string;
  parameters?: ParameterObject[];
  security?: Record<string, string[]>[];
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

export interface SecuritySchemeObject {
  type: string;
  scheme: string;
  bearerFormat?: string;
  description?: string;
}

export interface ComponentsObject {
  schemas: Record<string, JsonSchema>;
  securitySchemes?: Record<string, SecuritySchemeObject>;
}

export interface OpenAPIDocument {
  openapi: string;
  info: InfoObject;
  paths: Record<string, PathItemObject>;
  components: ComponentsObject;
}

const venueRef: JsonSchema = { $ref: '#/components/schemas/Venue' };
const errorRef: JsonSchema = { $ref: '#/components/schemas/Error' };
const partnerSecurity: Record<string, string[]>[] = [{ bearerAuth: [] }];

const idParameter: ParameterObject = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'Venue identifier.',
  schema: { type: 'string' },
};

function jsonResponse(description: string, schema: JsonSchema): ResponseObject {
  return {
    description,
    content: {
      'application/json': { schema },
    },
  };
}

function venueByIdOperations(suffix: string): PathItemObject {
  return {
    get: {
      operationId: `getVenueById${suffix}`,
      summary: 'Get a venue by ID',
      parameters: [idParameter],
      security: partnerSecurity,
      responses: {
        200: jsonResponse('Venue found', venueRef),
        401: jsonResponse('Missing, invalid or expired access token', errorRef),
        403: jsonResponse('Authenticated role is not a partner role', errorRef),
        404: jsonResponse('Venue not found', errorRef),
        500: jsonResponse('Server error', errorRef),
      },
    },
  };
}

function venueOperations(suffix: string): PathItemObject {
  return {
    get: {
      operationId: `listVenues${suffix}`,
      summary: 'List venues',
      security: partnerSecurity,
      responses: {
        200: jsonResponse('Registered venues', { type: 'array', items: venueRef }),
        401: jsonResponse('Missing, invalid or expired access token', errorRef),
        403: jsonResponse('Authenticated role is not a partner role', errorRef),
        500: jsonResponse('Server error', errorRef),
      },
    },
    post: {
      operationId: `createVenue${suffix}`,
      summary: 'Create a venue',
      description: 'Requires the VENUE_OWNER role. The owner is taken from the token "sub" claim; ownerId in the body is ignored.',
      security: partnerSecurity,
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
        401: jsonResponse('Missing, invalid or expired access token', errorRef),
        403: jsonResponse('Authenticated role is not VENUE_OWNER', errorRef),
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
    '/venues/{id}': venueByIdOperations(''),
    '/api/venues/{id}': venueByIdOperations('Api'),
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
        description: 'Partner access token with "sub", "role" and "exp" claims.',
      },
    },
    schemas: {
      CreateVenue: {
        type: 'object',
        required: ['name', 'description', 'location'],
        description: 'Any extra field, including ownerId, is ignored.',
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string', minLength: 1 },
          location: { type: 'string', minLength: 1 },
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