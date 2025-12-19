/**
 * Mashriq - API Client
 * Central fetch wrapper with automatic auth header and 401 handling
 * No ES6 modules - works directly in browser
 */

const MashriqAPI = (function() {
  const API_BASE = '/api';
  
  /**
   * Get stored token
   */
  function getToken() {
    return localStorage.getItem('mashriq_token');
  }
  
  /**
   * Clear all auth data and redirect to login
   */
  function forceLogout() {
    localStorage.removeItem('mashriq_token');
    localStorage.removeItem('mashriq_user');
    window.location.href = '/app/login.html';
  }
  
  /**
   * Core fetch wrapper
   */
  async function request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const token = getToken();
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers
      });
      
      // Handle 401 globally
      if (response.status === 401) {
        forceLogout();
        throw new Error('جلستك انتهت. يرجى تسجيل الدخول مجدداً');
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'حدث خطأ في الطلب');
      }
      
      return data;
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('تعذر الاتصال بالخادم. تحقق من الاتصال بالإنترنت');
      }
      throw error;
    }
  }
  
  return {
    get: function(endpoint) {
      return request(endpoint, { method: 'GET' });
    },
    
    post: function(endpoint, body) {
      return request(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
      });
    },
    
    put: function(endpoint, body) {
      return request(endpoint, {
        method: 'PUT',
        body: JSON.stringify(body)
      });
    },
    
    del: function(endpoint) {
      return request(endpoint, { method: 'DELETE' });
    }
  };
})();
