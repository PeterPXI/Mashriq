/* ========================================
   Mashriq V2 - Main JavaScript
   ======================================== */

// API base path (relative)
const API_BASE = '/api';

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get auth token from localStorage
 */
function getToken() {
    return localStorage.getItem('token');
}

/**
 * Get current user from localStorage
 */
function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
    return !!getToken();
}

/**
 * Require authentication - redirect to login if not authenticated
 * Use on protected pages (services, order)
 */
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

/**
 * Redirect if already authenticated - for auth pages (login, register)
 * Prevents logged-in users from accessing auth pages
 */
function redirectIfAuthenticated() {
    if (isAuthenticated()) {
        window.location.href = 'services.html';
        return true;
    }
    return false;
}

/**
 * Redirect authenticated users from landing page
 * Use on index.html (landing page)
 */
function redirectAuthenticatedFromLanding() {
    if (isAuthenticated()) {
        window.location.href = 'services.html';
        return true;
    }
    return false;
}

/**
 * Logout user - clear storage and redirect to landing
 */
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

/**
 * Make authenticated API request
 */
async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    };
    
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json();
    
    if (response.status === 401) {
        logout();
        throw new Error('انتهت الجلسة، يرجى تسجيل الدخول مجدداً');
    }
    
    if (!response.ok || !data.success) {
        throw new Error(data.message || 'حدث خطأ في الخادم');
    }
    
    return data;
}

// ============================================================
// LOGIN PAGE
// ============================================================

function initLoginPage() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;
    
    // Redirect if already logged in
    if (redirectIfAuthenticated()) return;
    
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('errorMessage');
    const submitBtn = document.getElementById('submitBtn');
    
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.hidden = false;
    }
    
    function hideError() {
        errorMessage.hidden = true;
    }
    
    function setLoading(loading) {
        submitBtn.disabled = loading;
        submitBtn.textContent = loading ? 'جاري التسجيل...' : 'تسجيل الدخول';
    }
    
    async function handleLogin(event) {
        event.preventDefault();
        hideError();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        if (!email || !password) {
            showError('يرجى إدخال البريد الإلكتروني وكلمة المرور');
            return;
        }
        
        setLoading(true);
        
        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'حدث خطأ في تسجيل الدخول');
            }
            
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            window.location.href = 'services.html';
            
        } catch (error) {
            showError(error.message);
        } finally {
            setLoading(false);
        }
    }
    
    loginForm.addEventListener('submit', handleLogin);
}

// ============================================================
// SERVICES PAGE
// ============================================================

function initServicesPage() {
    const servicesGrid = document.getElementById('servicesGrid');
    if (!servicesGrid) return;
    
    // Require authentication
    if (!requireAuth()) return;
    
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const errorText = document.getElementById('errorText');
    const emptyState = document.getElementById('emptyState');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Load services
    window.loadServices = async function() {
        loadingState.hidden = false;
        errorState.hidden = true;
        emptyState.hidden = true;
        servicesGrid.hidden = true;
        
        try {
            const data = await apiRequest('/services');
            const services = data.services || [];
            
            loadingState.hidden = true;
            
            if (services.length === 0) {
                emptyState.hidden = false;
                return;
            }
            
            renderServices(services);
            servicesGrid.hidden = false;
            
        } catch (error) {
            loadingState.hidden = true;
            errorText.textContent = error.message;
            errorState.hidden = false;
        }
    };
    
    function renderServices(services) {
        servicesGrid.innerHTML = services.map(service => `
            <div class="service-card">
                <h3 class="service-title">${escapeHtml(service.title)}</h3>
                <p class="service-seller">البائع: ${escapeHtml(service.sellerName || 'غير معروف')}</p>
                <p class="service-price">${service.price} ر.س</p>
                <button class="order-btn" onclick="orderService('${service._id || service.id}')">
                    طلب الخدمة
                </button>
            </div>
        `).join('');
    }
    
    // Order service - redirect to order page
    window.orderService = function(serviceId) {
        window.location.href = `order.html?serviceId=${serviceId}`;
    };
    
    // Initial load
    loadServices();
}

