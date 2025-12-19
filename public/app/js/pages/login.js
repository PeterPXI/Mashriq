/**
 * Mashriq - Login Page Logic
 * Handles login form submission and validation
 */

import { initPublicPage } from '../guards.js';
import { initApp, showToast, showLoading } from '../app.js';
import { login } from '../auth.js';

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  // Check if user is authenticated - redirect to services
  if (!initPublicPage()) {
    return; // User is being redirected
  }
  
  // Initialize common app components
  initApp('login');
  
  // Setup form handler
  setupLoginForm();
});

/**
 * Setup login form submission handler
 */
function setupLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Validation
    if (!email || !password) {
      showToast('يرجى إدخال البريد الإلكتروني وكلمة المرور', 'error');
      return;
    }
    
    // Email format validation
    if (!isValidEmail(email)) {
      showToast('يرجى إدخال بريد إلكتروني صحيح', 'error');
      return;
    }
    
    try {
      // Disable form
      submitBtn.disabled = true;
      submitBtn.textContent = 'جاري تسجيل الدخول...';
      showLoading(true);
      
      const response = await login(email, password);
      
      if (response.success) {
        showToast(response.message || 'تم تسجيل الدخول بنجاح!', 'success');
        
        // Redirect to services page
        setTimeout(() => {
          window.location.href = '/app/services.html';
        }, 500);
      } else {
        throw new Error(response.message || 'فشل تسجيل الدخول');
      }
    } catch (error) {
      showToast(error.message || 'حدث خطأ أثناء تسجيل الدخول', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'تسجيل الدخول';
    } finally {
      showLoading(false);
    }
  });
}

/**
 * Validate email format
 * @param {string} email 
 * @returns {boolean}
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
