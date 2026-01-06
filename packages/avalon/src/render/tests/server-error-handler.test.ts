/**
 * Tests for server error handler
 */

import { assertEquals, assertStringIncludes } from '@std/assert';
import { parseError, generateErrorHTML, createErrorResponse, withErrorHandler } from '../server-error-handler.ts';

Deno.test('parseError - basic error', () => {
  const error = new Error('Test error');
  const parsed = parseError(error);

  assertEquals(parsed.message, 'Test error');
  assertStringIncludes(parsed.stack || '', 'Error');
});

Deno.test('parseError - syntax error', () => {
  const error = new SyntaxError('Unexpected token');
  const parsed = parseError(error);

  assertEquals(parsed.message, 'Unexpected token');
  assertEquals(parsed.code, 'SYNTAX_ERROR');
});

Deno.test('parseError - extract file location from stack', () => {
  const error = new Error('Test error');
  // Mock stack with file location
  error.stack = `Error: Test error
    at Object.<anonymous> (/path/to/file.ts:10:5)
    at Module._compile (internal/modules/cjs/loader.js:1063:30)`;

  const parsed = parseError(error);

  assertEquals(parsed.file, '/path/to/file.ts');
  assertEquals(parsed.line, 10);
  assertEquals(parsed.column, 5);
});

Deno.test('generateErrorHTML - with stack', () => {
  const error = {
    message: 'Test error',
    stack: 'Error: Test error\n    at test',
    file: '/test/file.ts',
    line: 10,
    column: 5,
  };

  const html = generateErrorHTML(error);

  assertStringIncludes(html, '<!DOCTYPE html>');
  assertStringIncludes(html, 'Test error');
  assertStringIncludes(html, '/test/file.ts:10:5');
  assertStringIncludes(html, 'Stack Trace');
});

Deno.test('generateErrorHTML - without stack', () => {
  const error = {
    message: 'Test error',
  };

  const html = generateErrorHTML(error);

  assertStringIncludes(html, 'Test error');
});

Deno.test('generateErrorHTML - syntax error', () => {
  const error = {
    message: 'Unexpected token',
    code: 'SYNTAX_ERROR',
  };

  const html = generateErrorHTML(error);

  assertStringIncludes(html, 'Syntax Error');
  assertStringIncludes(html, 'Unexpected token');
});

Deno.test('createErrorResponse', async () => {
  const error = new Error('Test error');
  const response = createErrorResponse(error);

  assertEquals(response.status, 500);
  assertEquals(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assertEquals(response.headers.get('Cache-Control'), 'no-cache, no-store, must-revalidate');
});

Deno.test('withErrorHandler - catch errors in dev mode', async () => {
  const handler = async (_req: Request) => {
    throw new Error('Test error');
  };

  const wrapped = withErrorHandler(handler, true);
  const req = new Request('http://localhost/test');
  const response = await wrapped(req);

  assertEquals(response.status, 500);
  assertEquals(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
});

Deno.test('withErrorHandler - generic error in production', async () => {
  const handler = async (_req: Request) => {
    throw new Error('Test error');
  };

  const wrapped = withErrorHandler(handler, false);
  const req = new Request('http://localhost/test');
  const response = await wrapped(req);

  assertEquals(response.status, 500);
  assertEquals(response.headers.get('Content-Type'), 'text/plain');
  
  const text = await response.text();
  assertEquals(text, 'Internal Server Error');
});

Deno.test('withErrorHandler - pass through successful responses', async () => {
  const handler = async (_req: Request) => {
    return new Response('Success', { status: 200 });
  };

  const wrapped = withErrorHandler(handler, true);
  const req = new Request('http://localhost/test');
  const response = await wrapped(req);

  assertEquals(response.status, 200);
  const text = await response.text();
  assertEquals(text, 'Success');
});
