/**
 * Mashriq - Main Application Module
 * Shared utilities and UI components
 */

import { isAuthenticated, logout, getCurrentUser } from './auth.js';

/**
 * Show toast notification
 * @param {string} message - Notification message
 * @param {string} type - Type: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in milliseconds
 */
export function showToast(message, type = 'info', duration = 4000) {
  // Create container if not exists
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-message">${message}</span>
  `;
  
  container.appendChild(toast);
  
  // Auto remove after duration
  setTimeout(() => {
    toast.style.animation = 'toastSlideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Show loading overlay
 * @param {boolean} show - Show or hide
 */
export function showLoading(show = true) {
  let overlay = document.getElementById('loading-overlay');
  
  if (show) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = '<div class="loading-spinner"></div>';
      document.body.appendChild(overlay);
    }
    overlay.classList.remove('hidden');
  } else if (overlay) {
    overlay.classList.add('hidden');
  }
}

/**
 * Render navigation bar
 * @param {string} activePage - Current page name for active state
 */
export function renderNavbar(activePage = '') {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  
  const authenticated = isAuthenticated();
  const user = getCurrentUser();
  
  navbar.innerHTML = `
    <div class="container">
      <a href="/app/index.html" class="navbar-brand">
        <img src="/logo.png" alt="مشرق" class="navbar-logo">
        <span class="navbar-title">مشرق</span>
      </a>
      
      <nav>
        <ul class="navbar-nav">
          ${authenticated ? `
            <li><a href="/app/services.html" class="nav-link ${activePage === 'services' ? 'active' : ''}">الخدمات</a></li>
            <li><span class="nav-link" style="color: var(--color-text-muted);">مرحباً، ${user?.fullName || 'مستخدم'}</span></li>
            <li><button id="logout-btn" class="btn btn-ghost">تسجيل الخروج</button></li>
          ` : `
            <li><a href="/app/index.html" class="nav-link ${activePage === 'home' ? 'active' : ''}">الرئيسية</a></li>
            <li><a href="/app/login.html" class="btn btn-secondary">تسجيل الدخول</a></li>
            <li><a href="/app/register.html" class="btn btn-primary">إنشاء حساب</a></li>
          `}
        </ul>
      </nav>
    </div>
  `;
  
  // Attach logout handler
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logout();
    });
  }
}

/**
 * Render footer
 */
export function renderFooter() {
  const footer = document.getElementById('footer');
  if (!footer) return;
  
  footer.innerHTML = `
    <div class="container">
      <div class="footer-content">
        <p class="footer-text">© ${new Date().getFullYear()} مشرق - جميع الحقوق محفوظة</p>
        <div class="footer-links">
          <a href="#" class="footer-link">سياسة الخصوصية</a>
          <a href="#" class="footer-link">الشروط والأحكام</a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Format currency in Arabic
 * @param {number} amount 
 * @returns {string}
 */
export function formatCurrency(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

/**
 * Format date in Arabic locale
 * @param {string|Date} date 
 * @returns {string}
 */
export function formatDate(date) {
  return new Date(date).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Truncate text with ellipsis
 * @param {string} text 
 * @param {number} maxLength 
 * @returns {string}
 */
export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Initialize common app components
 */
export function initApp(activePage = '') {
  renderNavbar(activePage);
  renderFooter();
}

export default {
  showToast,
  showLoading,
  renderNavbar,
  renderFooter,
  formatCurrency,
  formatDate,
  truncateText,
  initApp
};
