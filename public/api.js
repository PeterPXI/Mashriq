/* ========================================
   Mashriq (مشرق) - API Client
   Freelance Services Marketplace
   للتواصل مع الخادم الخلفي
   Created by Peter Youssef
   Updated for Services & Orders System
   ======================================== */

const API = {
  // Base URL - automatically uses current origin for production
  baseURL: window.location.origin + '/api',
  
  // ============ TOKEN MANAGEMENT ============
  
  getToken() {
    return localStorage.getItem('mashriq_token');
  },
  
  setToken(token) {
    localStorage.setItem('mashriq_token', token);
  },
  
  removeToken() {
    localStorage.removeItem('mashriq_token');
  },
  
  // ============ HEADERS HELPER ============
  
  getHeaders(includeAuth = false) {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (includeAuth) {
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    
    return headers;
  },
  
  // ============ GENERIC REQUEST HANDLER ============
  
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: options.headers || this.getHeaders(options.auth)
      });
      
      const data = await response.json();
      
      // If unauthorized, clear token and redirect to login
      if (response.status === 401 || response.status === 403) {
        // Check if requires seller activation (not a login issue)
        if (data.requiresSeller) {
          return data; // Let the UI handle seller activation prompt
        }
        
        this.removeToken();
        localStorage.removeItem('mashriq_current_user');
        // Only redirect if we're not already on a public page
        const publicPages = ['index.html', 'login.html', 'register.html', 'services.html', 'service.html', 'about.html'];
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        if (!publicPages.includes(currentPage)) {
          window.location.href = 'login.html';
        }
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      return { success: false, message: 'حدث خطأ في الاتصال بالخادم' };
    }
  },
  
  // ============ AUTH ENDPOINTS ============
  
  auth: {
    async register(userData) {
      const result = await API.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData)
      });
      
      if (result.success && result.token) {
        API.setToken(result.token);
        localStorage.setItem('mashriq_current_user', JSON.stringify(result.user));
      }
      
      return result;
    },
    
    async login(email, password) {
      const result = await API.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      
      if (result.success && result.token) {
        API.setToken(result.token);
        localStorage.setItem('mashriq_current_user', JSON.stringify(result.user));
      }
      
      return result;
    },
    
    async logout() {
      API.removeToken();
      localStorage.removeItem('mashriq_current_user');
      window.location.href = 'index.html';
    },
    
    async getCurrentUser() {
      const result = await API.request('/auth/me', {
        method: 'GET',
        auth: true
      });
      
      if (result.success) {
        localStorage.setItem('mashriq_current_user', JSON.stringify(result.user));
      }
      
      return result;
    },
    
    async updateProfile(userData) {
      const result = await API.request('/auth/profile', {
        method: 'PUT',
        auth: true,
        body: JSON.stringify(userData)
      });
      
      if (result.success) {
        localStorage.setItem('mashriq_current_user', JSON.stringify(result.user));
      }
      
      return result;
    },
    
    async changePassword(currentPassword, newPassword) {
      return await API.request('/auth/password', {
        method: 'PUT',
        auth: true,
        body: JSON.stringify({ currentPassword, newPassword })
      });
    },
    
    // Activate seller mode
    async activateSeller() {
      const result = await API.request('/auth/activate-seller', {
        method: 'POST',
        auth: true
      });
      
      if (result.success && result.user) {
        // Update local user cache
        const currentUser = this.getLocalUser();
        if (currentUser) {
          currentUser.isSeller = result.user.isSeller;
          currentUser.role = result.user.role;
          localStorage.setItem('mashriq_current_user', JSON.stringify(currentUser));
        }
      }
      
      return result;
    },
    
    isLoggedIn() {
      return !!API.getToken() && !!localStorage.getItem('mashriq_current_user');
    },
    
    getLocalUser() {
      try {
        const user = localStorage.getItem('mashriq_current_user');
        return user ? JSON.parse(user) : null;
      } catch {
        return null;
      }
    },
    
    isSeller() {
      const user = this.getLocalUser();
      return user && (user.isSeller || user.role === 'seller' || user.role === 'admin');
    }
  },
  
  // ============ SERVICES ENDPOINTS ============
  
  services: {
    async getAll(filters = {}) {
      const params = new URLSearchParams(filters).toString();
      return await API.request(`/services${params ? '?' + params : ''}`);
    },
    
    async getById(id) {
      return await API.request(`/services/${id}`);
    },
    
    async getByCategory(category) {
      return await API.request(`/services?category=${category}`);
    },
    
    async search(query) {
      return await API.request(`/services?search=${encodeURIComponent(query)}`);
    },
    
    async getLatest(limit = 8) {
      return await API.request(`/services?limit=${limit}`);
    },
    
    async getMyServices() {
      return await API.request('/my-services', { auth: true });
    },
    
    async create(serviceData) {
      return await API.request('/services', {
        method: 'POST',
        auth: true,
        body: JSON.stringify(serviceData)
      });
    },
    
    async update(id, serviceData) {
      return await API.request(`/services/${id}`, {
        method: 'PUT',
        auth: true,
        body: JSON.stringify(serviceData)
      });
    },
    
    async delete(id) {
      return await API.request(`/services/${id}`, {
        method: 'DELETE',
        auth: true
      });
    }
  },
  
  // ============ ORDERS ENDPOINTS ============
  
  orders: {
    // Create new order
    async create(serviceId, buyerRequirements = '') {
      return await API.request('/orders', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ serviceId, buyerRequirements })
      });
    },
    
    // Get all orders (with optional filters)
    async getAll(filters = {}) {
      const params = new URLSearchParams(filters).toString();
      return await API.request(`/orders${params ? '?' + params : ''}`, { auth: true });
    },
    
    // Get orders as buyer
    async getAsBuyer() {
      return await API.request('/orders?role=buyer', { auth: true });
    },
    
    // Get orders as seller
    async getAsSeller() {
      return await API.request('/orders?role=seller', { auth: true });
    },
    
    // Get single order
    async getById(id) {
      return await API.request(`/orders/${id}`, { auth: true });
    },
    
    // Accept order (seller)
    async accept(id) {
      return await API.request(`/orders/${id}/accept`, {
        method: 'PUT',
        auth: true
      });
    },
    
    // Decline order (seller)
    async decline(id, reason = '') {
      return await API.request(`/orders/${id}/decline`, {
        method: 'PUT',
        auth: true,
        body: JSON.stringify({ reason })
      });
    },
    
    // Deliver order (seller)
    async deliver(id, deliveryMessage = '') {
      return await API.request(`/orders/${id}/deliver`, {
        method: 'PUT',
        auth: true,
        body: JSON.stringify({ deliveryMessage })
      });
    },
    
    // Approve delivery (buyer)
    async approve(id) {
      return await API.request(`/orders/${id}/approve`, {
        method: 'PUT',
        auth: true
      });
    },
    
    // Request revision (buyer)
    async requestRevision(id, revisionMessage = '') {
      return await API.request(`/orders/${id}/revision`, {
        method: 'PUT',
        auth: true,
        body: JSON.stringify({ revisionMessage })
      });
    }
  },
  
  // ============ REVIEWS ENDPOINTS ============
  
  reviews: {
    // Create review (after order completion)
    async create(orderId, rating, comment = '') {
      return await API.request('/reviews', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ orderId, rating, comment })
      });
    },
    
    // Get reviews for a service
    async getByService(serviceId) {
      return await API.request(`/reviews/service/${serviceId}`);
    },
    
    // Get reviews for a seller
    async getBySeller(sellerId) {
      return await API.request(`/reviews/seller/${sellerId}`);
    }
  },
  
  // ============ USERS ENDPOINTS ============
  
  users: {
    async getAll() {
      return await API.request('/users');
    },
    
    async getById(id) {
      return await API.request(`/users/${id}`);
    }
  },
  
  // ============ STATS ENDPOINTS ============
  
  stats: {
    async getPlatform() {
      return await API.request('/stats');
    },
    
    async getMy() {
      return await API.request('/my-stats', { auth: true });
    }
  }
};

