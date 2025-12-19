/**
 * Mashriq - Authentication Module
 * Handles login, register, logout operations and auth state
 */

import { post, get } from './api.js';
import { saveToken, saveUser, clearAuth, hasToken, getUser, getToken } from './utils/storage.js';

/**
 * Login user with credentials
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} - User data and token
 */
export async function login(email, password) {
  const response = await post('/auth/login', { email, password });
  
  if (response.success && response.token) {
    saveToken(response.token);
    saveUser(response.user);
  }
  
  return response;
}

/**
 * Register new user
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} - Registration response
 */
export async function register(userData) {
  const { fullName, username, email, password } = userData;
  const response = await post('/auth/register', { fullName, username, email, password });
  
  // Note: We don't auto-login after registration
  // User should be redirected to login page
  return response;
}

/**
 * Logout current user
 * Clears all stored auth data and redirects to login
 */
export function logout() {
  clearAuth();
  window.location.href = '/app/login.html';
}

/**
 * Check if user is currently authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
  return hasToken();
}

/**
 * Get current user data from storage
 * @returns {Object|null}
 */
export function getCurrentUser() {
  return getUser();
}

/**
 * Verify token with server and get fresh user data
 * @returns {Promise<Object|null>}
 */
export async function verifyAuth() {
  if (!hasToken()) {
    return null;
  }
  
  try {
    const response = await get('/auth/me');
    if (response.success && response.user) {
      saveUser(response.user);
      return response.user;
    }
    return null;
  } catch (error) {
    // Token is invalid, clear auth
    clearAuth();
    return null;
  }
}

export default {
  login,
  register,
  logout,
  isAuthenticated,
  getCurrentUser,
  verifyAuth
};
