/**
 * Mashriq - Services Page Logic
 * Handles services listing and filtering
 */

(function() {
  document.addEventListener('DOMContentLoaded', function() {
    // Require authentication
    if (!MashriqGuards.requireAuth()) {
      return; // Redirecting to login
    }
    
    // Initialize app components
    MashriqApp.init('services');
    
    // Load services
    loadServices();
    
    // Setup filter handlers
    setupFilters();
  });
  
  /**
   * Load services from API
   */
  async function loadServices(filters) {
    filters = filters || {};
    var container = document.getElementById('services-container');
    if (!container) return;
    
    // Show loading
    container.innerHTML = renderSkeletons(6);
    
    try {
      // Build query string
      var params = [];
      if (filters.category) params.push('category=' + encodeURIComponent(filters.category));
      if (filters.search) params.push('search=' + encodeURIComponent(filters.search));
      
      var endpoint = '/services' + (params.length ? '?' + params.join('&') : '');
      var response = await MashriqAPI.get(endpoint);
      
      if (response.success && response.services) {
        if (response.services.length === 0) {
          container.innerHTML = renderEmptyState();
        } else {
          container.innerHTML = response.services.map(renderServiceCard).join('');
          attachCardListeners();
        }
      } else {
        throw new Error(response.message || 'فشل تحميل الخدمات');
      }
    } catch (error) {
      console.error('Error loading services:', error);
      container.innerHTML = renderErrorState(error.message);
      MashriqApp.showToast(error.message || 'حدث خطأ في تحميل الخدمات', 'error');
    }
  }
  
  /**
   * Render a single service card
   */
  function renderServiceCard(service) {
    var id = service.id || service._id;
    var imageUrl = service.image || 'https://via.placeholder.com/600x400?text=خدمة';
    var categoryLabel = getCategoryLabel(service.category);
    var price = MashriqApp.formatCurrency(service.price);
    var deliveryTime = service.deliveryTime || 3;
    var sellerName = service.sellerName || 'بائع';
    
    return '<article class="service-card" data-service-id="' + id + '">' +
      '<img src="' + imageUrl + '" alt="' + service.title + '" class="service-image" onerror="this.src=\'https://via.placeholder.com/600x400?text=خدمة\'">' +
      '<div class="service-content">' +
        '<span class="service-category">' + categoryLabel + '</span>' +
        '<h3 class="service-title">' + service.title + '</h3>' +
        '<p class="service-seller">بواسطة: ' + sellerName + '</p>' +
        '<div class="service-footer">' +
          '<span class="service-price">' + price + '</span>' +
          '<span class="service-delivery">التسليم خلال ' + deliveryTime + ' أيام</span>' +
        '</div>' +
      '</div>' +
    '</article>';
  }
  
  /**
   * Render loading skeletons
   */
  function renderSkeletons(count) {
    var skeleton = '<div class="service-card">' +
      '<div class="skeleton" style="height: 180px;"></div>' +
      '<div class="service-content">' +
        '<div class="skeleton" style="height: 20px; width: 60px; margin-bottom: 12px;"></div>' +
        '<div class="skeleton" style="height: 24px; margin-bottom: 8px;"></div>' +
        '<div class="skeleton" style="height: 16px; width: 80px; margin-bottom: 16px;"></div>' +
        '<div class="skeleton" style="height: 24px;"></div>' +
      '</div>' +
    '</div>';
    
    var result = '';
    for (var i = 0; i < count; i++) {
      result += skeleton;
    }
    return result;
  }
  
  /**
   * Render empty state
   */
  function renderEmptyState() {
    return '<div class="empty-state" style="grid-column: 1 / -1;">' +
      '<div class="empty-state-icon">📦</div>' +
      '<h3 class="empty-state-title">لا توجد خدمات</h3>' +
      '<p class="empty-state-text">لم يتم العثور على خدمات تطابق البحث</p>' +
    '</div>';
  }
  
  /**
   * Render error state
   */
  function renderErrorState(message) {
    return '<div class="empty-state" style="grid-column: 1 / -1;">' +
      '<div class="empty-state-icon">❌</div>' +
      '<h3 class="empty-state-title">حدث خطأ</h3>' +
      '<p class="empty-state-text">' + message + '</p>' +
      '<button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button>' +
    '</div>';
  }
  
  /**
   * Get category label in Arabic
   */
  function getCategoryLabel(category) {
    var labels = {
      'design': 'تصميم',
      'development': 'برمجة',
      'writing': 'كتابة',
      'marketing': 'تسويق',
      'video': 'فيديو',
      'translation': 'ترجمة',
      'other': 'أخرى'
    };
    return labels[category] || category || 'أخرى';
  }
  
  /**
   * Attach click listeners to service cards
   */
  function attachCardListeners() {
    var cards = document.querySelectorAll('.service-card');
    cards.forEach(function(card) {
      card.addEventListener('click', function() {
        var serviceId = card.getAttribute('data-service-id');
        if (serviceId) {
          window.location.href = '/app/order.html?id=' + serviceId;
        }
      });
    });
  }
  
  /**
   * Setup filter and search handlers
   */
  function setupFilters() {
    var searchInput = document.getElementById('search-input');
    var categorySelect = document.getElementById('category-filter');
    var searchTimeout;
    
    if (searchInput) {
      searchInput.addEventListener('input', function(e) {
        clearTimeout(searchTimeout);
        var searchValue = e.target.value;
        searchTimeout = setTimeout(function() {
          var category = categorySelect ? categorySelect.value : '';
          loadServices({ search: searchValue, category: category });
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
  
  // Expose loadServices for global access if needed
  window.loadServices = loadServices;
})();
