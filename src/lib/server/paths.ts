import { resolve } from '$app/paths';

/**
 * The app root as an absolute path without a trailing slash, or `/` when the app
 * is served from the domain root.
 *
 * Cookie `path` attributes must be absolute and must match exactly between `set`
 * and `delete`, so they cannot use `resolve()` directly: it appends a trailing
 * slash for the root, which would stop the cookie matching the base path itself.
 */
export const appRoot = resolve('').replace(/\/$/, '') || '/';

/**
 * Cookie scope for the transient Entra sign-in cookie. `/auth` is a directory of
 * routes rather than a route itself, so it cannot go through `resolve()`.
 */
export const authRoot = `${appRoot === '/' ? '' : appRoot}/auth`;
