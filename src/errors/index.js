import { GraphQLError } from 'graphql';

export class AuthenticationError extends GraphQLError {
  constructor(message = 'Unauthenticated') {
    super(message, { extensions: { code: 'UNAUTHENTICATED' } });
    this.name = 'AuthenticationError';
  }
}

export class ForbiddenError extends GraphQLError {
  constructor(message = 'Forbidden') {
    super(message, { extensions: { code: 'FORBIDDEN' } });
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends GraphQLError {
  constructor(message = 'Not found') {
    super(message, { extensions: { code: 'NOT_FOUND' } });
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends GraphQLError {
  constructor(message = 'Validation error') {
    super(message, { extensions: { code: 'VALIDATION_ERROR' } });
    this.name = 'ValidationError';
  }
}
