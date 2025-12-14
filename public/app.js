/* ========================================
   EduMarket - Main Application JavaScript
   Created by Peter Youssef
   ======================================== */

// ============ CONFIGURATION ============
const CONFIG = {
  storageKeys: {
    users: 'edumarket_users',
    currentUser: 'edumarket_current_user',
    products: 'edumarket_products',
    cart: 'edumarket_cart'
  },
  categories: {
    programming: { name: 'برمجة وتطوير', icon: 'fas fa-code' },
    design: { name: 'تصميم جرافيك', icon: 'fas fa-palette' },
    art: { name: 'فنون ورسم', icon: 'fas fa-paint-brush' },
    crafts: { name: 'أشغال يدوية', icon: 'fas fa-hand-sparkles' },
    education: { name: 'خدمات تعليمية', icon: 'fas fa-book' },
    other: { name: 'خدمات أخرى', icon: 'fas fa-ellipsis-h' }
  }
};

// ============ SAMPLE DATA ============
const SAMPLE_PRODUCTS = [
  {
    id: 1,
    title: 'تصميم موقع ويب احترافي',
    description: 'تصميم موقع ويب متجاوب وعصري باستخدام أحدث التقنيات',
    price: 500,
    category: 'programming',
    image: 'https://images.unsplash.com/photo-1547658719-da2b51169166?w=600&h=400&fit=crop',
    sellerId: 'sample1',
    sellerName: 'أحمد محمد',
    rating: 4.8,
    reviews: 12,
    createdAt: Date.now()
  },
  {
    id: 2,
    title: 'تصميم شعار وهوية بصرية',
    description: 'تصميم شعار فريد مع ملفات قابلة للتعديل وهوية بصرية كاملة',
    price: 300,
    category: 'design',
    image: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=600&h=400&fit=crop',
    sellerId: 'sample2',
    sellerName: 'سارة أحمد',
    rating: 4.9,
    reviews: 25,
    createdAt: Date.now()
  },
  {
    id: 3,
    title: 'لوحة فنية مرسومة يدوياً',
    description: 'لوحة فنية أصلية مرسومة بالألوان الزيتية على قماش حقيقي',
    price: 450,
    category: 'art',
    image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&h=400&fit=crop',
    sellerId: 'sample3',
    sellerName: 'محمد علي',
    rating: 5.0,
    reviews: 8,
    createdAt: Date.now()
  },
  {
    id: 4,
    title: 'إكسسوارات يدوية مميزة',
    description: 'مجموعة من الإكسسوارات المصنوعة يدوياً بتصاميم فريدة',
    price: 150,
    category: 'crafts',
    image: 'https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=600&h=400&fit=crop',
    sellerId: 'sample4',
    sellerName: 'نور الهدى',
    rating: 4.7,
    reviews: 15,
    createdAt: Date.now()
  },
  {
    id: 5,
    title: 'دروس خصوصية في البرمجة',
    description: 'دروس أونلاين في أساسيات البرمجة وتطوير المواقع للمبتدئين',
    price: 100,
    category: 'education',
    image: 'https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=600&h=400&fit=crop',
    sellerId: 'sample5',
    sellerName: 'خالد عبدالله',
    rating: 4.6,
    reviews: 30,
    createdAt: Date.now()
  },
  {
    id: 6,
    title: 'تطبيق موبايل متكامل',
    description: 'تطوير تطبيق موبايل لنظامي Android و iOS بتصميم احترافي',
    price: 800,
    category: 'programming',
    image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&h=400&fit=crop',
    sellerId: 'sample1',
    sellerName: 'أحمد محمد',
    rating: 4.9,
    reviews: 18,
    createdAt: Date.now()
  },
  {
    id: 7,
    title: 'تصميم بوستر إعلاني',
    description: 'تصميم بوستر إعلاني جذاب لوسائل التواصل الاجتماعي',
    price: 80,
    category: 'design',
    image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&h=400&fit=crop',
    sellerId: 'sample2',
    sellerName: 'سارة أحمد',
    rating: 4.8,
    reviews: 40,
    createdAt: Date.now()
  },
  {
    id: 8,
    title: 'مونتاج فيديوهات احترافي',
    description: 'مونتاج فيديوهات بجودة عالية مع مؤثرات بصرية وصوتية مميزة',
    price: 200,
    category: 'other',
    image: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=600&h=400&fit=crop',
    sellerId: 'sample6',
    sellerName: 'يوسف حسن',
    rating: 4.7,
    reviews: 22,
    createdAt: Date.now()
  }
];

