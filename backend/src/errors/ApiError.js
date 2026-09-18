class ApiError extends Error {
  constructor(statusCodeOrMessage = 500, messageOrStatusCode = 'Internal Server Error') {
    let statusCode = 500;
    let message = 'Internal Server Error';

    if (typeof statusCodeOrMessage === 'number') {
      statusCode = statusCodeOrMessage;
      if (typeof messageOrStatusCode === 'string') {
        message = messageOrStatusCode;
      }
    } else if (typeof messageOrStatusCode === 'number') {
      statusCode = messageOrStatusCode;
      if (typeof statusCodeOrMessage === 'string') {
        message = statusCodeOrMessage;
      }
    } else if (typeof statusCodeOrMessage === 'string') {
      message = statusCodeOrMessage;
      if (typeof messageOrStatusCode === 'number') {
        statusCode = messageOrStatusCode;
      }
    }

    super(message);
    this.statusCode = statusCode;
    this.status = statusCode;
    this.name = 'ApiError';
  }

  static badRequest(message = 'Bad Request') {
    return new ApiError(400, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Not Found') {
    return new ApiError(404, message);
  }

  static internal(message = 'Internal Server Error') {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;
module.exports.ApiError = ApiError;
