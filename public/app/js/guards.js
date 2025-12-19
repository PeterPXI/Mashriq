/**
 * Mashriq - Route Guards
 * Authentication-based page access control
 * No ES6 modules - works directly in browser
 */

const MashriqGuards = (function() {
  
  /**
   * Require authentication to access page
   * Redirects to login if not authenticated
   * Returns false if redirecting
   */
  function requireAuth() {
    if (!MashriqAuth.isAuthenticated()) {
      window.location.href = '/app/login.html';
      return false;
    }
    return true;
  }
  
  /**
   * Redirect to services if already authenticated
   * Used for login/register/landing pages
   * Returns false if redirecting
   */
  function redirectIfAuthenticated() {
    if (MashriqAuth.isAuthenticated()) {
      window.location.href = '/app/services.html';
      return false;
    }
    return true;
  }
  
  return {
    requireAuth: requireAuth,
    redirectIfAuthenticated: redirectIfAuthenticated
  };
})();
