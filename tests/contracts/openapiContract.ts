import fs from 'node:fs';
import path from 'node:path';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Validates real HTTP responses against the committed `openapi.json` (VEN-702).
 *
 * The committed file — not the TypeScript definition — is the source of truth,
 * because it is what consumers (venues-front, Team Aura) generate code from.
 * OpenAPI 3.0 schemas are converted to the JSON Schema dialect Ajv speaks:
 *   - `nullable: true`                     -> `type: [T, 'null']` / `anyOf [..., null]`
 *   - boolean `exclusiveMinimum/Maximum`   -> numeric draft-07 form
 */
type Schema = Record<string, unknown>;
type Spec = {
  paths: Record<string, Record<string, { responses: Record<string, { content?: Record<string, { schema: Schema }> }> }>>;
  components: { schemas: Record<string, Schema> };
};

export const OPENAPI_PATH = path.resolve(__dirname, '../../openapi.json');

export function loadSpec(file: string = OPENAPI_PATH): Spec {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Spec;
}

/** Recursively rewrites OpenAPI 3.0 keywords into draft-07 JSON Schema. */
export function toJsonSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toJsonSchema);
  if (!node || typeof node !== 'object') return node;

  const source = node as Schema;
  const out: Schema = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === 'nullable' || key === 'example') continue;
    out[key] = toJsonSchema(value);
  }

  if (source.exclusiveMinimum === true) {
    out.exclusiveMinimum = source.minimum;
    delete out.minimum;
  } else if (source.exclusiveMinimum === false) {
    delete out.exclusiveMinimum;
  }
  if (source.exclusiveMaximum === true) {
    out.exclusiveMaximum = source.maximum;
    delete out.maximum;
  } else if (source.exclusiveMaximum === false) {
    delete out.exclusiveMaximum;
  }

  if (source.nullable === true) {
    if (typeof out.type === 'string') {
      out.type = [out.type, 'null'];
      if (Array.isArray(out.enum)) out.enum = [...out.enum, null];
    } else {
      return { anyOf: [out, { type: 'null' }] };
    }
  }
  return out;
}

/** Turns an Express path (`/venues/abc/map`) into its OpenAPI template (`/venues/{id}/map`). */
export function matchPath(spec: Spec, requestPath: string): string | undefined {
  const pathname = requestPath.split('?')[0].replace(/\/+$/, '') || '/';
  return Object.keys(spec.paths).find((template) => {
    const pattern = new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`);
    return pattern.test(pathname);
  });
}

export interface ContractViolation {
  key: string;
  errors: string[];
}

export class ContractValidator {
  private readonly ajv: Ajv;
  private readonly cache = new Map<string, ValidateFunction>();
  /** `METHOD template status` of every response validated so far (coverage report). */
  readonly covered = new Set<string>();

  constructor(private readonly spec: Spec = loadSpec()) {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
    this.ajv.addSchema(
      { $id: 'openapi', components: toJsonSchema(spec.components) as Schema },
      'openapi',
    );
  }

  /** Every `METHOD template status` documented in the spec. */
  documentedResponses(): string[] {
    const keys: string[] = [];
    for (const [template, item] of Object.entries(this.spec.paths)) {
      for (const [method, operation] of Object.entries(item)) {
        for (const status of Object.keys(operation.responses)) {
          keys.push(`${method.toUpperCase()} ${template} ${status}`);
        }
      }
    }
    return keys;
  }

  private validatorFor(key: string, schema: Schema): ValidateFunction {
    let validate = this.cache.get(key);
    if (!validate) {
      // Local refs (#/components/...) are resolved against the registered spec.
      const rewritten = JSON.parse(JSON.stringify(toJsonSchema(schema)).replace(/"#\/components\//g, '"openapi#/components/'));
      validate = this.ajv.compile(rewritten as Schema);
      this.cache.set(key, validate);
    }
    return validate;
  }

  /** Returns the violations of one response; an empty `errors` list means it honours the contract. */
  check(method: string, requestPath: string, status: number, body: unknown): ContractViolation {
    const template = matchPath(this.spec, requestPath);
    const key = `${method.toUpperCase()} ${template ?? requestPath} ${status}`;
    if (!template) return { key, errors: [`path ${requestPath} is not documented`] };

    const operation = this.spec.paths[template][method.toLowerCase()];
    if (!operation) return { key, errors: [`method ${method} is not documented for ${template}`] };

    const response = operation.responses[String(status)];
    if (!response) return { key, errors: [`status ${status} is not documented for ${method.toUpperCase()} ${template}`] };

    this.covered.add(key);
    const schema = response.content?.['application/json']?.schema;
    if (!schema) return { key, errors: [] };

    const validate = this.validatorFor(key, schema);
    if (validate(body)) return { key, errors: [] };
    return {
      key,
      errors: (validate.errors ?? []).map((error) => `${error.instancePath || '(body)'} ${error.message}`),
    };
  }
}

/** Shared instance so every suite contributes to one coverage report. */
export const contract = new ContractValidator();

/** Jest-friendly assertion: throws with every schema violation listed. */
export function expectToMatchContract(response: { status: number; body: unknown; req: { method: string; path: string } }): void {
  const { key, errors } = contract.check(response.req.method, response.req.path, response.status, response.body);
  if (errors.length > 0) {
    throw new Error(`Response ${key} violates openapi.json:\n  - ${errors.join('\n  - ')}`);
  }
}
