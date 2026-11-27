/** Cookie names and metadata keys shared by the auth module (§9.1). */
export const COOKIE = {
  access: 'cr_access',
  refresh: 'cr_refresh',
  csrf: 'cr_csrf',
} as const;

export const REFRESH_PATH = '/api/v1/auth';
export const CSRF_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const IS_PUBLIC_KEY = 'isPublic';
