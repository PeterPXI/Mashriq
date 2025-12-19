/**
 * Mashriq - Services Page Logic
 * Protected page - requires authentication
 */

(function() {
  // =================== AUTH CHECK ===================
  var token = localStorage.getItem('mashriq_token') || localStorage.getItem('token');
  if (!token) {
    window.location.href = '/app/login.html';
    return;
  }
  
  // =================== USER UI ===================
  var user = null;
  try {
    var userData = localStorage.getItem('mashriq_user') || localStorage.getItem('user');
    if (userData) user = JSON.parse(userData);
  } catch (e) {}
  
  var greeting = document.getElementById('user-greeting');
  if (greeting && user) {
    greeting.textContent = 'مرحباً، ' + (user.fullName || 'مستخدم');
  }
  
  // =================== LOGOUT ===================
  var logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      localStorage.removeItem('mashriq_token');
      localStorage.removeItem('token');
      localStorage.removeItem('mashriq_user');
      localStorage.removeItem('user');
      window.location.href = '/app/login.html';
    });
  }
  
  // =================== LOAD SERVICES ===================
  loadServices();
  setupFilters();
  
  /**
   * Load services from API
   */
  async function loadServices(filters) {
    filters = filters || {};
    var container = document.getElementById('services-container');
    if (!container) return;
    
    // Show loading state
    container.innerHTML = renderLoadingState();
    
    try {
      // Build query string
      var params = [];
      if (filters.category) params.push('category=' + encodeURIComponent(filters.category));
      if (filters.search) params.push('search=' + encodeURIComponent(filters.search));
      
      var url = '/api/services' + (params.length ? '?' + params.join('&') : '');
      
      var response = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      
      // Handle 401
      if (response.status === 401) {
        localStorage.clear();
        window.location.href = '/app/login.html';
        return;
      }
      
      var data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'حدث خطأ في تحميل الخدمات');
      }
      
      if (data.success && data.services) {
        if (data.services.length === 0) {
          container.innerHTML = renderEmptyState(filters);
        } else {
          container.innerHTML = data.services.map(renderServiceCard).join('');
          attachCardListeners();
        }
      } else {
        throw new Error(data.message || 'فشل تحميل الخدمات');
      }
      
    } catch (error) {
      console.error('Error loading services:', error);
      container.innerHTML = renderErrorState(error);
    }
  }
  
  // =================== RENDERING FUNCTIONS ===================
  
  /**
   * Render loading state with skeleton cards
   */
  function renderLoadingState() {
    var skeletons = '';
    for (var i = 0; i < 6; i++) {
      skeletons += '<div class="skeleton-card">' +
        '<div class="skeleton-image"></div>' +
        '<div class="skeleton-content">' +
          '<div class="skeleton-line short"></div>' +
          '<div class="skeleton-line medium"></div>' +
          '<div class="skeleton-line"></div>' +
          '<div class="skeleton-line price"></div>' +
        '</div>' +
      '</div>';
    }
    
    return '<div class="loading-state">' +
      '<div class="loading-spinner"></div>' +
      '<p class="loading-state-text">جارٍ تحميل الخدمات...</p>' +
    '</div>' + skeletons;
  }
  
  /**
   * Render empty state
   */
  function renderEmptyState(filters) {
    var hasFilters = filters && (filters.search || filters.category);
    
    if (hasFilters) {
      // Empty due to filters
      return '<div class="empty-state">' +
        '<div class="empty-state-icon">🔍</div>' +
        '<h3 class="empty-state-title">لم يتم العثور على نتائج</h3>' +
        '<p class="empty-state-text">لا توجد خدمات تطابق معايير البحث الحالية</p>' +
        '<button class="btn btn-secondary" onclick="clearFilters()">مسح البحث</button>' +
      '</div>';
    }
    
    // Empty - no services at all
    return '<div class="empty-state">' +
      '<div class="empty-state-icon">📦</div>' +
      '<h3 class="empty-state-title">لا توجد خدمات متاحة حالياً</h3>' +
      '<p class="empty-state-text">كن أول من يضيف خدمته على مشرق</p>' +
      '<a href="#" class="btn btn-primary" onclick="alert(\'قريباً!\'); return false;">أضف خدمتك</a>' +
    '</div>';
  }
  
  /**
   * Render error state
   */
  function renderErrorState(error) {
    var message = 'تعذر تحميل الخدمات';
    var details = 'يرجى المحاولة مرة أخرى';
    
    if (error && error.message) {
      if (error.message.includes('fetch') || error.message.includes('network')) {
        message = 'تعذر الاتصال بالخادم';
        details = 'تحقق من اتصالك بالإنترنت';
      } else if (error.message.includes('500') || error.message.includes('خادم')) {
        message = 'حدث خطأ في الخادم';
        details = 'يرجى المحاولة لاحقاً';
      } else {
        details = error.message;
      }
    }
    
    return '<div class="error-state">' +
      '<div class="error-state-icon">⚠️</div>' +
      '<h3 class="error-state-title">' + message + '</h3>' +
      '<p class="error-state-text">' + details + '</p>' +
      '<button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button>' +
    '</div>';
  }
  
  /**
   * Render a service card
   */
  function renderServiceCard(service) {
    var id = service.id || service._id;
    var imageUrl = service.image || 'https://via.placeholder.com/600x400/252532/ff6b35?text=خدمة';
    var category = getCategoryLabel(service.category);
    var price = formatPrice(service.price);
    var delivery = service.deliveryTime || 3;
    var seller = service.sellerName || 'بائع';
    var description = service.description || '';
    
    // Truncate description
    if (description.length > 100) {
      description = description.substring(0, 100) + '...';
    }
    
    return '<article class="service-card" data-id="' + id + '">' +
      '<img src="' + imageUrl + '" alt="' + escapeHtml(service.title) + '" class="service-image" onerror="this.src=\'https://via.placeholder.com/600x400/252532/ff6b35?text=خدمة\'">' +
      '<div class="service-content">' +
        '<span class="service-category">' + category + '</span>' +
        '<h3 class="service-title">' + escapeHtml(service.title) + '</h3>' +
        '<p class="service-description">' + escapeHtml(description) + '</p>' +
        '<p class="service-seller">بواسطة: ' + escapeHtml(seller) + '</p>' +
        '<div class="service-footer">' +
          '<span class="service-price">' + price + '</span>' +
          '<span class="service-delivery">⏱️ ' + delivery + ' أيام</span>' +
        '</div>' +
        '<div class="service-cta">' +
          '<button class="btn btn-primary btn-sm" onclick="goToOrder(\'' + id + '\')">اطلب الخدمة</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }
  
  // =================== HELPER FUNCTIONS ===================
  
  function getCategoryLabel(cat) {
    var labels = {
      'design': 'تصميم',
      'development': 'برمجة',
      'writing': 'كتابة',
      'marketing': 'تسويق',
      'video': 'فيديو',
      'translation': 'ترجمة',
      'other': 'أخرى'
    };
    return labels[cat] || cat || 'أخرى';
  }
  
  function formatPrice(price) {
    var num = Number(price) || 0;
    return '$' + num.toFixed(2);
  }
  
  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function attachCardListeners() {
    var cards = document.querySelectorAll('.service-card');
    cards.forEach(function(card) {
      card.addEventListener('click', function(e) {
        // Don't navigate if clicking the CTA button (it has its own handler)
        if (e.target.tagName === 'BUTTON') return;
        var id = card.getAttribute('data-id');
        if (id) {
          window.location.href = '/app/order.html?id=' + id;
        }
      });
    });
  }
  
  // =================== FILTERS ===================
  
  function setupFilters() {
    var searchInput = document.getElementById('search-input');
    var categorySelect = document.getElementById('category-filter');
    var timeout;
    
    if (searchInput) {
      searchInput.addEventListener('input', function(e) {
        clearTimeout(timeout);
        var search = e.target.value;
        timeout = setTimeout(function() {
          var cat = categorySelect ? categorySelect.value : '';
          loadServices({ search: search, category: cat });
        }, 500);
      });
    }
    
    if (categorySelect) {
      categorySelect.addEventListener('change', function(e) {
        var search = searchInput ? searchInput.value : '';
        loadServices({ category: e.target.value, search: search });
      });
    }
  }
  
  // =================== GLOBAL FUNCTIONS ===================
  
  // Expose to global scope for onclick handlers
  window.goToOrder = function(id) {
    window.location.href = '/app/order.html?id=' + id;
  };
  
  window.clearFilters = function() {
    var searchInput = document.getElementById('search-input');
    var categorySelect = document.getElementById('category-filter');
    if (searchInput) searchInput.value = '';
    if (categorySelect) categorySelect.value = '';
    loadServices();
  };
  
})();
