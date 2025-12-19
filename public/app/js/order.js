/**
 * Mashriq - Order Page Logic
 * Protected page - requires authentication
 */

(function() {
  // =================== CONSTANTS ===================
  var MIN_REQUIREMENTS_LENGTH = 20;
  
  // =================== AUTH CHECK ===================
  var token = localStorage.getItem('mashriq_token') || localStorage.getItem('token');
  if (!token) {
    window.location.href = '/app/login.html';
    return;
  }
  
  // =================== CURRENT USER ===================
  var currentUser = null;
  try {
    var userData = localStorage.getItem('mashriq_user') || localStorage.getItem('user');
    if (userData) currentUser = JSON.parse(userData);
  } catch (e) {}
  
  // =================== LOGOUT ===================
  var logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      localStorage.clear();
      window.location.href = '/app/login.html';
    });
  }
  
  // =================== GET SERVICE ID ===================
  var urlParams = new URLSearchParams(window.location.search);
  var serviceId = urlParams.get('id');
  
  if (!serviceId) {
    showErrorState('لم يتم تحديد الخدمة', 'يرجى اختيار خدمة من صفحة الخدمات');
    return;
  }
  
  var currentService = null;
  
  // Load service details
  loadServiceDetails(serviceId);
  
  // =================== LOAD SERVICE ===================
  
  async function loadServiceDetails(id) {
    var container = document.getElementById('order-content');
    
    try {
      var response = await fetch('/api/services/' + id, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      
      // Handle 401
      if (response.status === 401) {
        localStorage.clear();
        window.location.href = '/app/login.html';
        return;
      }
      
      // Handle 404
      if (response.status === 404) {
        showErrorState('الخدمة غير موجودة', 'ربما تم حذفها أو أن الرابط غير صحيح');
        return;
      }
      
      var data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'فشل تحميل تفاصيل الخدمة');
      }
      
      if (!data.service) {
        showErrorState('الخدمة غير موجودة', 'لم يتم العثور على الخدمة المطلوبة');
        return;
      }
      
      currentService = data.service;
      
      // Check if user is buying their own service
      var sellerId = currentService.sellerId || (currentService.seller && currentService.seller._id);
      var userId = currentUser ? (currentUser.id || currentUser._id) : null;
      
      if (userId && String(sellerId) === String(userId)) {
        showErrorState('لا يمكنك شراء خدمتك', 'لا يمكنك طلب خدمة قمت بإنشائها بنفسك');
        return;
      }
      
      // Render the order page
      renderOrderPage(currentService, data.seller);
      
    } catch (error) {
      console.error('Error loading service:', error);
      
      if (error.name === 'TypeError' || error.message.includes('fetch')) {
        showErrorState('تعذر الاتصال بالخادم', 'تحقق من اتصالك بالإنترنت وحاول مرة أخرى');
      } else {
        showErrorState('حدث خطأ', error.message || 'تعذر تحميل تفاصيل الخدمة');
      }
    }
  }
  
  // =================== RENDER FUNCTIONS ===================
  
  function showErrorState(title, message) {
    var container = document.getElementById('order-content');
    container.innerHTML = '<div class="error-state">' +
      '<div class="error-state-icon">⚠️</div>' +
      '<h3 class="error-state-title">' + escapeHtml(title) + '</h3>' +
      '<p class="error-state-text">' + escapeHtml(message) + '</p>' +
      '<a href="/app/services.html" class="btn btn-primary">العودة للخدمات</a>' +
    '</div>';
  }
  
  function showSuccessState() {
    var container = document.getElementById('order-content');
    container.innerHTML = '<div class="success-state">' +
      '<div class="success-state-icon">✅</div>' +
      '<h3 class="success-state-title">تم إرسال طلبك بنجاح!</h3>' +
      '<p class="success-state-text">سيتواصل معك البائع قريباً لبدء العمل على طلبك</p>' +
      '<a href="/app/services.html" class="btn btn-primary">استعرض خدمات أخرى</a>' +
    '</div>';
  }
  
  function renderOrderPage(service, seller) {
    var container = document.getElementById('order-content');
    var sellerName = (seller && seller.fullName) ? seller.fullName : (service.sellerName || 'بائع');
    var category = getCategoryLabel(service.category);
    var price = formatPrice(service.price);
    var delivery = service.deliveryTime || 3;
    var imageUrl = service.image || 'https://via.placeholder.com/100x80/252532/ff6b35?text=خدمة';
    var description = service.description || 'لا يوجد وصف متاح';
    
    container.innerHTML = '<div class="order-layout">' +
      // Left column - Order form
      '<div class="order-form-section">' +
        '<h2 class="order-form-title">تفاصيل الطلب</h2>' +
        
        // Service details
        '<div style="margin-bottom: var(--space-xl);">' +
          '<h3 style="font-size: var(--font-size-lg); margin-bottom: var(--space-md);">' + escapeHtml(service.title) + '</h3>' +
          '<p style="color: var(--color-text-secondary); line-height: 1.7;">' + escapeHtml(description) + '</p>' +
        '</div>' +
        
        // Order form
        '<form id="order-form">' +
          '<div id="form-message" class="inline-message"></div>' +
          
          '<div class="form-group">' +
            '<label class="form-label">اشرح للمستقل تفاصيل طلبك</label>' +
            '<div class="textarea-wrapper">' +
              '<textarea id="requirements" class="form-input" rows="6" ' +
                'placeholder="اكتب هنا تفاصيل ما تحتاجه بوضوح. كلما كانت التفاصيل أكثر دقة، كانت النتيجة أفضل..."></textarea>' +
              '<span id="char-counter" class="textarea-counter">0 / ' + MIN_REQUIREMENTS_LENGTH + ' حرف على الأقل</span>' +
            '</div>' +
          '</div>' +
          
          '<button type="submit" id="submit-btn" class="btn btn-primary btn-lg btn-block" disabled>' +
            'تأكيد الطلب - ' + price +
          '</button>' +
          
          '<p style="text-align: center; margin-top: var(--space-md); font-size: var(--font-size-sm); color: var(--color-text-muted);">' +
            'بالضغط على تأكيد الطلب، أنت توافق على شروط الاستخدام' +
          '</p>' +
        '</form>' +
      '</div>' +
      
      // Right column - Order summary
      '<aside class="service-summary">' +
        '<div class="service-summary-header">' +
          '<img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(service.title) + '" class="service-summary-image" ' +
            'onerror="this.src=\'https://via.placeholder.com/100x80/252532/ff6b35?text=خدمة\'">' +
          '<div class="service-summary-info">' +
            '<span class="service-summary-category">' + category + '</span>' +
            '<h4 class="service-summary-title">' + escapeHtml(service.title) + '</h4>' +
            '<p class="service-summary-seller">بواسطة: ' + escapeHtml(sellerName) + '</p>' +
          '</div>' +
        '</div>' +
        
        '<div class="service-summary-details">' +
          '<div class="service-summary-row">' +
            '<span>سعر الخدمة</span>' +
            '<span>' + price + '</span>' +
          '</div>' +
          '<div class="service-summary-row">' +
            '<span>مدة التسليم</span>' +
            '<span>' + delivery + ' أيام</span>' +
          '</div>' +
          '<div class="service-summary-row">' +
            '<span>رسوم المنصة</span>' +
            '<span>$0.00</span>' +
          '</div>' +
          '<div class="service-summary-row total">' +
            '<span>الإجمالي</span>' +
            '<span class="value">' + price + '</span>' +
          '</div>' +
        '</div>' +
      '</aside>' +
    '</div>';
    
    // Setup form handlers
    setupOrderForm();
  }
  
  // =================== ORDER FORM ===================
  
  function setupOrderForm() {
    var form = document.getElementById('order-form');
    var textarea = document.getElementById('requirements');
    var counter = document.getElementById('char-counter');
    var submitBtn = document.getElementById('submit-btn');
    var formMessage = document.getElementById('form-message');
    var isSubmitting = false;
    
    // Character counter
    textarea.addEventListener('input', function() {
      var length = textarea.value.trim().length;
      counter.textContent = length + ' / ' + MIN_REQUIREMENTS_LENGTH + ' حرف على الأقل';
      
      if (length >= MIN_REQUIREMENTS_LENGTH) {
        counter.className = 'textarea-counter';
        submitBtn.disabled = false;
      } else if (length >= MIN_REQUIREMENTS_LENGTH * 0.5) {
        counter.className = 'textarea-counter warning';
        submitBtn.disabled = true;
      } else {
        counter.className = 'textarea-counter';
        submitBtn.disabled = true;
      }
    });
    
    // Form submission
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      if (isSubmitting) return;
      
      var requirements = textarea.value.trim();
      
      // Validation
      if (requirements.length < MIN_REQUIREMENTS_LENGTH) {
        showFormMessage('يرجى كتابة ' + MIN_REQUIREMENTS_LENGTH + ' حرف على الأقل لتوضيح متطلباتك', 'error');
        return;
      }
      
      if (!currentService) {
        showFormMessage('حدث خطأ. يرجى تحديث الصفحة', 'error');
        return;
      }
      
      // Start submission
      isSubmitting = true;
      submitBtn.disabled = true;
      submitBtn.classList.add('btn-loading');
      hideFormMessage();
      
      try {
        var response = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({
            serviceId: currentService.id || currentService._id,
            buyerRequirements: requirements
          })
        });
        
        // Handle 401
        if (response.status === 401) {
          localStorage.clear();
          window.location.href = '/app/login.html';
          return;
        }
        
        var data = await response.json();
        
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'فشل إنشاء الطلب');
        }
        
        // Success!
        showSuccessState();
        
      } catch (error) {
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        
        if (error.name === 'TypeError' || error.message.includes('fetch')) {
          showFormMessage('تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت', 'error');
        } else {
          showFormMessage(error.message || 'حدث خطأ أثناء إنشاء الطلب', 'error');
        }
      }
    });
    
    function showFormMessage(message, type) {
      formMessage.textContent = message;
      formMessage.className = 'inline-message visible ' + type;
    }
    
    function hideFormMessage() {
      formMessage.className = 'inline-message';
    }
  }
  
  // =================== HELPERS ===================
  
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
  
})();
