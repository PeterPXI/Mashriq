/**
 * Mashriq - Order Page Logic
 * Handles service ordering functionality
 */

(function() {
  var currentService = null;
  
  document.addEventListener('DOMContentLoaded', function() {
    // Require authentication
    if (!MashriqGuards.requireAuth()) {
      return; // Redirecting to login
    }
    
    // Initialize app components
    MashriqApp.init('order');
    
    // Get service ID from URL
    var urlParams = new URLSearchParams(window.location.search);
    var serviceId = urlParams.get('id');
    
    if (!serviceId) {
      MashriqApp.showToast('لم يتم تحديد الخدمة', 'error');
      setTimeout(function() {
        window.location.href = '/app/services.html';
      }, 1500);
      return;
    }
    
    // Load service details
    loadServiceDetails(serviceId);
    
    // Setup order form
    setupOrderForm();
  });
  
  /**
   * Load service details from API
   */
  async function loadServiceDetails(serviceId) {
    var serviceContainer = document.getElementById('service-details');
    var summaryContainer = document.getElementById('order-summary-content');
    
    try {
      MashriqApp.showLoading(true);
      
      var response = await MashriqAPI.get('/services/' + serviceId);
      
      if (response.success && response.service) {
        currentService = response.service;
        
        // Check if user is trying to order their own service
        var user = MashriqAuth.getUser();
        var sellerId = currentService.sellerId;
        var userId = user ? (user.id || user._id) : null;
        
        if (userId && (sellerId === userId || String(sellerId) === String(userId))) {
          MashriqApp.showToast('لا يمكنك شراء خدمتك الخاصة', 'warning');
          setTimeout(function() {
            window.location.href = '/app/services.html';
          }, 1500);
          return;
        }
        
        renderServiceDetails(currentService, response.seller);
        renderOrderSummary(currentService);
        
      } else {
        throw new Error(response.message || 'الخدمة غير موجودة');
      }
    } catch (error) {
      console.error('Error loading service:', error);
      MashriqApp.showToast(error.message || 'حدث خطأ في تحميل الخدمة', 'error');
      
      if (serviceContainer) {
        serviceContainer.innerHTML = '<div class="empty-state">' +
          '<div class="empty-state-icon">❌</div>' +
          '<h3 class="empty-state-title">الخدمة غير موجودة</h3>' +
          '<p class="empty-state-text">' + error.message + '</p>' +
          '<a href="/app/services.html" class="btn btn-primary">العودة للخدمات</a>' +
        '</div>';
      }
    } finally {
      MashriqApp.showLoading(false);
    }
  }
  
  /**
   * Render service details
   */
  function renderServiceDetails(service, seller) {
    var container = document.getElementById('service-details');
    if (!container) return;
    
    var imageUrl = service.image || 'https://via.placeholder.com/600x400?text=خدمة';
    var sellerName = (seller && seller.fullName) ? seller.fullName : (service.sellerName || 'بائع');
    var price = MashriqApp.formatCurrency(service.price);
    var deliveryTime = service.deliveryTime || 3;
    var revisions = service.revisions || 1;
    
    container.innerHTML = '<div class="service-detail-header">' +
      '<img src="' + imageUrl + '" alt="' + service.title + '" class="service-detail-image" onerror="this.src=\'https://via.placeholder.com/600x400?text=خدمة\'">' +
      '<div class="service-detail-info">' +
        '<h1 class="service-detail-title">' + service.title + '</h1>' +
        '<div class="service-detail-seller"><span>بواسطة: <strong>' + sellerName + '</strong></span></div>' +
        '<div class="service-detail-price">' + price + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="service-detail-section">' +
      '<h3>وصف الخدمة</h3>' +
      '<p>' + service.description + '</p>' +
    '</div>' +
    '<div class="service-detail-section">' +
      '<h3>تفاصيل الخدمة</h3>' +
      '<ul class="service-detail-list">' +
        '<li>⏱️ مدة التسليم: ' + deliveryTime + ' أيام</li>' +
        '<li>🔄 عدد التعديلات: ' + revisions + '</li>' +
      '</ul>' +
    '</div>' +
    (service.requirements ? '<div class="service-detail-section"><h3>متطلبات البائع</h3><p>' + service.requirements + '</p></div>' : '');
  }
  
  /**
   * Render order summary sidebar
   */
  function renderOrderSummary(service) {
    var container = document.getElementById('order-summary-content');
    if (!container) return;
    
    var imageUrl = service.image || 'https://via.placeholder.com/80?text=خدمة';
    var sellerName = service.sellerName || 'بائع';
    var price = MashriqApp.formatCurrency(service.price);
    
    container.innerHTML = '<div class="order-service-info">' +
      '<img src="' + imageUrl + '" alt="' + service.title + '" class="order-service-image" onerror="this.src=\'https://via.placeholder.com/80?text=خدمة\'">' +
      '<div class="order-service-details">' +
        '<h4>' + service.title + '</h4>' +
        '<p>' + sellerName + '</p>' +
      '</div>' +
    '</div>' +
    '<div class="order-price-breakdown">' +
      '<div class="order-price-row"><span>سعر الخدمة</span><span>' + price + '</span></div>' +
      '<div class="order-price-row"><span>رسوم المنصة</span><span>' + MashriqApp.formatCurrency(0) + '</span></div>' +
      '<div class="order-price-row total"><span>الإجمالي</span><span class="price">' + price + '</span></div>' +
    '</div>';
  }
  
  /**
   * Setup order form submission
   */
  function setupOrderForm() {
    var form = document.getElementById('order-form');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      if (!currentService) {
        MashriqApp.showToast('يرجى الانتظار حتى يتم تحميل الخدمة', 'error');
        return;
      }
      
      var requirements = document.getElementById('buyer-requirements');
      var requirementsValue = requirements ? requirements.value.trim() : '';
      var submitBtn = form.querySelector('button[type="submit"]');
      var originalText = submitBtn.textContent;
      
      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري إنشاء الطلب...';
        MashriqApp.showLoading(true);
        
        var serviceId = currentService.id || currentService._id;
        var response = await MashriqAPI.post('/orders', {
          serviceId: serviceId,
          buyerRequirements: requirementsValue
        });
        
        if (response.success) {
          MashriqApp.showToast(response.message || 'تم إنشاء الطلب بنجاح!', 'success');
          setTimeout(function() {
            window.location.href = '/app/services.html';
          }, 1500);
        } else {
          throw new Error(response.message || 'فشل إنشاء الطلب');
        }
      } catch (error) {
        MashriqApp.showToast(error.message || 'حدث خطأ أثناء إنشاء الطلب', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      } finally {
        MashriqApp.showLoading(false);
      }
    });
  }
})();
