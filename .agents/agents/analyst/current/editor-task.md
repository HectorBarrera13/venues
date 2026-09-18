# Surgical editor task

## Only writable target

- `backend/tests/ApiError.test.js`
- `backend/tests/errorHandler.test.js`
- `backend/tests/VenueController.test.js`
- `backend/tests/venues.routes.test.js`

Do not modify AGENTS.md, .gitignore, or any file under .agents/**.

## Instructions

1. **Create backend/tests/ApiError.test.js**:
   - Import `ApiError` from `../src/errors/ApiError`.
   - Test constructor parameter flexibility:
     - `(statusCode, message)`: sets `statusCode`, `status`, `message`, `name = 'ApiError'`, and is `instanceof Error`.
     - `(message, statusCode)`: sets `statusCode`, `status`, and `message` correctly.
     - default parameters: defaults `statusCode` to 500 and `message` to `'Internal Server Error'`.
   - Test static factory helper methods:
     - `ApiError.badRequest(message)`: returns 400 with provided or default message.
     - `ApiError.forbidden(message)`: returns 403 with provided or default message.
     - `ApiError.notFound(message)`: returns 404 with provided or default message.
     - `ApiError.internal(message)`: returns 500 with provided or default message.
   - Test dual exports: verify both default export and named export `module.exports.ApiError`.

2. **Create backend/tests/errorHandler.test.js**:
   - Import `errorHandler` from `../src/middleware/errorHandler` and `ApiError` from `../src/errors/ApiError`.
   - Test handling `ApiError` instances:
     - When passed an error with `statusCode` (e.g. 400), responds with `res.status(400).json({ error: message })`.
     - When passed an error with `statusCode` 403, responds with `res.status(403).json({ error: message })`.
   - Test handling standard `Error` instances without explicit status code:
     - Defaults status to 500 and responds with `res.status(500).json({ error: error.message })`.
   - Test fallback when error has empty message:
     - Defaults to `'Internal Server Error'`.
   - Test dual exports: verify both default export and named export `module.exports.errorHandler`.

3. **Modify backend/tests/VenueController.test.js**:
   - Import `ApiError` from `../src/errors/ApiError`.
   - Add a new `describe('VenueController.create (Task 2)', ...)` suite preserving the existing `describe('VenueController.list (Task 5)', ...)`.
   - In `beforeEach`, instantiate `mockVenueService` with both `listVenues: jest.fn()` and `registerVenue: jest.fn()`.
   - Test calling `controller.create(req, res, next)`:
     - Passes `req.body` and `req.user` to `venueService.registerVenue`.
     - When venue has a `toJSON()` method, serializes with `toJSON()` and returns 201 with the serialized payload.
     - When venue has no `toJSON()` method, returns 201 with the plain venue object.
   - Test error propagation:
     - When `registerVenue` throws an error and `next` is a function, calls `next(error)`.
     - When `registerVenue` throws an `ApiError(400, 'Invalid data')` and `next` is not provided, responds with `res.status(400).json({ error: 'Invalid data' })`.
     - When `registerVenue` throws a generic `Error('Crash')` and `next` is not provided, responds with `res.status(500).json({ error: 'Crash' })`.

4. **Modify backend/tests/venues.routes.test.js**:
   - Import `venueService` from `../src/services/VenueService` and `ApiError` from `../src/errors/ApiError`.
   - Add a new `describe('POST /venues Route Integration (Task 2 & 7)', ...)` suite alongside the existing GET route tests.
   - Use `jest.spyOn(venueService, 'registerVenue')` inside the suite, and restore the spy in `afterEach`.
   - Test successful venue registration via `POST /venues`: returns 201 and JSON payload with created venue.
   - Test validation failure: when `registerVenue` throws `ApiError.badRequest('Name is required')`, `POST /venues` returns 400 and `{ error: 'Name is required' }`.
   - Test permission failure: when `registerVenue` throws `ApiError.forbidden('Venue owner required')`, `POST /venues` returns 403 and `{ error: 'Venue owner required' }`.
   - Test unexpected failure: when `registerVenue` throws `new Error('Database disconnected')`, `POST /venues` returns 500 and `{ error: 'Database disconnected' }`.
   - Test proxy compatibility: `POST /api/venues` also handles the request and returns 201.

## Mandatory behavior

1. Verify that `backend/tests/ApiError.test.js` exists and is populated.
2. Verify that `backend/tests/errorHandler.test.js` exists and is populated.
3. Verify that `VenueController.create` tests are added to `backend/tests/VenueController.test.js`.
4. Verify that `POST /venues` integration tests are added to `backend/tests/venues.routes.test.js`.
5. Verify that `backend/tests/Venue.test.js` remains intact.
6. Do not perform any tests or verifications.
