/**
 * Mashriq - Services Page Logic
 * Handles services listing and display
 */

import { initProtectedPage } from '../guards.js';
import { initApp, showToast, formatCurrency, truncateText } from '../app.js';
import { get } from '../api.js';

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  // Protected page - require authentication
  if (!initProtectedPage()) {
    return; // User is being redirected to login
  }
  
  // Initialize common app components
  initApp('services');
  
  // Load services
  await loadServices();
  
  // Setup search/filter handlers
  setupFilters();
});

/**
 * Load services from API
 */
async function loadServices(filters = {}) {
  const container = document.getElementById('services-container');
  if (!container) return;
  
  // Show loading skeleton
  container.innerHTML = renderSkeletons(6);
  
  try {
    // Build query string
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    
    const endpoint = `/services${params.toString() ? `?${params}` : ''}`;
    const response = await get(endpoint);
    
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
    showToast(error.message || 'حدث خطأ في تحميل الخدمات', 'error');
  }
}

/**
 * Render a single service card
 * @param {Object} service 
 * @returns {string} HTML string
 */
function renderServiceCard(service) {
  const imageUrl = service.image || 'https://via.placeholder.com/600x400?text=صورة+الخدمة';
  
  return `
    <article class="service-card" data-service-id="${service.id || service._id}">
      <img src="${imageUrl}" alt="${service.title}" class="service-image" onerror="this.src='https://via.placeholder.com/600x400?text=صورة+الخدمة'">
      <div class="service-content">
        <span class="service-category">${getCategoryLabel(service.category)}</span>
        <h3 class="service-title">${service.title}</h3>
        <p class="service-seller">بواسطة: ${service.sellerName || 'بائع'}</p>
        <div class="service-footer">
          <span class="service-price">${formatCurrency(service.price)}</span>
          <span class="service-delivery">التسليم خلال ${service.deliveryTime || 3} أيام</span>
        </div>
      </div>
    </article>
  `;
}

/**
 * Render loading skeletons
 * @param {number} count 
 * @returns {string} HTML string
 */
function renderSkeletons(count) {
  const skeleton = `
    <div class="service-card">
      <div class="skeleton" style="height: 180px;"></div>
      <div class="service-content">
        <div class="skeleton" style="height: 20px; width: 60px; margin-bottom: 12px;"></div>
        <div class="skeleton" style="height: 24px; margin-bottom: 8px;"></div>
        <div class="skeleton" style="height: 16px; width: 80px; margin-bottom: 16px;"></div>
        <div class="skeleton" style="height: 24px;"></div>
      </div>
    </div>
  `;
  
  return Array(count).fill(skeleton).join('');
}

/**
 * Render empty state
 * @returns {string} HTML string
 */
function renderEmptyState() {
  return `
    <div class="empty-state" style="grid-column: 1 / -1;">
      <div class="empty-state-icon">📦</div>
      <h3 class="empty-state-title">لا توجد خدمات</h3>
      <p class="empty-state-text">لم يتم العثور على خدمات تطابق البحث</p>
    </div>
  `;
}

/**
 * Render error state
 * @param {string} message 
 * @returns {string} HTML string
 */
function renderErrorState(message) {
  return `
    <div class="empty-state" style="grid-column: 1 / -1;">
      <div class="empty-state-icon">❌</div>
      <h3 class="empty-state-title">حدث خطأ</h3>
      <p class="empty-state-text">${message}</p>
      <button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button>
    </div>
  `;
}

/**
 * Get category label in Arabic
 * @param {string} category 
 * @returns {string}
 */
function getCategoryLabel(category) {
  const labels = {
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
  const cards = document.querySelectorAll('.service-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const serviceId = card.dataset.serviceId;
      if (serviceId) {
        window.location.href = `/app/order.html?id=${serviceId}`;
      }
    });
  });
}

/**
 * Setup filter and search handlers
 */
function setupFilters() {
  const searchInput = document.getElementById('search-input');
  const categorySelect = document.getElementById('category-filter');
  
  let searchTimeout;
  
  // Search with debounce
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const category = categorySelect?.value || '';
        loadServices({ search: e.target.value, category });
      }, 500);
    });
  }
  
  // Category filter
  if (categorySelect) {
    categorySelect.addEventListener('change', (e) => {
      const search = searchInput?.value || '';
      loadServices({ category: e.target.value, search });
    });
  }
}
