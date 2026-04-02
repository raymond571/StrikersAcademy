import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  const statusCode = error.statusCode ?? 500;

  // Validation errors from Fastify schema
  if (error.validation) {
    reply.status(400).send({
      success: false,
      error: 'Validation failed',
      statusCode: 400,
      details: error.validation,
    });
    return;
  }

  // Known operational errors (includes 502 Bad Gateway for upstream failures)
  if (statusCode < 500 || statusCode === 502) {
    reply.status(statusCode).send({
      success: false,
      error: error.message,
      statusCode,
    });
    return;
  }

  // Unexpected server errors — don't leak details in production
  console.error('[Server Error]', error);
  reply.status(500).send({
    success: false,
    error: 'Internal server error',
    statusCode: 500,
  });
}
