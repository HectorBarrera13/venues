# Surgical editor task

## Only writable target

• backend/src/errors/ApiError.js
• backend/src/middleware/errorHandler.js
• backend/src/app.js
• backend/src/controllers/VenueController.js
• backend/src/routes/venueRoutes.js

Do not modify AGENTS.md, .gitignore, or any file under .agents/\*\*.

## Instructions

1. **Create ApiError.js**:
   • Define class ApiError.js extending Error.
   • In constructor, accept (statusCodeOrMessage, messageOrStatusCode). Parse status code (defaulting to 500 if
   unspecified) and message (defaulting to 'Internal Server Error' if unspecified).
   • Set this.statusCode = statusCode, this.status = statusCode, and this.name = 'ApiError'.
   • Add static factory helper methods:
   • static badRequest(message = 'Bad Request') { return new ApiError(400, message); }
   • static forbidden(message = 'Forbidden') { return new ApiError(403, message); }
   • static notFound(message = 'Not Found') { return new ApiError(404, message); }
   • static internal(message = 'Internal Server Error') { return new ApiError(500, message); }
   • Export: module.exports = ApiError; module.exports.ApiError = ApiError;.
2. **Create errorHandler.js**:
   • Define Express error-handling middleware function (err, req, res, next).
   • Read status code: const status = err.statusCode || err.status || 500;.
   • Read error message: const message = err.message || 'Internal Server Error';.
   • Respond: return res.status(status).json({ error: message });.
   • Export: module.exports = errorHandler; module.exports.errorHandler = errorHandler;.
3. **Modify app.js**:
   • Import errorHandler via const errorHandler = require('./middleware/errorHandler');.
   • Replace the inline error middleware placeholder with app.use(errorHandler);.
4. **Modify VenueController.js**:
   • In constructor, bind this.create = this.create.bind(this);.
   • Implement async create(req, res, next):
   • Extract req.body and req.user.
   • Call await this.venueService.registerVenue(req.body, req.user).
   • Serialize result with typeof venue?.toJSON === 'function' ? venue.toJSON() : venue.
   • Respond with return res.status(201).json(venueJson);.
   • In catch block:
   • If typeof next === 'function', return next(error);.
   • Otherwise, return res.status(error.statusCode || error.status || 500).json({ error: error.message });.

5. **Modify venueRoutes.js**:
   • Register router.post('/', venueController.create); under // POST /venues (Task 2).

## Mandatory behavior

1. Verify that the class ApiError.js exists and is exported from backend/src/errors/ApiError.js.
2. Verify that errorHandler middleware exists and is exported from backend/src/middleware/errorHandler.js.
3. Verify that app.use(errorHandler) is registered in app.js.
4. Verify that create is defined and bound in VenueController.js.
5. Verify that router.post('/', venueController.create) is registered in venueRoutes.js.
6. Verify that Venue.js constructor, belongsTo, and toJSON are intact.
7. Do not perform any tests or verifications.
