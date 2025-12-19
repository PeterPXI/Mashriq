/**
 * Mashriq - Route Guards Module
 * Handles authentication-based page access control
 */

import { isAuthenticated } from './auth.js';

/**
 * Require authentication to access page
 * Redirects to login if not authenticated
 * @returns {boolean} - True if authenticated, false if redirected
 */
export function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '/app/login.html';
    return false;
  }
  return true;
}

/**
 * Redirect to services if already authenticated
 * Used for login/register/landing pages
 * @returns {boolean} - True if not authenticated, false if redirected
 */
export function redirectIfAuthenticated() {
  if (isAuthenticated()) {
    window.location.href = '/app/services.html';
    return false;
  }
  return true;
}

/**
 * Initialize guard for protected pages
 * Call this at the start of protected page scripts
 * @returns {boolean}
 */
export function initProtectedPage() {
  return requireAuth();
}

/**
 * Initialize guard for public-only pages (login, register, landing)
 * Call this at the start of public page scripts that should redirect when logged in
 * @returns {boolean}
 */
export function initPublicPage() {
  return redirectIfAuthenticated();
}

export default {
  requireAuth,
  redirectIfAuthenticated,
  initProtectedPage,
  initPublicPage
};