// ============ USER MANAGER API ============
// High-level wrapper for authentication operations

const UserManagerAPI = {
  async register(userData) {
    return await API.auth.register(userData);
  },
  
  async login(email, password) {
    return await API.auth.login(email, password);
  },
  
  logout() {
    API.auth.logout();
  },
  
  isLoggedIn() {
    return API.auth.isLoggedIn();
  },
  
  getCurrentUser() {
    return API.auth.getLocalUser();
  },
  
  isSeller() {
    return API.auth.isSeller();
  },
  
  async activateSeller() {
    return await API.auth.activateSeller();
  },
  
  async updateProfile(userData) {
    return await API.auth.updateProfile(userData);
  }
};

// ============ SERVICE MANAGER API ============
// High-level wrapper for service operations (replaces ProductManagerAPI)

const ServiceManagerAPI = {
  async getAllServices(filters = {}) {
    const result = await API.services.getAll(filters);
    return result.success ? result.services : [];
  },
  
  async getServiceById(id) {
    const result = await API.services.getById(id);
    return result.success ? { service: result.service, seller: result.seller } : null;
  },
  
  async getLatestServices(limit = 8) {
    const result = await API.services.getLatest(limit);
    return result.success ? result.services : [];
  },
  
  async addService(serviceData) {
    return await API.services.create(serviceData);
  },
  
  async updateService(id, serviceData) {
    return await API.services.update(id, serviceData);
  },
  
  async deleteService(id) {
    return await API.services.delete(id);
  },
  
  async searchServices(query) {
    const result = await API.services.search(query);
    return result.success ? result.services : [];
  },
  
  async getMyServices() {
    const result = await API.services.getMyServices();
    return result.success ? result.services : [];
  }
};

// ============ ORDER MANAGER API ============
// High-level wrapper for order operations

