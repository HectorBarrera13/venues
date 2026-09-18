/**
 * Express error-handling middleware.
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';
  return res.status(status).json({ error: message });
}

module.exports = errorHandler;
module.exports.errorHandler = errorHandler;
