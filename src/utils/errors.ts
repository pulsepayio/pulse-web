export class PulseError extends Error {
  public statusCode: number;
  public type: string;
  public code?: string;
  public param?: string;

  constructor(
    statusCode: number,
    type: string,
    message: string,
    code?: string,
    param?: string
  ) {
    super(message);
    this.name = 'PulseError';
    this.statusCode = statusCode;
    this.type = type;
    this.code = code;
    this.param = param;
  }

  toJSON() {
    return {
      error: {
        type: this.type,
        code: this.code,
        message: this.message,
        param: this.param,
      },
    };
  }
}

export class AuthenticationError extends PulseError {
  constructor(message = 'Invalid API key provided') {
    super(401, 'invalid_request_error', message, 'api_key_invalid');
  }
}

export class ForbiddenError extends PulseError {
  constructor(message = 'Access denied') {
    super(403, 'invalid_request_error', message, 'forbidden');
  }
}

export class NotFoundError extends PulseError {
  constructor(resource: string, id: string) {
    super(404, 'invalid_request_error', `No ${resource} found with id: ${id}`, 'not_found');
  }
}

export class ValidationError extends PulseError {
  constructor(message: string, param?: string) {
    super(400, 'invalid_request_error', message, 'parameter_missing', param);
  }
}

export class ConflictError extends PulseError {
  constructor(message: string) {
    super(409, 'invalid_request_error', message, 'resource_already_exists');
  }
}

export class RateLimitError extends PulseError {
  constructor() {
    super(429, 'invalid_request_error', 'Rate limit exceeded', 'rate_limit_exceeded');
  }
}

export class IdempotencyError extends PulseError {
  constructor(message = 'Idempotency key mismatch') {
    super(409, 'invalid_request_error', message, 'idempotency_mismatch');
  }
}
