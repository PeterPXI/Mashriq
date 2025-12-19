/**
 * Mashriq - Register Page Logic
 * Handles registration form submission and validation
 */

import { initPublicPage } from '../guards.js';
import { initApp, showToast, showLoading } from '../app.js';
import { register } from '../auth.js';

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  // Check if user is authenticated - redirect to services
  if (!initPublicPage()) {
    return; // User is being redirected
  }
  
  // Initialize common app components
  initApp('register');
  
  // Setup form handler
  setupRegisterForm();
});

/**
 * Setup registration form submission handler
 */
function setupRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fullName = document.getElementById('fullName').value.trim();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Validation
    if (!fullName || !username || !email || !password || !confirmPassword) {
      showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
      return;
    }
    
    // Username validation
    if (username.length < 3) {
      showToast('اسم المستخدم يجب أن يكون 3 أحرف على الأقل', 'error');
      return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      showToast('اسم المستخدم يجب أن يحتوي على حروف وأرقام فقط', 'error');
      return;
    }
    
    // Email format validation
    if (!isValidEmail(email)) {
      showToast('يرجى إدخال بريد إلكتروني صحيح', 'error');
      return;
    }
    
    // Password validation
    if (password.length < 6) {
      showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
      return;
    }
    
    // Confirm password
    if (password !== confirmPassword) {
      showToast('كلمتا المرور غير متطابقتين', 'error');
      return;
    }
    
    try {
      // Disable form
      submitBtn.disabled = true;
      submitBtn.textContent = 'جاري إنشاء الحساب...';
      showLoading(true);
      
      const response = await register({ fullName, username, email, password });
      
      if (response.success) {
        showToast(response.message || 'تم إنشاء الحساب بنجاح! يرجى تسجيل الدخول', 'success');
        
        // Redirect to login page
        setTimeout(() => {
          window.location.href = '/app/login.html';
        }, 1500);
      } else {
        throw new Error(response.message || 'فشل إنشاء الحساب');
      }
    } catch (error) {
      showToast(error.message || 'حدث خطأ أثناء إنشاء الحساب', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'إنشاء حساب';
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
