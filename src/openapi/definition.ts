import { MAP_ERROR_CODES, MAP_LIMITS } from '../maps/mapFormat';
import { MAX_RADIUS_KM, MAX_TEXT_LENGTH, OSM_REF_PATTERN, PAGINATION } from '../validation/venueInput';

interface PackageManifest {
  version: string;
}

const { version } = require('../../package.json') as PackageManifest;

const text: JsonSchema = { type: 'string', minLength: 1, maxLength: MAX_TEXT_LENGTH };
const countryCode: JsonSchema = {
  type: 'string',
  pattern: '^[A-Z]{2}$',
  description: 'ISO 3166-1 alpha-2 country code (lower case is accepted on input).',
  example: 'MX',
};
const coordinate: JsonSchema = {
  type: 'number', minimum: MAP_LIMITS.coordinateMin, maximum: MAP_LIMITS.coordinateMax,
};
const outline: JsonSchema = {
  type: 'array',
  minItems: MAP_LIMITS.outlineMinPoints,
  maxItems: MAP_LIMITS.outlineMaxPoints,
  description: 'Simple polygon ring, implicitly closed (do not repeat the first point).',
  items: { $ref: '#/components/schemas/Point' },
};
const mapId: JsonSchema = {
  type: 'string',
  pattern: MAP_LIMITS.idPattern.source,
  description: 'Unique in the map and stable across versions.',
};
const osmRef: JsonSchema = {
  type: 'string',
  nullable: true,
  pattern: OSM_REF_PATTERN.source,
  description: 'OpenStreetMap reference. Unique among venues when present.',
  example: 'way:123456',
};

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
const conflictRef: JsonSchema = { $ref: '#/components/schemas/VenueConflict' };
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

function queryParameter(name: string, description: string, schema: JsonSchema): ParameterObject {
  return { name, in: 'query', required: false, description, schema };
}

const listVenuesParameters: ParameterObject[] = [
  queryParameter('page', 'Page number, starting at 1.', {
    type: 'integer', minimum: 1, default: PAGINATION.defaultPage,
  }),
  queryParameter('limit', 'Page size.', {
    type: 'integer', minimum: 1, maximum: PAGINATION.maxLimit, default: PAGINATION.defaultLimit,
  }),
  queryParameter('lat', 'Latitude of the search centre (WGS84). Requires lng and radius_km.', {
    type: 'number', minimum: -90, maximum: 90,
  }),
  queryParameter('lng', 'Longitude of the search centre (WGS84). Requires lat and radius_km.', {
    type: 'number', minimum: -180, maximum: 180,
  }),
  queryParameter('radius_km', 'Search radius in kilometres. Requires lat and lng.', {
    type: 'number', exclusiveMinimum: true, minimum: 0, maximum: MAX_RADIUS_KM,
  }),
  queryParameter('country', 'ISO 3166-1 alpha-2 country code.', { type: 'string', pattern: '^[A-Za-z]{2}$' }),
  queryParameter('city', 'City, matched case- and accent-insensitively.', { type: 'string', minLength: 1 }),
  queryParameter('name', 'Venue name fragment, matched case- and accent-insensitively.', {
    type: 'string', minLength: 1,
  }),
];

const notImplemented = jsonResponse('Not implemented yet: the route is a contract stub', errorRef);

const mapVersionRef: JsonSchema = { $ref: '#/components/schemas/MapVersion' };

function mapOperations(suffix: string): PathItemObject {
  return {
    post: {
      operationId: `saveVenueMap${suffix}`,
      summary: 'Save a new seat map version',
      description: 'Stores the payload as version latestMapVersion + 1. Versions are immutable. '
        + 'Requires the VENUE_OWNER role and ownership of the venue. Format: docs/map-format.md. '
        + 'Contract stub: answers 501 until implemented.',
      parameters: [idParameter],
      security: partnerSecurity,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/MapPayload' } } },
      },
      responses: {
        201: jsonResponse('Map stored as a new version', mapVersionRef),
        400: jsonResponse('Malformed payload (types, ranges, ids, limits)', errorRef),
        401: jsonResponse('Missing, invalid or expired access token', errorRef),
        403: jsonResponse('Not VENUE_OWNER, or not the owner of this venue', errorRef),
        404: jsonResponse('Venue not found', errorRef),
        422: jsonResponse('The map breaks one or more business rules', {
          $ref: '#/components/schemas/MapValidationErrors',
        }),
        500: jsonResponse('Server error', errorRef),
        501: notImplemented,
      },
    },
    get: {
      operationId: `getVenueMap${suffix}`,
      summary: 'Get a seat map version',
      description: 'Returns the latest version, or the one given in "version". '
        + 'Contract stub: answers 501 until implemented.',
      parameters: [
        idParameter,
        queryParameter('version', 'Map version to read; latest when omitted.', { type: 'integer', minimum: 1 }),
      ],
      security: partnerSecurity,
      responses: {
        200: jsonResponse('Map version', mapVersionRef),
        400: jsonResponse('"version" is not a positive integer', errorRef),
        401: jsonResponse('Missing, invalid or expired access token', errorRef),
        403: jsonResponse('Authenticated role is not a partner role', errorRef),
        404: jsonResponse('Venue not found, venue without map, or unknown version', errorRef),
        500: jsonResponse('Server error', errorRef),
        501: notImplemented,
      },
    },
  };
}