// ============ STORAGE UTILITIES ============
const Storage = {
  get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Error reading from localStorage:', e);
      return null;
    }
  },
  
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Error writing to localStorage:', e);
      return false;
    }
  },
  
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error('Error removing from localStorage:', e);
      return false;
    }
  }
};

// ============ USER MANAGEMENT ============
const UserManager = {
  getAllUsers() {
    return Storage.get(CONFIG.storageKeys.users) || [];
  },
  
  saveUsers(users) {
    return Storage.set(CONFIG.storageKeys.users, users);
  },
  
  getCurrentUser() {
    return Storage.get(CONFIG.storageKeys.currentUser);
  },
  
  setCurrentUser(user) {
    return Storage.set(CONFIG.storageKeys.currentUser, user);
  },
  
  logout() {
    Storage.remove(CONFIG.storageKeys.currentUser);
    window.location.href = 'index.html';
  },
  
  register(userData) {
    const users = this.getAllUsers();
    
    // Check if email already exists
    if (users.find(u => u.email === userData.email)) {
      return { success: false, message: 'البريد الإلكتروني مستخدم بالفعل' };
    }
    
    // Check if username already exists
    if (users.find(u => u.username === userData.username)) {
      return { success: false, message: 'اسم المستخدم مستخدم بالفعل' };
    }
    
    const newUser = {
      id: 'user_' + Date.now(),
      ...userData,
      createdAt: Date.now(),
      products: [],
      sales: 0,
      rating: 5.0, // Start with 5 stars for encouragement
      avatar: userData.name.charAt(0).toUpperCase()
    };
    
    users.push(newUser);
    const saveResult = this.saveUsers(users);
    
    if (!saveResult) {
       return { success: false, message: 'حدث خطأ أثناء حفظ البيانات، تأكد من مساحة التخزين' };
    }

    // Auto login
    const { password, ...userWithoutPassword } = newUser;
    this.setCurrentUser(userWithoutPassword);
    
    return { success: true, user: userWithoutPassword };
  },
  
  login(email, password) {
    const users = this.getAllUsers();
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) {
      return { success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
    }
    
    const { password: _, ...userWithoutPassword } = user;
    this.setCurrentUser(userWithoutPassword);
    
    return { success: true, user: userWithoutPassword };
  },
  
  isLoggedIn() {
    return this.getCurrentUser() !== null;
  },
  
  updateUser(updates) {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return false;
    
    const users = this.getAllUsers();
    const index = users.findIndex(u => u.id === currentUser.id);
    
    if (index === -1) return false;
    
    users[index] = { ...users[index], ...updates };
    this.saveUsers(users);
    
    const { password, ...userWithoutPassword } = users[index];
    this.setCurrentUser(userWithoutPassword);
    
    return true;
  }
};

// ============ PRODUCT MANAGEMENT ============
const ProductManager = {
  initializeProducts() {
    const existingProducts = Storage.get(CONFIG.storageKeys.products);
    if (!existingProducts || existingProducts.length === 0) {
      Storage.set(CONFIG.storageKeys.products, SAMPLE_PRODUCTS);
    }
  },
  
  getAllProducts() {
    return Storage.get(CONFIG.storageKeys.products) || SAMPLE_PRODUCTS;
  },
  
  saveProducts(products) {
    return Storage.set(CONFIG.storageKeys.products, products);
  },
  
  getProductById(id) {
    const products = this.getAllProducts();
    return products.find(p => p.id === id);
  },
  
  getProductsByCategory(category) {
    const products = this.getAllProducts();
    return products.filter(p => p.category === category);
  },
  
  getProductsBySeller(sellerId) {
    const products = this.getAllProducts();
    return products.filter(p => p.sellerId === sellerId);
  },
  
  addProduct(productData) {
    const currentUser = UserManager.getCurrentUser();
    if (!currentUser) {
      return { success: false, message: 'يجب تسجيل الدخول أولاً' };
    }
    
    const products = this.getAllProducts();
    const newProduct = {
      id: Date.now(),
      ...productData,
      sellerId: currentUser.id,
      sellerName: currentUser.name,
      rating: 0,
      reviews: 0,
      createdAt: Date.now()
    };
    
    products.unshift(newProduct);
    this.saveProducts(products);
    
    return { success: true, product: newProduct };
  },
  
  updateProduct(id, updates) {
    const products = this.getAllProducts();
    const index = products.findIndex(p => p.id === id);
    
    if (index === -1) {
      return { success: false, message: 'المنتج غير موجود' };
    }
    
    products[index] = { ...products[index], ...updates };
    this.saveProducts(products);
    
    return { success: true, product: products[index] };
  },
  
  deleteProduct(id) {
    const products = this.getAllProducts();
    const filteredProducts = products.filter(p => p.id !== id);
    this.saveProducts(filteredProducts);
    return { success: true };
  },
  
  searchProducts(query) {
    const products = this.getAllProducts();
    const searchTerm = query.toLowerCase();
    return products.filter(p => 
      p.title.toLowerCase().includes(searchTerm) ||
      p.description.toLowerCase().includes(searchTerm) ||
      p.sellerName.toLowerCase().includes(searchTerm)
    );
  },
  
  getLatestProducts(limit = 8) {
    const products = this.getAllProducts();
    return products.slice(0, limit);
  }
};

