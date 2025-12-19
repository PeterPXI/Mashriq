/**
 * Mashriq - API Client Module
 * Central fetch wrapper with automatic auth header and 401 handling
 */

import { getToken, clearAuth } from './utils/storage.js';

const API_BASE = '/api';

/**
 * Core fetch wrapper with authentication and error handling
 * @param {string} endpoint - API endpoint (without /api prefix)
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - JSON response
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  // Attach Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    // Handle 401 Unauthorized globally
    if (response.status === 401) {
      clearAuth();
      window.location.href = '/app/login.html';
      throw new Error('جلستك انتهت. يرجى تسجيل الدخول مجدداً');
    }
    
    const data = await response.json();
    
    // Handle non-2xx responses
    if (!response.ok) {
      throw new Error(data.message || 'حدث خطأ في الطلب');
    }
    
    return data;
  } catch (error) {
    // Network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('تعذر الاتصال بالخادم. تحقق من الاتصال بالإنترنت');
    }
    throw error;
  }
}

/**
 * GET request
 * @param {string} endpoint - API endpoint
 * @returns {Promise<Object>}
 */
export function get(endpoint) {
  return request(endpoint, { method: 'GET' });
}

/**
 * POST request
 * @param {string} endpoint - API endpoint
 * @param {Object} body - Request body
 * @returns {Promise<Object>}
 */
export function post(endpoint, body) {
  return request(endpoint, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

/**
 * PUT request
 * @param {string} endpoint - API endpoint
 * @param {Object} body - Request body
 * @returns {Promise<Object>}
 */
export function put(endpoint, body) {
  return request(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

/**
 * DELETE request
 * @param {string} endpoint - API endpoint
 * @returns {Promise<Object>}
 */
export function del(endpoint) {
  return request(endpoint, { method: 'DELETE' });
}

// Named exports for specific API calls
export const api = {
  get,
  post,
  put,
  del
};
