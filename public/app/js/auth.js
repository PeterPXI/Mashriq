/**
 * Mashriq - Authentication Module
 * Handles login, register, logout and auth state
 * No ES6 modules - works directly in browser
 */

const MashriqAuth = (function() {
  const TOKEN_KEY = 'mashriq_token';
  const USER_KEY = 'mashriq_user';
  
  /**
   * Save token to localStorage
   */
  function saveToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
  }
  
  /**
   * Get token from localStorage
   */
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }
  
  /**
   * Save user data to localStorage
   */
  function saveUser(user) {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }
  
  /**
   * Get user data from localStorage
   */
  function getUser() {
    const data = localStorage.getItem(USER_KEY);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        return null;
      }
    }
    return null;
  }
  
  /**
   * Clear all auth data
   */
  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
  
  /**
   * Check if user is authenticated
   */
  function isAuthenticated() {
    const token = getToken();
    return token !== null && token !== '';
  }
  
  /**
   * Login user
   */
  async function login(email, password) {
    const response = await MashriqAPI.post('/auth/login', { email, password });
    
    if (response.success && response.token) {
      saveToken(response.token);
      saveUser(response.user);
    }
    
    return response;
  }
  
  /**
   * Register new user
   */
  async function register(userData) {
    return await MashriqAPI.post('/auth/register', userData);
  }
  
  /**
   * Logout user
   */
  function logout() {
    clearAuth();
    window.location.href = '/app/login.html';
  }
  
  return {
    login: login,
    register: register,
    logout: logout,
    isAuthenticated: isAuthenticated,
    getUser: getUser,
    getToken: getToken,
    clearAuth: clearAuth
  };
})();