// ============ CART MANAGEMENT ============
const CartManager = {
  getCart() {
    return Storage.get(CONFIG.storageKeys.cart) || [];
  },
  
  saveCart(cart) {
    return Storage.set(CONFIG.storageKeys.cart, cart);
  },
  
  addToCart(productId) {
    const cart = this.getCart();
    const product = ProductManager.getProductById(productId);
    
    if (!product) {
      return { success: false, message: 'المنتج غير موجود' };
    }
    
    const existingItem = cart.find(item => item.productId === productId);
    
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({
        productId,
        quantity: 1,
        addedAt: Date.now()
      });
    }
    
    this.saveCart(cart);
    this.updateCartBadge();
    return { success: true };
  },
  
  removeFromCart(productId) {
    const cart = this.getCart();
    const filteredCart = cart.filter(item => item.productId !== productId);
    this.saveCart(filteredCart);
    this.updateCartBadge();
    return { success: true };
  },
  
  updateQuantity(productId, quantity) {
    const cart = this.getCart();
    const item = cart.find(item => item.productId === productId);
    
    if (item) {
      item.quantity = Math.max(1, quantity);
      this.saveCart(cart);
      this.updateCartBadge();
    }
    
    return { success: true };
  },
  
  clearCart() {
    this.saveCart([]);
    this.updateCartBadge();
  },
  
  getCartTotal() {
    const cart = this.getCart();
    return cart.reduce((total, item) => {
      const product = ProductManager.getProductById(item.productId);
      return total + (product ? product.price * item.quantity : 0);
    }, 0);
  },
  
  getCartCount() {
    const cart = this.getCart();
    return cart.reduce((count, item) => count + item.quantity, 0);
  },
  
  updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (badge) {
      const count = this.getCartCount();
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  }
};

