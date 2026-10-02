export class ApiError extends Error {
  statusCode: number;
  status: number;

  constructor(statusCodeOrMessage: number | string = 500, messageOrStatusCode: string | number = 'Internal Server Error') {
    const statusCode = typeof statusCodeOrMessage === 'number'
      ? statusCodeOrMessage
      : typeof messageOrStatusCode === 'number' ? messageOrStatusCode : 500;
    const message = typeof statusCodeOrMessage === 'string'
      ? statusCodeOrMessage
      : typeof messageOrStatusCode === 'string' ? messageOrStatusCode : 'Internal Server Error';

    super(message);
    this.statusCode = statusCode;
    this.status = statusCode;
    this.name = 'ApiError';
  }

  static badRequest(message = 'Bad Request'): ApiError {
    return new ApiError(400, message);
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(403, message);
  }

  static notFound(message = 'Not Found'): ApiError {
    return new ApiError(404, message);
  }

  static internal(message = 'Internal Server Error'): ApiError {
    return new ApiError(500, message);
  }
}

export default ApiError;
