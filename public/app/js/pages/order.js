/**
 * Mashriq - Order Page Logic
 * Handles service ordering functionality
 */

import { initProtectedPage } from '../guards.js';
import { initApp, showToast, showLoading, formatCurrency } from '../app.js';
import { get, post } from '../api.js';
import { getCurrentUser } from '../auth.js';

let currentService = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  // Protected page - require authentication
  if (!initProtectedPage()) {
    return; // User is being redirected to login
  }
  
  // Initialize common app components
  initApp('order');
  
  // Get service ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const serviceId = urlParams.get('id');
  
  if (!serviceId) {
    showToast('لم يتم تحديد الخدمة', 'error');
    setTimeout(() => {
      window.location.href = '/app/services.html';
    }, 1500);
    return;
  }
  
  // Load service details
  await loadServiceDetails(serviceId);
  
  // Setup order form
  setupOrderForm();
});

/**
 * Load service details from API
 * @param {string} serviceId 
 */
async function loadServiceDetails(serviceId) {
  const serviceContainer = document.getElementById('service-details');
  const summaryContainer = document.getElementById('order-summary-content');
  
  try {
    showLoading(true);
    
    const response = await get(`/services/${serviceId}`);
    
    if (response.success && response.service) {
      currentService = response.service;
      
      // Check if user is trying to order their own service
      const user = getCurrentUser();
      if (user && (currentService.sellerId === user.id || currentService.sellerId === user._id)) {
        showToast('لا يمكنك شراء خدمتك الخاصة', 'warning');
        setTimeout(() => {
          window.location.href = '/app/services.html';
        }, 1500);
        return;
      }
      
      // Render service details
      renderServiceDetails(currentService, response.seller);
      renderOrderSummary(currentService);
    } else {
      throw new Error(response.message || 'الخدمة غير موجودة');
    }
  } catch (error) {
    console.error('Error loading service:', error);
    showToast(error.message || 'حدث خطأ في تحميل الخدمة', 'error');
    
    const container = document.getElementById('service-details');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">❌</div>
          <h3 class="empty-state-title">الخدمة غير موجودة</h3>
          <p class="empty-state-text">${error.message}</p>
          <a href="/app/services.html" class="btn btn-primary">العودة للخدمات</a>
        </div>
      `;
    }
  } finally {
    showLoading(false);
  }
}

/**
 * Render service details
 * @param {Object} service 
 * @param {Object} seller 
 */
function renderServiceDetails(service, seller) {
  const container = document.getElementById('service-details');
  if (!container) return;
  
  const imageUrl = service.image || 'https://via.placeholder.com/600x400?text=صورة+الخدمة';
  
  container.innerHTML = `
    <div class="service-detail-header">
      <img src="${imageUrl}" alt="${service.title}" class="service-detail-image" onerror="this.src='https://via.placeholder.com/600x400?text=صورة+الخدمة'">
      <div class="service-detail-info">
        <h1 class="service-detail-title">${service.title}</h1>
        <div class="service-detail-seller">
          <span>بواسطة: <strong>${seller?.fullName || service.sellerName || 'بائع'}</strong></span>
        </div>
        <div class="service-detail-price">${formatCurrency(service.price)}</div>
      </div>
    </div>
    
    <div class="service-detail-section">
      <h3>وصف الخدمة</h3>
      <p>${service.description}</p>
    </div>
    
    <div class="service-detail-section">
      <h3>تفاصيل الخدمة</h3>
      <ul class="service-detail-list">
        <li>⏱️ مدة التسليم: ${service.deliveryTime || 3} أيام</li>
        <li>🔄 عدد التعديلات: ${service.revisions || 1}</li>
      </ul>
    </div>
    
    ${service.requirements ? `
      <div class="service-detail-section">
        <h3>متطلبات البائع</h3>
        <p>${service.requirements}</p>
      </div>
    ` : ''}
  `;
  
  // Add custom styles for service detail
  addDetailStyles();
}

/**
 * Render order summary sidebar
 * @param {Object} service 
 */
function renderOrderSummary(service) {
  const container = document.getElementById('order-summary-content');
  if (!container) return;
  
  const imageUrl = service.image || 'https://via.placeholder.com/600x400?text=صورة+الخدمة';
  
  container.innerHTML = `
    <div class="order-service-info">
      <img src="${imageUrl}" alt="${service.title}" class="order-service-image" onerror="this.src='https://via.placeholder.com/80?text=خدمة'">
      <div class="order-service-details">
        <h4>${service.title}</h4>
        <p>${service.sellerName || 'بائع'}</p>
      </div>
    </div>
    
    <div class="order-price-breakdown">
      <div class="order-price-row">
        <span>سعر الخدمة</span>
        <span>${formatCurrency(service.price)}</span>
      </div>
      <div class="order-price-row">
        <span>رسوم المنصة</span>
        <span>${formatCurrency(0)}</span>
      </div>
      <div class="order-price-row total">
        <span>الإجمالي</span>
        <span class="price">${formatCurrency(service.price)}</span>
      </div>
    </div>
  `;
}

/**
 * Setup order form submission
 */
function setupOrderForm() {
  const form = document.getElementById('order-form');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentService) {
      showToast('يرجى الانتظار حتى يتم تحميل الخدمة', 'error');
      return;
    }
    
    const requirements = document.getElementById('buyer-requirements').value.trim();
    const submitBtn = form.querySelector('button[type="submit"]');
    
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'جاري إنشاء الطلب...';
      showLoading(true);
      
      const response = await post('/orders', {
        serviceId: currentService.id || currentService._id,
        buyerRequirements: requirements
      });
      
      if (response.success) {
        showToast(response.message || 'تم إنشاء الطلب بنجاح!', 'success');
        
        // Redirect to services (or orders page when implemented)
        setTimeout(() => {
          window.location.href = '/app/services.html';
        }, 1500);
      } else {
        throw new Error(response.message || 'فشل إنشاء الطلب');
      }
    } catch (error) {
      showToast(error.message || 'حدث خطأ أثناء إنشاء الطلب', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'تأكيد الطلب';
    } finally {
      showLoading(false);
    }
  });
}

/**
 * Add additional styles for service detail page
 */
function addDetailStyles() {
  if (document.getElementById('detail-styles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'detail-styles';
  styles.textContent = `
    .service-detail-header {
      display: flex;
      gap: var(--space-xl);
      margin-bottom: var(--space-2xl);
    }
    
    .service-detail-image {
      width: 300px;
      height: 200px;
      object-fit: cover;
      border-radius: var(--radius-lg);
      flex-shrink: 0;
    }
    
    .service-detail-info {
      flex: 1;
    }
    
    .service-detail-title {
      font-size: var(--font-size-2xl);
      margin-bottom: var(--space-md);
    }
    
    .service-detail-seller {
      color: var(--color-text-secondary);
      margin-bottom: var(--space-lg);
    }
    
    .service-detail-price {
      font-size: var(--font-size-3xl);
      font-weight: var(--font-weight-bold);
      color: var(--color-accent);
    }
    
    .service-detail-section {
      margin-bottom: var(--space-xl);
    }
    
    .service-detail-section h3 {
      font-size: var(--font-size-lg);
      margin-bottom: var(--space-md);
      color: var(--color-text-primary);
    }
    
    .service-detail-section p {
      color: var(--color-text-secondary);
      line-height: var(--line-height-relaxed);
    }
    
    .service-detail-list {
      list-style: none;
      padding: 0;
    }
    
    .service-detail-list li {
      padding: var(--space-sm) 0;
      color: var(--color-text-secondary);
    }
    
    @media (max-width: 768px) {
      .service-detail-header {
        flex-direction: column;
      }
      
      .service-detail-image {
        width: 100%;
        height: 200px;
      }
    }
  `;
  
  document.head.appendChild(styles);
}
