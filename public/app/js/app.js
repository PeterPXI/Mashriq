/**
 * Mashriq - Application Core
 * Shared utilities and UI components
 * No ES6 modules - works directly in browser
 */

const MashriqApp = (function() {
  
  /**
   * Show toast notification
   */
  function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 4000;
    
    var container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = '<span class="toast-message">' + message + '</span>';
    
    container.appendChild(toast);
    
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-100%)';
      setTimeout(function() { 
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  }
  
  /**
   * Show/hide loading overlay
   */
  function showLoading(show) {
    var overlay = document.getElementById('loading-overlay');
    
    if (show) {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="loading-spinner"></div>';
        document.body.appendChild(overlay);
      }
      overlay.style.display = 'flex';
    } else if (overlay) {
      overlay.style.display = 'none';
    }
  }
  
  /**
   * Render navigation bar
   */
  function renderNavbar(activePage) {
    var navbar = document.getElementById('navbar');
    if (!navbar) return;
    
    var authenticated = MashriqAuth.isAuthenticated();
    var user = MashriqAuth.getUser();
    var userName = user && user.fullName ? user.fullName : 'مستخدم';
    
    var html = '<div class="container">' +
      '<a href="/app/index.html" class="navbar-brand">' +
        '<img src="/logo.png" alt="مشرق" class="navbar-logo">' +
        '<span class="navbar-title">مشرق</span>' +
      '</a>' +
      '<nav><ul class="navbar-nav">';
    
    if (authenticated) {
      html += '<li><a href="/app/services.html" class="nav-link' + (activePage === 'services' ? ' active' : '') + '">الخدمات</a></li>' +
        '<li><span class="nav-link" style="color: var(--color-text-muted);">مرحباً، ' + userName + '</span></li>' +
        '<li><button id="logout-btn" class="btn btn-ghost">تسجيل الخروج</button></li>';
    } else {
      html += '<li><a href="/app/index.html" class="nav-link' + (activePage === 'home' ? ' active' : '') + '">الرئيسية</a></li>' +
        '<li><a href="/app/login.html" class="btn btn-secondary">تسجيل الدخول</a></li>' +
        '<li><a href="/app/register.html" class="btn btn-primary">إنشاء حساب</a></li>';
    }
    
    html += '</ul></nav></div>';
    navbar.innerHTML = html;
    
    // Attach logout handler
    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function() {
        MashriqAuth.logout();
      });
    }
  }
  
  /**
   * Render footer
   */
  function renderFooter() {
    var footer = document.getElementById('footer');
    if (!footer) return;
    
    var year = new Date().getFullYear();
    footer.innerHTML = '<div class="container">' +
      '<div class="footer-content">' +
        '<p class="footer-text">© ' + year + ' مشرق - جميع الحقوق محفوظة</p>' +
        '<div class="footer-links">' +
          '<a href="#" class="footer-link">سياسة الخصوصية</a>' +
          '<a href="#" class="footer-link">الشروط والأحكام</a>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  
  /**
   * Format currency
   */
  function formatCurrency(amount) {
    return '$' + Number(amount).toFixed(2);
  }
  
  /**
   * Initialize app components
   */
  function init(activePage) {
    renderNavbar(activePage);
    renderFooter();
  }
  
  return {
    showToast: showToast,
    showLoading: showLoading,
    renderNavbar: renderNavbar,
    renderFooter: renderFooter,
    formatCurrency: formatCurrency,
    init: init
  };
})();
