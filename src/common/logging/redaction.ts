/**
 * Never log credentials, cookies, tokens, presigned URLs or document content.
 * Pino redaction paths use dot notation; wildcards cover future nested DTOs.
 */
export const REDACTION_PATHS: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers.set-cookie',
  'req.body.password',
  'req.body.token',
  'req.body.refreshToken',
  'req.body.uploadToken',
  'req.body.apiKey',
  'req.body.secret',
  'password',
  'refreshToken',
  'uploadToken',
  'apiKey',
  'secret',
  'authorization',
  'cookie',
];
