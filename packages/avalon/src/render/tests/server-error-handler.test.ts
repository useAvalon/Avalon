/**
 * Tests for server error handler
 */

import { describe, it, expect } from 'vitest';
import { parseError, generateErrorHTML, createErrorResponse, withErrorHandler } from '../server-error-handler.ts';

describe('parseError', () => {
  it('basic error', () => {
    const error = new Error('Test error');
    const parsed = parseError(error);

    expect(parsed.message).toEqual('Test error');
    expect(parsed.stack || '').toContain('Error');
  });

  it('syntax error', () => {
    const error = new SyntaxError('Unexpected token');
    const parsed = parseError(error);

    expect(parsed.message).toEqual('Unexpected token');
    expect(parsed.code).toEqual('SYNTAX_ERROR');
  });

  it('extract file location from stack', () => {
    const error = new Error('Test error');
    error.stack = `Error: Test error
    at Object.<anonymous> (/path/to/file.ts:10:5)
    at Module._compile (internal/modules/cjs/loader.js:1063:30)`;

    const parsed = parseError(error);

    expect(parsed.file).toEqual('/path/to/file.ts');
    expect(parsed.line).toEqual(10);
    expect(parsed.column).toEqual(5);
  });
});

describe('generateErrorHTML', () => {
  it('with stack', () => {
    const error = {
      message: 'Test error',
      stack: 'Error: Test error\n    at test',
      file: '/test/file.ts',
      line: 10,
      column: 5,
    };

    const html = generateErrorHTML(error);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Test error');
    expect(html).toContain('/test/file.ts:10:5');
    expect(html).toContain('Stack Trace');
  });

  it('without stack', () => {
    const error = {
      message: 'Test error',
    };

    const html = generateErrorHTML(error);

    expect(html).toContain('Test error');
  });

  it('syntax error', () => {
    const error = {
      message: 'Unexpected token',
      code: 'SYNTAX_ERROR',
    };

    const html = generateErrorHTML(error);

    expect(html).toContain('Syntax Error');
    expect(html).toContain('Unexpected token');
  });
});

describe('createErrorResponse', () => {
  it('should create 500 response with correct headers', () => {
    const error = new Error('Test error');
    const response = createErrorResponse(error);

    expect(response.status).toEqual(500);
    expect(response.headers.get('Content-Type')).toEqual('text/html; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toEqual('no-cache, no-store, must-revalidate');
  });
});

describe('withErrorHandler', () => {
  it('catch errors in dev mode', async () => {
    const handler = async (_req: Request) => {
      throw new Error('Test error');
    };

    const wrapped = withErrorHandler(handler, true);
    const req = new Request('http://localhost/test');
    const response = await wrapped(req);

    expect(response.status).toEqual(500);
    expect(response.headers.get('Content-Type')).toEqual('text/html; charset=utf-8');
  });

  it('generic error in production', async () => {
    const handler = async (_req: Request) => {
      throw new Error('Test error');
    };

    const wrapped = withErrorHandler(handler, false);
    const req = new Request('http://localhost/test');
    const response = await wrapped(req);

    expect(response.status).toEqual(500);
    expect(response.headers.get('Content-Type')).toEqual('text/plain');

    const text = await response.text();
    expect(text).toEqual('Internal Server Error');
  });

  it('pass through successful responses', async () => {
    const handler = async (_req: Request) => {
      return new Response('Success', { status: 200 });
    };

    const wrapped = withErrorHandler(handler, true);
    const req = new Request('http://localhost/test');
    const response = await wrapped(req);

    expect(response.status).toEqual(200);
    const text = await response.text();
    expect(text).toEqual('Success');
  });
});
