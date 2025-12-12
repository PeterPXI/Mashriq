/* ========================================
   Mashriq (مشرق) - API Client
   للتواصل مع الخادم الخلفي
   Created by Peter Youssef
   ======================================== */

const API = {
  // Base URL - automatically uses current origin for production
  baseURL: window.location.origin + '/api',
  
  // Token management
  getToken() {
    return localStorage.getItem('mashriq_token');
  },
  
  setToken(token) {
    localStorage.setItem('mashriq_token', token);
  },
  
  removeToken() {
    localStorage.removeItem('mashriq_token');
  },
  
  // Headers helper
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
  
  // Generic request handler
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: options.headers || this.getHeaders(options.auth)
      });
      
      const data = await response.json();
      
      // If unauthorized, clear token and redirect to login
      if (response.status === 401 || response.status === 403) {
        this.removeToken();
        localStorage.removeItem('edumarket_current_user');
        // Only redirect if we're not already on a public page
        const publicPages = ['index.html', 'login.html', 'register.html', 'products.html', 'product.html', 'about.html'];
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        if (!publicPages.includes(currentPage)) {
          window.location.href = 'login.html';
        }
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      // If server is not available, fall back to localStorage
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.warn('Server not available, using localStorage fallback');
        return { success: false, offline: true, message: 'الخادم غير متاح، يتم استخدام التخزين المحلي' };
      }
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
        localStorage.setItem('edumarket_current_user', JSON.stringify(result.user));
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
        localStorage.setItem('edumarket_current_user', JSON.stringify(result.user));
      }
      
      return result;
    },
    
    async logout() {
      API.removeToken();
      localStorage.removeItem('edumarket_current_user');
      window.location.href = 'index.html';
    },
    
    async getCurrentUser() {
      const result = await API.request('/auth/me', {
        method: 'GET',
        auth: true
      });
      
      if (result.success) {
        localStorage.setItem('edumarket_current_user', JSON.stringify(result.user));
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
        localStorage.setItem('edumarket_current_user', JSON.stringify(result.user));
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
    
    isLoggedIn() {
      return !!API.getToken() && !!localStorage.getItem('edumarket_current_user');
    },
    
    getLocalUser() {
      try {
        const user = localStorage.getItem('edumarket_current_user');
        return user ? JSON.parse(user) : null;
      } catch {
        return null;
      }
    }
  },
  
  // ============ PRODUCTS ENDPOINTS ============
  
  products: {
    async getAll(filters = {}) {
      const params = new URLSearchParams(filters).toString();
      return await API.request(`/products${params ? '?' + params : ''}`);
    },
    
    async getById(id) {
      return await API.request(`/products/${id}`);
    },
    
    async getByCategory(category) {
      return await API.request(`/products?category=${category}`);
    },
    
    async search(query) {
      return await API.request(`/products?search=${encodeURIComponent(query)}`);
    },
    
    async getLatest(limit = 8) {
      return await API.request(`/products?limit=${limit}`);
    },
    
    async getMyProducts() {
      return await API.request('/my-products', { auth: true });
    },
    
    async create(productData) {
      return await API.request('/products', {
        method: 'POST',
        auth: true,
        body: JSON.stringify(productData)
      });
    },
    
    async update(id, productData) {
      return await API.request(`/products/${id}`, {
        method: 'PUT',
        auth: true,
        body: JSON.stringify(productData)
      });
    },
    
    async delete(id) {
      return await API.request(`/products/${id}`, {
        method: 'DELETE',
        auth: true
      });
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

// Enhanced UserManager that uses both API and localStorage fallback
const UserManagerAPI = {
  async register(userData) {
    const result = await API.auth.register(userData);
    
    // If offline, use localStorage fallback
    if (result.offline) {
      return UserManager.register(userData);
    }
    
    return result;
  },
  
  async login(email, password) {
    const result = await API.auth.login(email, password);
    
    // If offline, use localStorage fallback
    if (result.offline) {
      return UserManager.login(email, password);
    }
    
    return result;
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
  
  async updateProfile(userData) {
    const result = await API.auth.updateProfile(userData);
    
    if (result.offline) {
      return UserManager.updateUser(userData);
    }
    
    return result;
  }
};

// Enhanced ProductManager that uses both API and localStorage fallback
const ProductManagerAPI = {
  async getAllProducts(filters = {}) {
    const result = await API.products.getAll(filters);
    
    if (result.offline) {
      return ProductManager.getAllProducts();
    }
    
    return result.success ? result.products : [];
  },
  
  async getProductById(id) {
    const result = await API.products.getById(id);
    
    if (result.offline) {
      return ProductManager.getProductById(parseInt(id));
    }
    
    return result.success ? result.product : null;
  },
  
  async getLatestProducts(limit = 8) {
    const result = await API.products.getLatest(limit);
    
    if (result.offline) {
      return ProductManager.getLatestProducts(limit);
    }
    
    return result.success ? result.products : [];
  },
  
  async addProduct(productData) {
    const result = await API.products.create(productData);
    
    if (result.offline) {
      return ProductManager.addProduct(productData);
    }
    
    return result;
  },
  
  async updateProduct(id, productData) {
    const result = await API.products.update(id, productData);
    
    if (result.offline) {
      return ProductManager.updateProduct(parseInt(id), productData);
    }
    
    return result;
  },
  
  async deleteProduct(id) {
    const result = await API.products.delete(id);
    
    if (result.offline) {
      return ProductManager.deleteProduct(parseInt(id));
    }
    
    return result;
  },
  
  async searchProducts(query) {
    const result = await API.products.search(query);
    
    if (result.offline) {
      return ProductManager.searchProducts(query);
    }
    
    return result.success ? result.products : [];
  },
  
  async getMyProducts() {
    const result = await API.products.getMyProducts();
    
    if (result.offline) {
      const user = UserManager.getCurrentUser();
      if (user) {
        return ProductManager.getProductsBySeller(user.id);
      }
      return [];
    }
    
    return result.success ? result.products : [];
  }
};

console.log('🔌 EduMarket API Client loaded');