// ============================================================
// ORDER PAGE
// ============================================================

function initOrderPage() {
    const orderSection = document.getElementById('orderSection');
    if (!orderSection) return;
    
    // Require authentication
    if (!requireAuth()) return;
    
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const errorText = document.getElementById('errorText');
    const serviceInfo = document.getElementById('serviceInfo');
    const serviceTitleEl = document.getElementById('serviceTitle');
    const serviceSellerEl = document.getElementById('serviceSeller');
    const servicePriceEl = document.getElementById('servicePrice');
    const confirmBtn = document.getElementById('confirmBtn');
    const successState = document.getElementById('successState');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Get serviceId from URL
    const urlParams = new URLSearchParams(window.location.search);
    const serviceId = urlParams.get('serviceId');
    
    if (!serviceId) {
        window.location.href = 'services.html';
        return;
    }
    
    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    let currentService = null;
    
    // Load service details
    async function loadService() {
        loadingState.hidden = false;
        errorState.hidden = true;
        serviceInfo.hidden = true;
        successState.hidden = true;
        
        try {
            const data = await apiRequest(`/services/${serviceId}`);
            currentService = data.service;
            
            loadingState.hidden = true;
            
            serviceTitleEl.textContent = currentService.title;
            serviceSellerEl.textContent = currentService.sellerName || 'غير معروف';
            servicePriceEl.textContent = `${currentService.price} ر.س`;
            
            serviceInfo.hidden = false;
            
        } catch (error) {
            loadingState.hidden = true;
            errorText.textContent = error.message;
            errorState.hidden = false;
        }
    }
    
    // Create order
    async function createOrder() {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'جاري الطلب...';
        
        try {
            await apiRequest('/orders', {
                method: 'POST',
                body: JSON.stringify({
                    serviceId: serviceId,
                    selectedExtraIds: []
                })
            });
            
            serviceInfo.hidden = true;
            successState.hidden = false;
            
        } catch (error) {
            alert(error.message);
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'تأكيد الطلب';
        }
    }
    
    // Confirm button
    confirmBtn.addEventListener('click', createOrder);
    
    // Back to services
    window.backToServices = function() {
        window.location.href = 'services.html';
    };
    
    // Initial load
    loadService();
}

// ============================================================
// REGISTER PAGE
// ============================================================

function initRegisterPage() {
    const registerForm = document.getElementById('registerForm');
    if (!registerForm) return;
    
    // Redirect if already logged in
    if (redirectIfAuthenticated()) return;
    
    const fullNameInput = document.getElementById('fullName');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('errorMessage');
    const submitBtn = document.getElementById('submitBtn');
    
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.hidden = false;
    }
    
    function hideError() {
        errorMessage.hidden = true;
    }
    
    function setLoading(loading) {
        submitBtn.disabled = loading;
        submitBtn.textContent = loading ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب';
    }
    
    async function handleRegister(event) {
        event.preventDefault();
        hideError();
        
        const fullName = fullNameInput.value.trim();
        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        // Validation
        if (!fullName || !username || !email || !password) {
            showError('يرجى ملء جميع الحقول');
            return;
        }
        
        if (password.length < 6) {
            showError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            return;
        }
        
        setLoading(true);
        
        try {
            const response = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName, username, email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'حدث خطأ في إنشاء الحساب');
            }
            
            // Save token and user
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Redirect to services
            window.location.href = 'services.html';
            
        } catch (error) {
            showError(error.message);
        } finally {
            setLoading(false);
        }
    }
    
    registerForm.addEventListener('submit', handleRegister);
}

// ============================================================
// UTILITIES
// ============================================================

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// LANDING PAGE
// ============================================================

function initLandingPage() {
    // Only run on landing page (check for hero section)
    const heroSection = document.querySelector('.hero');
    if (!heroSection) return;
    
    // Redirect authenticated users to services
    redirectAuthenticatedFromLanding();
}

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Landing page
    initLandingPage();
    
    // Auth pages
    initLoginPage();
    initRegisterPage();
    
    // Protected pages
    initServicesPage();
    initOrderPage();
});
