/**
 * Mashriq - Storage Utility Module
 * Handles all localStorage operations for JWT tokens and user data
 */

const STORAGE_KEYS = {
  TOKEN: 'mashriq_token',
  USER: 'mashriq_user'
};

/**
 * Save authentication token
 * @param {string} token - JWT token
 */
export function saveToken(token) {
  if (token) {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  }
}

/**
 * Get stored authentication token
 * @returns {string|null} - JWT token or null
 */
export function getToken() {
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

/**
 * Remove authentication token
 */
export function removeToken() {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
}

/**
 * Save user data
 * @param {Object} user - User object
 */
export function saveUser(user) {
  if (user) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }
}

/**
 * Get stored user data
 * @returns {Object|null} - User object or null
 */
export function getUser() {
  const userData = localStorage.getItem(STORAGE_KEYS.USER);
  if (userData) {
    try {
      return JSON.parse(userData);
    } catch (e) {
      console.error('Error parsing user data:', e);
      return null;
    }
  }
  return null;
}

/**
 * Remove user data
 */
export function removeUser() {
  localStorage.removeItem(STORAGE_KEYS.USER);
}

/**
 * Clear all authentication data
 */
export function clearAuth() {
  removeToken();
  removeUser();
}

/**
 * Check if user is authenticated (has valid token)
 * @returns {boolean}
 */
export function hasToken() {
  const token = getToken();
  return token !== null && token !== '';
}