// ============ UI UTILITIES ============
const UI = {
  showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },
  
  formatPrice(price) {
    return `${price} جنيه`;
  },
  
  formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },
  
  getCategoryName(categoryId) {
    return CONFIG.categories[categoryId]?.name || categoryId;
  },
  
  getCategoryIcon(categoryId) {
    return CONFIG.categories[categoryId]?.icon || 'fas fa-tag';
  },
  
  renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '';
    
    for (let i = 0; i < fullStars; i++) {
      stars += '<i class="fas fa-star"></i>';
    }
    if (hasHalfStar) {
      stars += '<i class="fas fa-star-half-alt"></i>';
    }
    for (let i = fullStars + (hasHalfStar ? 1 : 0); i < 5; i++) {
      stars += '<i class="far fa-star"></i>';
    }
    
    return stars;
  },
  
  createProductCard(product) {
    return `
      <article class="product-card" data-id="${product.id}">
        <div class="product-image">
          <img src="${product.image}" alt="${product.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/600x400?text=صورة+المنتج'">
          <span class="product-category-badge">
            <i class="${UI.getCategoryIcon(product.category)}"></i>
            ${UI.getCategoryName(product.category)}
          </span>
        </div>
        <div class="product-content">
          <h3 class="product-title">${product.title}</h3>
          <div class="product-seller">
            <i class="fas fa-user-circle"></i>
            <span>${product.sellerName}</span>
          </div>
          <div class="product-footer">
            <div class="product-price">
              ${product.price}
              <span>جنيه</span>
            </div>
            <div class="product-rating">
              <i class="fas fa-star"></i>
              <span>${product.rating.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </article>
    `;
  },
  
  updateAuthButtons() {
    const authButtonsContainer = document.getElementById('authButtons');
    if (!authButtonsContainer) return;
    
    const isLoggedIn = UserManager.isLoggedIn();
    const currentUser = UserManager.getCurrentUser();
    
    if (isLoggedIn && currentUser) {
      authButtonsContainer.innerHTML = `
        <a href="dashboard.html" class="btn sm">
          <i class="fas fa-th-large"></i>
          لوحة التحكم
        </a>
        <div class="user-menu">
          <button class="user-avatar" id="userMenuBtn">
            <span>${currentUser.avatar || currentUser.name.charAt(0)}</span>
          </button>
          <div class="user-dropdown" id="userDropdown">
            <div class="dropdown-header">
              <span class="user-name">${currentUser.name}</span>
              <span class="user-email">${currentUser.email}</span>
            </div>
            <div class="dropdown-divider"></div>
            <a href="dashboard.html" class="dropdown-item">
              <i class="fas fa-th-large"></i>
              لوحة التحكم
            </a>
            <a href="add-product.html" class="dropdown-item">
              <i class="fas fa-plus"></i>
              إضافة منتج
            </a>
            <a href="profile.html" class="dropdown-item">
              <i class="fas fa-user"></i>
              الملف الشخصي
            </a>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item logout-btn" onclick="UserManager.logout()">
              <i class="fas fa-sign-out-alt"></i>
              تسجيل الخروج
            </button>
          </div>
        </div>
      `;
      
      // Add dropdown toggle functionality
      const userMenuBtn = document.getElementById('userMenuBtn');
      const userDropdown = document.getElementById('userDropdown');
      
      if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', () => {
          userDropdown.classList.toggle('show');
        });
        
        document.addEventListener('click', (e) => {
          if (!e.target.closest('.user-menu')) {
            userDropdown.classList.remove('show');
          }
        });
      }
    } else {
      authButtonsContainer.innerHTML = `
        <a href="login.html" class="btn sm glass">
          <i class="fas fa-sign-in-alt"></i>
          تسجيل الدخول
        </a>
        <a href="register.html" class="btn sm primary">
          <i class="fas fa-user-plus"></i>
          إنشاء حساب
        </a>
      `;
    }
  }
};

// ============ COUNTER ANIMATION ============
function animateCounters() {
  const counters = document.querySelectorAll('.stat-number[data-target]');
  
  counters.forEach(counter => {
    const target = parseInt(counter.dataset.target);
    const duration = 2000;
    const step = target / (duration / 16);
    let current = 0;
    
    const updateCounter = () => {
      current += step;
      if (current < target) {
        counter.textContent = Math.floor(current);
        requestAnimationFrame(updateCounter);
      } else {
        counter.textContent = target;
      }
    };
    
    // Start animation when element is visible
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          updateCounter();
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    
    observer.observe(counter);
  });
}

// ============ NAVBAR SCROLL EFFECT ============
function initNavbarScroll() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });
}

// ============ MOBILE MENU ============
function initMobileMenu() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.getElementById('navLinks');
  
  if (mobileMenuBtn && navLinks) {
    // Toggle menu
    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMobileMenu();
    });
    
    // Close menu when clicking on a link
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        closeMobileMenu();
      });
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (navLinks.classList.contains('mobile-open') && 
          !navLinks.contains(e.target) && 
          !mobileMenuBtn.contains(e.target)) {
        closeMobileMenu();
      }
    });
    
    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinks.classList.contains('mobile-open')) {
        closeMobileMenu();
      }
    });
    
    // Close menu on resize to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768 && navLinks.classList.contains('mobile-open')) {
        closeMobileMenu();
      }
    });
  }
  
  function toggleMobileMenu() {
    const isOpen = navLinks.classList.toggle('mobile-open');
    mobileMenuBtn.innerHTML = isOpen 
      ? '<i class="fas fa-times"></i>' 
      : '<i class="fas fa-bars"></i>';
    
    // Prevent body scroll when menu is open
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }
  
  function closeMobileMenu() {
    navLinks.classList.remove('mobile-open');
    mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
    document.body.style.overflow = '';
  }
}

