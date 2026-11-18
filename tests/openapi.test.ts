import fs from 'node:fs';
import path from 'node:path';
import { MAP_ERROR_CODES } from '../src/maps/mapFormat';
import { openApiDefinition } from '../src/openapi/definition';

type Operation = { responses: Record<string, unknown> };
type PathItem = Record<string, Operation>;

const paths = openApiDefinition.paths as unknown as Record<string, PathItem>;
const schemas = openApiDefinition.components.schemas as Record<string, any>;

function statuses(pathName: string, method: string): string[] {
  return Object.keys(paths[pathName][method].responses);
}

describe('OpenAPI contract', () => {
  it('matches the committed openapi.json (run npm run openapi:generate)', () => {
    const committed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../openapi.json'), 'utf8'));
    expect(committed).toEqual(JSON.parse(JSON.stringify(openApiDefinition)));
  });

  it.each([
    ['/venues', 'post', ['201', '400', '401', '409']],
    ['/venues', 'get', ['200', '400']],
    ['/venues/{id}', 'get', ['200', '404']],
    ['/venues/{id}/map', 'post', ['201', '401', '403', '404', '422']],
    ['/venues/{id}/map', 'get', ['200', '400', '404']],
  ])('%s %s documents %j', (pathName, method, expected) => {
    expect(statuses(pathName, method)).toEqual(expect.arrayContaining(expected));
  });

  it('documents every route under /api as well', () => {
    for (const pathName of ['/venues', '/venues/{id}', '/venues/{id}/map']) {
      expect(Object.keys(paths[`/api${pathName}`])).toEqual(Object.keys(paths[pathName]));
    }
  });

  it('documents the search query parameters of GET /venues', () => {
    const names = (paths['/venues'].get as any).parameters.map((parameter: { name: string }) => parameter.name);
    expect(names).toEqual(['page', 'limit', 'lat', 'lng', 'radius_km', 'country', 'city', 'name']);
  });

  it('declares exactly the 422 error codes of docs/map-format.md', () => {
    expect(schemas.MapValidationIssue.properties.code.enum).toEqual([...MAP_ERROR_CODES]);

    const doc = fs.readFileSync(path.resolve(__dirname, '../docs/map-format.md'), 'utf8');
    for (const code of MAP_ERROR_CODES) {
      expect(doc).toContain(`| \`${code}\` |`);
    }
  });

  it('uses the { data, pagination } list shape', () => {
    expect(schemas.VenuePage.required).toEqual(['data', 'pagination']);
  });

  it('resolves every $ref', () => {
    const refs = JSON.stringify(openApiDefinition).match(/#\/components\/schemas\/\w+/g) ?? [];
    for (const ref of new Set(refs)) {
      expect(schemas).toHaveProperty(ref.split('/').pop() as string);
    }
  });
});