const OrderManagerAPI = {
  // Create a new order
  async createOrder(serviceId, requirements = '') {
    return await API.orders.create(serviceId, requirements);
  },
  
  // Get all my orders
  async getMyOrders() {
    const result = await API.orders.getAll();
    return result.success ? result.orders : [];
  },
  
  // Get orders where I'm the buyer
  async getMyOrdersAsBuyer() {
    const result = await API.orders.getAsBuyer();
    return result.success ? result.orders : [];
  },
  
  // Get orders where I'm the seller
  async getMyOrdersAsSeller() {
    const result = await API.orders.getAsSeller();
    return result.success ? result.orders : [];
  },
  
  // Get single order details
  async getOrderById(id) {
    const result = await API.orders.getById(id);
    return result.success ? { order: result.order, review: result.review, userRole: result.userRole } : null;
  },
  
  // Seller actions
  async acceptOrder(id) {
    return await API.orders.accept(id);
  },
  
  async declineOrder(id, reason = '') {
    return await API.orders.decline(id, reason);
  },
  
  async deliverOrder(id, message = '') {
    return await API.orders.deliver(id, message);
  },
  
  // Buyer actions
  async approveOrder(id) {
    return await API.orders.approve(id);
  },
  
  async requestRevision(id, message = '') {
    return await API.orders.requestRevision(id, message);
  },
  
  // Get orders by status
  async getOrdersByStatus(status) {
    const result = await API.orders.getAll({ status });
    return result.success ? result.orders : [];
  }
};

// ============ REVIEW MANAGER API ============
// High-level wrapper for review operations

const ReviewManagerAPI = {
  async createReview(orderId, rating, comment = '') {
    return await API.reviews.create(orderId, rating, comment);
  },
  
  async getServiceReviews(serviceId) {
    const result = await API.reviews.getByService(serviceId);
    return result.success ? result.reviews : [];
  },
  
  async getSellerReviews(sellerId) {
    const result = await API.reviews.getBySeller(sellerId);
    return result.success ? result.reviews : [];
  }
};

// ============ BACKWARDS COMPATIBILITY ============
// Keep ProductManagerAPI as alias to ServiceManagerAPI during transition
// This will be REMOVED after migration is complete

const ProductManagerAPI = {
  async getAllProducts(filters = {}) {
    console.warn('⚠️ ProductManagerAPI is deprecated. Use ServiceManagerAPI instead.');
    return await ServiceManagerAPI.getAllServices(filters);
  },
  
  async getProductById(id) {
    console.warn('⚠️ ProductManagerAPI is deprecated. Use ServiceManagerAPI instead.');
    const result = await ServiceManagerAPI.getServiceById(id);
    return result ? result.service : null;
  },
  
  async getLatestProducts(limit = 8) {
    console.warn('⚠️ ProductManagerAPI is deprecated. Use ServiceManagerAPI instead.');
    return await ServiceManagerAPI.getLatestServices(limit);
  },
  
  async addProduct(productData) {
    console.warn('⚠️ ProductManagerAPI is deprecated. Use ServiceManagerAPI instead.');
    return await ServiceManagerAPI.addService(productData);
  },
  
  async updateProduct(id, productData) {
    console.warn('⚠️ ProductManagerAPI is deprecated. Use ServiceManagerAPI instead.');
    return await ServiceManagerAPI.updateService(id, productData);
  },
  
  async deleteProduct(id) {
    console.warn('⚠️ ProductManagerAPI is deprecated. Use ServiceManagerAPI instead.');
    return await ServiceManagerAPI.deleteService(id);
  },
  
  async searchProducts(query) {
    console.warn('⚠️ ProductManagerAPI is deprecated. Use ServiceManagerAPI instead.');
    return await ServiceManagerAPI.searchServices(query);
  },
  
  async getMyProducts() {
    console.warn('⚠️ ProductManagerAPI is deprecated. Use ServiceManagerAPI instead.');
    return await ServiceManagerAPI.getMyServices();
  }
};

// ============ ORDER STATUS CONSTANTS ============
// Mirror of backend ORDER_STATUSES for frontend use

const ORDER_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  DELIVERED: 'delivered',
  REVISION: 'revision',
  APPROVED: 'approved',
  COMPLETED: 'completed',
  DISPUTED: 'disputed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
};

// Human-readable status labels (Arabic)
const ORDER_STATUS_LABELS = {
  pending: 'في انتظار القبول',
  in_progress: 'جاري التنفيذ',
  delivered: 'تم التسليم',
  revision: 'طلب تعديل',
  approved: 'مقبول',
  completed: 'مكتمل',
  disputed: 'نزاع',
  cancelled: 'ملغي',
  refunded: 'مسترد'
};

// Status colors for UI
const ORDER_STATUS_COLORS = {
  pending: '#f59e0b',      // amber
  in_progress: '#3b82f6',  // blue
  delivered: '#8b5cf6',    // purple
  revision: '#f97316',     // orange
  approved: '#10b981',     // emerald
  completed: '#22c55e',    // green
  disputed: '#ef4444',     // red
  cancelled: '#6b7280',    // gray
  refunded: '#64748b'      // slate
};

// Helper function to get status info
function getOrderStatusInfo(status) {
  return {
    label: ORDER_STATUS_LABELS[status] || status,
    color: ORDER_STATUS_COLORS[status] || '#6b7280'
  };
}

console.log('🔌 Mashriq API Client loaded (Services & Orders Mode)');