function venueByIdOperations(suffix: string): PathItemObject {
  return {
    get: {
      operationId: `getVenueById${suffix}`,
      summary: 'Get a venue by ID',
      description: 'Available to any authenticated user. Returns the venue record including latestMapVersion without map geometry.',
      parameters: [idParameter],
      security: partnerSecurity,
      responses: {
        200: jsonResponse('Venue found', venueRef),
        401: jsonResponse('Missing, invalid or expired access token', errorRef),
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
      summary: 'List and search venues',
      description: 'Paginated search across venues with at least one saved map version (latestMapVersion >= 1). '
        + 'Available to any authenticated user. Geospatial queries (lat, lng, radius_km) sort ascending by '
        + 'distance and include distance_km rounded to two decimal places.',
      parameters: listVenuesParameters,
      security: partnerSecurity,
      responses: {
        200: jsonResponse('One page of venues', { $ref: '#/components/schemas/VenuePage' }),
        400: jsonResponse('Invalid pagination, filter parameters, or coordinates/radius', errorRef),
        401: jsonResponse('Missing, invalid or expired access token', errorRef),
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
        409: jsonResponse('A venue with the same osmRef is already registered', conflictRef),
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
    '/venues/{id}/map': mapOperations(''),
    '/api/venues/{id}/map': mapOperations('Api'),
    '/health': {
      get: {
        operationId: 'getHealth',
        summary: 'Health check',
        description: 'Process liveness. Does not reach any dependency.',
        responses: {
          200: jsonResponse('Service is healthy', { $ref: '#/components/schemas/HealthStatus' }),
        },
      },
    },
    '/ready': {
      get: {
        operationId: 'getReadiness',
        summary: 'Readiness check',
        description: 'Reports whether the venue store is reachable. Answers 503 while it is not.',
        responses: {
          200: jsonResponse('Dependencies are reachable', { $ref: '#/components/schemas/ReadinessStatus' }),
          503: jsonResponse('Venue store is unreachable', { $ref: '#/components/schemas/ReadinessStatus' }),
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
      GeoLocation: {
        type: 'object',
        required: ['lat', 'lng'],
        description: 'WGS84 position. Stored as a GeoJSON Point ([lng, lat]).',
        properties: {
          lat: { type: 'number', minimum: -90, maximum: 90, example: 19.4245 },
          lng: { type: 'number', minimum: -180, maximum: 180, example: -99.1951 },
        },
      },
      CreateVenue: {
        type: 'object',
        required: ['name', 'address', 'city', 'country', 'location'],
        description: 'Text fields are trimmed. Any other field, including ownerId, is ignored: '
          + 'the owner is the token subject.',
        properties: {
          name: { ...text, example: 'Auditorio Nacional' },
          description: { ...text, nullable: true },
          address: { ...text, example: 'Paseo de la Reforma 50' },
          city: { ...text, example: 'Ciudad de Mexico' },
          country: countryCode,
          location: { $ref: '#/components/schemas/GeoLocation' },
          externalId: { ...text, nullable: true, description: 'Id of the venue in externalSource. Requires externalSource.' },
          externalSource: { ...text, nullable: true, example: 'nominatim' },
          osmRef: osmRef,
        },
      },
      Venue: {
        type: 'object',
        required: [
          'id', 'name', 'description', 'address', 'city', 'country', 'location',
          'externalId', 'externalSource', 'osmRef', 'latestMapVersion', 'ownerId', 'createdAt',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          address: { type: 'string' },
          city: { type: 'string' },
          country: countryCode,
          location: { $ref: '#/components/schemas/GeoLocation' },
          externalId: { type: 'string', nullable: true },
          externalSource: { type: 'string', nullable: true },
          osmRef: osmRef,
          latestMapVersion: {
            type: 'integer',
            minimum: 0,
            description: 'Highest stored map version; 0 while the venue has no map.',
          },
          ownerId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Pagination: {
        type: 'object',
        required: ['page', 'limit', 'total', 'totalPages'],
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: PAGINATION.maxLimit },
          total: { type: 'integer', minimum: 0 },
          totalPages: { type: 'integer', minimum: 0 },
        },
      },
      VenueSearchItem: {
        allOf: [
          venueRef,
          {
            type: 'object',
            properties: {
              distance_km: {
                type: 'number',
                minimum: 0,
                description: 'Distance in kilometres from the search centre (rounded to 2 decimals). Present only on geospatial searches.',
              },
            },
          },
        ],
      },
      VenuePage: {
        type: 'object',
        required: ['data', 'pagination'],
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/VenueSearchItem' } },
          pagination: { $ref: '#/components/schemas/Pagination' },
        },
      },
      VenueConflict: {
        type: 'object',
        required: ['error', 'existingVenueId'],
        properties: {
          error: { type: 'string' },
          existingVenueId: { type: 'string', description: 'Id of the venue already registered with that osmRef.' },
        },
      },
      Point: {
        type: 'object',
        required: ['x', 'y'],
        description: `Normalized canvas position, origin top-left. Rounded to ${MAP_LIMITS.coordinateDecimals} decimals.`,
        properties: { x: coordinate, y: coordinate },
      },
      Stage: {
        type: 'object',
        required: ['outline'],
        properties: {
          label: { type: 'string', nullable: true, maxLength: MAP_LIMITS.maxNameLength },
          outline: outline,
        },
      },
      Zone: {
        type: 'object',
        required: ['id', 'name', 'outline'],
        properties: {
          id: mapId,
          name: {
            type: 'string',
            maxLength: MAP_LIMITS.maxNameLength,
            description: 'A blank name is reported as UNNAMED_ZONE (422).',
          },
          outline: outline,
        },
      },
      Seat: {
        type: 'object',
        required: ['id', 'label', 'row', 'zone', 'position'],
        properties: {
          id: mapId,
          label: { type: 'string', minLength: 1, maxLength: MAP_LIMITS.maxLabelLength, example: '12' },
          row: { type: 'string', nullable: true, maxLength: MAP_LIMITS.maxLabelLength, example: 'A' },
          zone: { type: 'string', nullable: true, description: 'Id of the owning zone.' },
          position: { $ref: '#/components/schemas/Point' },
          rotation: {
            type: 'number', minimum: 0, maximum: 360, exclusiveMaximum: true, default: 0,
            description: 'Clockwise rotation in degrees.',
          },
        },
      },
      MapPayload: {
        type: 'object',
        required: ['stage', 'zones', 'seats'],
        description: 'Seat map as drawn in the editor. Specification: docs/map-format.md.',
        properties: {
          stage: {
            allOf: [{ $ref: '#/components/schemas/Stage' }],
            nullable: true,
            description: 'null is reported as NO_STAGE (422).',
          },
          zones: { type: 'array', maxItems: MAP_LIMITS.maxZones, items: { $ref: '#/components/schemas/Zone' } },
          seats: { type: 'array', maxItems: MAP_LIMITS.maxSeats, items: { $ref: '#/components/schemas/Seat' } },
        },
      },
      MapVersion: {
        type: 'object',
        required: ['venueId', 'version', 'createdAt', 'stage', 'zones', 'seats'],
        description: 'Immutable stored snapshot.',
        properties: {
          venueId: { type: 'string' },
          version: { type: 'integer', minimum: 1 },
          createdAt: { type: 'string', format: 'date-time' },
          stage: { $ref: '#/components/schemas/Stage' },
          zones: { type: 'array', items: { $ref: '#/components/schemas/Zone' } },
          seats: { type: 'array', items: { $ref: '#/components/schemas/Seat' } },
        },
      },
      MapValidationIssue: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'string', enum: [...MAP_ERROR_CODES] },
          message: { type: 'string', description: 'Display text; not part of the contract.' },
          seatIds: { type: 'array', minItems: 1, items: { type: 'string' } },
          zoneIds: { type: 'array', minItems: 1, items: { type: 'string' } },
        },
      },
      MapValidationErrors: {
        type: 'object',
        required: ['error', 'errors'],
        properties: {
          error: { type: 'string', example: 'Map validation failed' },
          errors: {
            type: 'array',
            minItems: 1,
            description: 'Every violation, ordered by code (catalogue order) and then payload order.',
            items: { $ref: '#/components/schemas/MapValidationIssue' },
          },
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
      ReadinessStatus: {
        type: 'object',
        required: ['status', 'venueStore'],
        properties: {
          status: { type: 'string', enum: ['ready', 'not_ready'] },
          venueStore: { type: 'string', enum: ['up', 'down'] },
        },
      },
    },
  },
};

export default openApiDefinition;