import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorHandler } from './errorHandler';

function createMockReply() {
  const reply: any = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply;
}

describe('errorHandler', () => {
  let reply: ReturnType<typeof createMockReply>;
  const request = {} as any;

  beforeEach(() => {
    reply = createMockReply();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns 400 with details for validation errors', () => {
    const error = {
      validation: [{ message: 'must be string', keyword: 'type' }],
      statusCode: 400,
    } as any;

    errorHandler(error, request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Validation failed',
        details: error.validation,
      }),
    );
  });

  it('returns operational error status and message for 4xx errors', () => {
    const error = { message: 'Not found', statusCode: 404 } as any;

    errorHandler(error, request, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Not found', statusCode: 404 }),
    );
  });

  it('returns generic 500 for unexpected errors (no detail leak)', () => {
    const error = { message: 'DB connection failed', statusCode: 500 } as any;

    errorHandler(error, request, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Internal server error', statusCode: 500 }),
    );
    // Should NOT leak the actual error message
    expect(reply.send).not.toHaveBeenCalledWith(
      expect.objectContaining({ error: 'DB connection failed' }),
    );
  });

  it('defaults to 500 when statusCode is undefined', () => {
    const error = { message: 'oops' } as any;

    errorHandler(error, request, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
  });

  it('logs server errors to console', () => {
    const error = { message: 'crash', statusCode: 500 } as any;

    errorHandler(error, request, reply);

    expect(console.error).toHaveBeenCalledWith('[Server Error]', error);
  });

  it('does not log 4xx errors to console', () => {
    const error = { message: 'bad request', statusCode: 400 } as any;

    errorHandler(error, request, reply);

    expect(console.error).not.toHaveBeenCalled();
  });
});
