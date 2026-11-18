import ApiError from '../errors/ApiError';

/**
 * Reads the optional `?version=N` of `GET /venues/{id}/map`.
 * Returns undefined for "latest"; throws 400 when the value is not a positive integer.
 */
export function parseMapVersionQuery(rawQuery: unknown): number | undefined {
  const query = rawQuery && typeof rawQuery === 'object' ? (rawQuery as Record<string, unknown>) : {};
  const value = query.version;
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value.trim()) || !Number.isSafeInteger(Number(value))) {
    throw ApiError.badRequest('Query parameter "version" must be a positive integer');
  }
  return Number(value);
}