// ============ LOAD LATEST PRODUCTS ============
// ============ LOAD LATEST PRODUCTS ============
async function loadLatestProducts() {
  const grid = document.getElementById('latestProductsGrid');
  if (!grid) return;
  
  let products = [];
  
  try {
      if (typeof ProductManagerAPI !== 'undefined') {
          // Use Backend API
          products = await ProductManagerAPI.getLatestProducts(8);
      } else {
          // Fallback to local storage (should typically not happen if api.js is loaded)
          products = ProductManager.getLatestProducts(8);
      }
  } catch (e) {
      console.error("Error loading latest products:", e);
  }
  
  if (!products || products.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-box-open"></i>
        <p>لا توجد منتجات حالياً</p>
        <a href="register.html" class="btn primary">كن أول البائعين!</a>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = products.map(product => UI.createProductCard(product)).join('');
  
  // Add click handlers
  grid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      window.location.href = `product.html?id=${id}`;
    });
  });
}

// ============ SET CURRENT YEAR ============
function setCurrentYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

// ============ SMOOTH SCROLL FOR ANCHOR LINKS ============
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

// ============ INITIALIZE APP ============
document.addEventListener('DOMContentLoaded', () => {
  // Initialize products in storage
  ProductManager.initializeProducts();
  
  // Update auth buttons based on login state
  UI.updateAuthButtons();
  
  // Initialize navbar scroll effect
  initNavbarScroll();
  
  // Initialize mobile menu
  initMobileMenu();
  
  // Animate counters on home page
  animateCounters();
  
  // Load latest products on home page
  loadLatestProducts();
  
  // Set current year
  setCurrentYear();
  
  // Initialize smooth scroll
  initSmoothScroll();
  
  // Update cart badge
  CartManager.updateCartBadge();
});

// ============ TOAST STYLES (injected) ============
const toastStyles = document.createElement('style');
toastStyles.textContent = `
  .toast {
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 28px;
    background: rgba(15, 23, 42, 0.95);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
    color: white;
    font-weight: 600;
    z-index: 10000;
    opacity: 0;
    transition: all 0.3s ease;
  }
  
  .toast.show {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
  
  .toast-success i { color: #34d399; }
  .toast-error i { color: #f87171; }
  .toast-info i { color: #60a5fa; }
  
  .toast i {
    font-size: 20px;
  }
  
  /* User Menu Styles */
  .user-menu {
    position: relative;
  }
  
  .user-avatar {
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, #22d3ee, #60a5fa);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: none;
    color: #0a0f1c;
    font-weight: 800;
    font-size: 18px;
    transition: all 0.3s ease;
  }
  
  .user-avatar:hover {
    transform: scale(1.05);
    box-shadow: 0 0 20px rgba(34, 211, 238, 0.3);
  }
  
  .user-dropdown {
    position: absolute;
    top: calc(100% + 12px);
    left: 0;
    right: auto;
    min-width: 240px;
    background: rgba(15, 23, 42, 0.98);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 8px;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-10px);
    transition: all 0.3s ease;
    z-index: 1000;
  }
  
  .user-dropdown.show {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }
  
  .dropdown-header {
    padding: 12px 16px;
  }
  
  .user-name {
    display: block;
    font-weight: 700;
    font-size: 16px;
    color: white;
  }
  
  .user-email {
    display: block;
    font-size: 13px;
    color: #94a3b8;
    margin-top: 4px;
  }
  
  .dropdown-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 8px 0;
  }
  
  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    color: #e5e7eb;
    font-weight: 600;
    font-size: 14px;
    border-radius: 10px;
    transition: all 0.2s ease;
    border: none;
    background: none;
    width: 100%;
    cursor: pointer;
    text-align: right;
  }
  
  .dropdown-item:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #22d3ee;
  }
  
  .dropdown-item i {
    width: 20px;
    text-align: center;
    color: #64748b;
    transition: color 0.2s;
  }
  
  .dropdown-item:hover i {
    color: #22d3ee;
  }
  
  .logout-btn:hover {
    color: #f87171 !important;
  }
  
  .logout-btn:hover i {
    color: #f87171 !important;
  }
  
  /* Mobile Navigation */
  @media (max-width: 768px) {
    .nav-links.mobile-open {
      display: flex;
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      flex-direction: column;
      background: rgba(10, 15, 28, 0.98);
      backdrop-filter: blur(20px);
      padding: 20px;
      gap: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .user-dropdown {
      left: auto;
      right: 0;
    }
  }
  
  /* Empty State */
  .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 60px 20px;
    color: #94a3b8;
  }
  
  .empty-state i {
    font-size: 60px;
    margin-bottom: 20px;
    opacity: 0.5;
  }
  
  .empty-state p {
    font-size: 18px;
    margin-bottom: 20px;
  }
`;
document.head.appendChild(toastStyles);

