# Current Request

## Raw User Request

agrega tests a la tarea previamente realizada. te la dejo aquí: Tasks:
1. Venue Entity Class Define the entity class with a constructor that takes name, description, location, ownerId, and internally generates id and createdAt. Implement belongsTo(userId) (returns boolean) and toJSON() to control what's exposed in the response
2. VenueController.create + POST /venues Route Register the route and write the controller's create(req, res) method: extracts data from the body, delegates validation and creation to VenueService.registerVenue, and translates the result (or thrown ApiError) into an HTTP response.
7. ApiError + Error-Handling Middleware ApiError class extending Error with an HTTP status. Express middleware that catches it and responds with { error: message } and the right code (400/403/500), used by VenueService and VenueController.