// ============ PREMIUM EFFECTS ============

// Hide Preloader
function hidePreloader() {
  const preloader = document.getElementById('preloader');
  if (preloader) {
    setTimeout(() => {
      preloader.classList.add('hidden');
    }, 1000);
  }
}

// Scroll Progress Bar
function initScrollProgress() {
  const progressBar = document.getElementById('scrollProgress');
  if (!progressBar) return;
  
  window.addEventListener('scroll', () => {
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const progress = (scrollTop / scrollHeight) * 100;
    progressBar.style.width = progress + '%';
  });
}

// Reveal Elements on Scroll
function initScrollReveal() {
  const revealElements = document.querySelectorAll('.card, .category-card, .testimonial-card, .step-item, .product-card, .feature-card');
  
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal', 'visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });
  
  revealElements.forEach(el => {
    el.classList.add('reveal');
    revealObserver.observe(el);
  });
}

// Parallax effect for hero
function initParallax() {
  const heroImage = document.querySelector('.hero-image');
  if (!heroImage) return;
  
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    if (scrolled < 600) {
      heroImage.style.transform = `translateY(${scrolled * 0.1}px)`;
    }
  });
}

// Tilt effect for cards
function initTiltEffect() {
  const cards = document.querySelectorAll('.product-card, .category-card');
  
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
    });
  });
}

// Typing effect for hero text
function initTypingEffect() {
  const heroTitle = document.querySelector('.hero h2 .gradient-text');
  if (!heroTitle) return;
  
  const text = heroTitle.textContent;
  heroTitle.textContent = '';
  heroTitle.classList.add('typing-cursor');
  
  let i = 0;
  const typeWriter = () => {
    if (i < text.length) {
      heroTitle.textContent += text.charAt(i);
      i++;
      setTimeout(typeWriter, 100);
    } else {
      heroTitle.classList.remove('typing-cursor');
    }
  };
  
  setTimeout(typeWriter, 500);
}

// Enhanced button ripple effect
function initRippleEffects() {
  const buttons = document.querySelectorAll('.btn');
  
  buttons.forEach(button => {
    button.addEventListener('click', function(e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const ripple = document.createElement('span');
      ripple.style.cssText = `
        position: absolute;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        pointer-events: none;
        width: 100px;
        height: 100px;
        left: ${x - 50}px;
        top: ${y - 50}px;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
      `;
      
      this.style.position = 'relative';
      this.style.overflow = 'hidden';
      this.appendChild(ripple);
      
      setTimeout(() => ripple.remove(), 600);
    });
  });
}

// Add ripple keyframes
const rippleStyles = document.createElement('style');
rippleStyles.textContent = `
  @keyframes ripple {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
`;
document.head.appendChild(rippleStyles);

// Cursor glow effect
function initCursorGlow() {
  const glow = document.createElement('div');
  glow.className = 'cursor-glow';
  glow.style.cssText = `
    position: fixed;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(34, 211, 238, 0.08) 0%, transparent 70%);
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
    transition: transform 0.1s ease-out;
    transform: translate(-50%, -50%);
  `;
  document.body.appendChild(glow);
  
  document.addEventListener('mousemove', (e) => {
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
  });
}

// Smooth number animation for stats
function animateValue(element, start, end, duration) {
  const range = end - start;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(start + (range * easeOut));
    element.textContent = current;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = end;
    }
  }
  
  requestAnimationFrame(update);
}

// Initialize all premium effects
function initPremiumEffects() {
  hidePreloader();
  initScrollProgress();
  initScrollReveal();
  initParallax();
  initTiltEffect();
  initRippleEffects();
  
  // Only enable cursor glow on desktop
  if (window.innerWidth > 768) {
    initCursorGlow();
  }
}

// Run premium effects after DOM is loaded
document.addEventListener('DOMContentLoaded', initPremiumEffects);

// Run preloader hide on window load
window.addEventListener('load', hidePreloader);
