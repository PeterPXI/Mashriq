/* ========================================
   Mashriq (مشرق) - Production Backend Server
   Sunrise Theme Platform
   Created by Peter Youssef
   Railway-Ready Deployment Configuration
   ======================================== */

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mashriq_secret_key_2024_peter_youssef';

// ============ PRODUCTION MIDDLEWARE ============

// Trust proxy for Railway/production environments
app.set('trust proxy', 1);

// CORS configuration for production
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
}));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Request logging for production
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ============ DATABASE HELPERS ============
const DB_PATHS = {
  users: path.join(__dirname, 'database', 'users.json'),
  products: path.join(__dirname, 'database', 'products.json')
};

// Ensure database directory exists
function ensureDbExists() {
  const dbDir = path.join(__dirname, 'database');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // Initialize users.json if not exists
  if (!fs.existsSync(DB_PATHS.users)) {
    writeDB('users', { 
      users: [
        {
          id: 'user_demo_1',
          name: 'Demo Student',
          username: 'student',
          email: 'student@demo.com',
          password: 'demo123',
          phone: '',
          grade: 'الصف الثاني',
          specialization: 'علمي رياضة',
          avatar: 'D',
          createdAt: Date.now(),
          products: [],
          sales: 0,
          rating: 5.0,
          isDemo: true
        },
        {
          id: 'user_demo_2',
          name: 'Demo Seller',
          username: 'seller',
          email: 'seller@demo.com',
          password: 'demo123',
          phone: '',
          grade: 'الصف الثالث',
          specialization: 'أدبي',
          avatar: 'D',
          createdAt: Date.now(),
          products: [],
          sales: 5,
          rating: 4.8,
          isDemo: true
        }
      ]
    });
  }
  
  // Initialize products.json if not exists
  if (!fs.existsSync(DB_PATHS.products)) {
    writeDB('products', { products: [], nextId: 1 });
  }
}

// Read database
function readDB(type) {
  try {
    const data = fs.readFileSync(DB_PATHS[type], 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${type} database:`, error.message);
    return type === 'users' ? { users: [] } : { products: [], nextId: 1 };
  }
}

// Write database
function writeDB(type, data) {
  try {
    fs.writeFileSync(DB_PATHS[type], JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing ${type} database:`, error.message);
    return false;
  }
}

// ============ AUTHENTICATION MIDDLEWARE ============
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'يجب تسجيل الدخول للوصول لهذه الخدمة' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'الجلسة منتهية، يرجى تسجيل الدخول مجدداً' });
    }
    req.user = user;
    next();
  });
}

// ============ HEALTH CHECK ENDPOINT ============
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============ AUTH ROUTES ============

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, username, email, password, phone, grade, specialization } = req.body;
    
    // Validation
    if (!name || !username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'جميع الحقول المطلوبة يجب ملؤها' 
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' 
      });
    }
    
    const db = readDB('users');
    
    // Check if email exists
    if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ 
        success: false, 
        message: 'البريد الإلكتروني مستخدم بالفعل' 
      });
    }
    
    // Check if username exists
    if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ 
        success: false, 
        message: 'اسم المستخدم مستخدم بالفعل' 
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const newUser = {
      id: 'user_' + uuidv4(),
      name,
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone: phone || '',
      grade: grade || '',
      specialization: specialization || '',
      avatar: name.charAt(0).toUpperCase(),
      createdAt: Date.now(),
      products: [],
      sales: 0,
      rating: 5.0,
      isDemo: false
    };
    
    db.users.push(newUser);
    
    if (!writeDB('users', db)) {
      return res.status(500).json({ 
        success: false, 
        message: 'حدث خطأ أثناء حفظ البيانات' 
      });
    }
    
    // Generate token
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = newUser;
    
    console.log(`✅ New user registered: ${newUser.email}`);
    
    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح! مرحباً بك 🎉',
      user: userWithoutPassword,
      token
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في الخادم' 
    });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' 
      });
    }
    
    const db = readDB('users');
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' 
      });
    }
    
    // Check if demo account (simple password check)
    let isValidPassword = false;
    if (user.isDemo) {
      // Demo accounts use simple password 'demo123'
      isValidPassword = password === 'demo123';
    } else {
      isValidPassword = await bcrypt.compare(password, user.password);
    }
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' 
      });
    }
    
    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    
    console.log(`✅ User logged in: ${user.email}`);
    
    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح! مرحباً بك 👋',
      user: userWithoutPassword,
      token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في الخادم' 
    });
  }
});

// Verify Token & Get Current User
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const db = readDB('users');
  const user = db.users.find(u => u.id === req.user.id);
  
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      message: 'المستخدم غير موجود' 
    });
  }
  
  const { password: _, ...userWithoutPassword } = user;
  res.json({ success: true, user: userWithoutPassword });
});

// Update User Profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone, grade, specialization } = req.body;
    const db = readDB('users');
    const userIndex = db.users.findIndex(u => u.id === req.user.id);
    
    if (userIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'المستخدم غير موجود' 
      });
    }
    
    // Update user data
    if (name) db.users[userIndex].name = name;
    if (phone) db.users[userIndex].phone = phone;
    if (grade) db.users[userIndex].grade = grade;
    if (specialization) db.users[userIndex].specialization = specialization;
    
    // Update avatar if name changed
    if (name) db.users[userIndex].avatar = name.charAt(0).toUpperCase();
    
    writeDB('users', db);
    
    const { password: _, ...userWithoutPassword } = db.users[userIndex];
    
    res.json({
      success: true,
      message: 'تم تحديث الملف الشخصي بنجاح',
      user: userWithoutPassword
    });
    
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في الخادم' 
    });
  }
});

// Change Password
app.put('/api/auth/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'يرجى إدخال كلمة المرور الحالية والجديدة' 
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' 
      });
    }
    
    const db = readDB('users');
    const userIndex = db.users.findIndex(u => u.id === req.user.id);
    
    if (userIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'المستخدم غير موجود' 
      });
    }
    
    const user = db.users[userIndex];
    
    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'كلمة المرور الحالية غير صحيحة' 
      });
    }
    
    // Hash new password
    db.users[userIndex].password = await bcrypt.hash(newPassword, 10);
    writeDB('users', db);
    
    res.json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح'
    });
    
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في الخادم' 
    });
  }
});

// ============ PRODUCTS ROUTES ============

// Get all products
app.get('/api/products', (req, res) => {
  const db = readDB('products');
  const { category, search, sellerId, limit } = req.query;
  
  let products = db.products.filter(p => p.status === 'active');
  
  // Filter by category
  if (category) {
    products = products.filter(p => p.category === category);
  }
  
  // Filter by seller
  if (sellerId) {
    products = products.filter(p => p.sellerId === sellerId);
  }
  
  // Search
  if (search) {
    const searchTerm = search.toLowerCase();
    products = products.filter(p => 
      p.title.toLowerCase().includes(searchTerm) ||
      p.description.toLowerCase().includes(searchTerm) ||
      p.sellerName.toLowerCase().includes(searchTerm)
    );
  }
  
  // Limit results
  if (limit) {
    products = products.slice(0, parseInt(limit));
  }
  
  res.json({ success: true, products });
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const db = readDB('products');
  const product = db.products.find(p => p.id === parseInt(req.params.id));
  
  if (!product) {
    return res.status(404).json({ 
      success: false, 
      message: 'المنتج غير موجود' 
    });
  }
  
  res.json({ success: true, product });
});

// Add new product (requires auth)
app.post('/api/products', authenticateToken, (req, res) => {
  try {
    const { title, description, price, category, image } = req.body;
    
    // Validation
    if (!title || !description || !price || !category) {
      return res.status(400).json({ 
        success: false, 
        message: 'جميع الحقول المطلوبة يجب ملؤها' 
      });
    }
    
    // Get user info
    const usersDb = readDB('users');
    const user = usersDb.users.find(u => u.id === req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'المستخدم غير موجود' 
      });
    }
    
    const productsDb = readDB('products');
    
    const newProduct = {
      id: productsDb.nextId,
      title,
      description,
      price: parseFloat(price),
      category,
      image: image || 'https://via.placeholder.com/600x400?text=صورة+المنتج',
      sellerId: user.id,
      sellerName: user.name,
      rating: 0,
      reviews: 0,
      createdAt: Date.now(),
      status: 'active'
    };
    
    productsDb.products.unshift(newProduct);
    productsDb.nextId += 1;
    
    writeDB('products', productsDb);
    
    console.log(`✅ New product added: ${newProduct.title} by ${user.name}`);
    
    res.status(201).json({
      success: true,
      message: 'تم إضافة المنتج بنجاح! 🎉',
      product: newProduct
    });
    
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في الخادم' 
    });
  }
});

// Update product (requires auth & ownership)
app.put('/api/products/:id', authenticateToken, (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { title, description, price, category, image, status } = req.body;
    
    const db = readDB('products');
    const productIndex = db.products.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'المنتج غير موجود' 
      });
    }
    
    // Check ownership
    if (db.products[productIndex].sellerId !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'ليس لديك صلاحية لتعديل هذا المنتج' 
      });
    }
    
    // Update product
    if (title) db.products[productIndex].title = title;
    if (description) db.products[productIndex].description = description;
    if (price) db.products[productIndex].price = parseFloat(price);
    if (category) db.products[productIndex].category = category;
    if (image) db.products[productIndex].image = image;
    if (status) db.products[productIndex].status = status;
    
    writeDB('products', db);
    
    res.json({
      success: true,
      message: 'تم تحديث المنتج بنجاح',
      product: db.products[productIndex]
    });
    
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في الخادم' 
    });
  }
});

// Delete product (requires auth & ownership)
app.delete('/api/products/:id', authenticateToken, (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const db = readDB('products');
    const productIndex = db.products.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'المنتج غير موجود' 
      });
    }
    
    // Check ownership
    if (db.products[productIndex].sellerId !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'ليس لديك صلاحية لحذف هذا المنتج' 
      });
    }
    
    const deletedProduct = db.products.splice(productIndex, 1)[0];
    writeDB('products', db);
    
    console.log(`🗑️ Product deleted: ${deletedProduct.title}`);
    
    res.json({
      success: true,
      message: 'تم حذف المنتج بنجاح'
    });
    
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في الخادم' 
    });
  }
});

// Get user's products
app.get('/api/my-products', authenticateToken, (req, res) => {
  const db = readDB('products');
  const myProducts = db.products.filter(p => p.sellerId === req.user.id);
  res.json({ success: true, products: myProducts });
});

// ============ STATS ROUTES ============

// Get platform stats
app.get('/api/stats', (req, res) => {
  const usersDb = readDB('users');
  const productsDb = readDB('products');
  
  const activeProducts = productsDb.products.filter(p => p.status === 'active');
  const totalSales = usersDb.users.reduce((sum, u) => sum + (u.sales || 0), 0);
  
  res.json({
    success: true,
    stats: {
      totalUsers: usersDb.users.length,
      totalProducts: activeProducts.length,
      totalSales: totalSales
    }
  });
});

// Get user stats
app.get('/api/my-stats', authenticateToken, (req, res) => {
  const usersDb = readDB('users');
  const productsDb = readDB('products');
  
  const user = usersDb.users.find(u => u.id === req.user.id);
  const myProducts = productsDb.products.filter(p => p.sellerId === req.user.id);
  const activeProducts = myProducts.filter(p => p.status === 'active');
  
  res.json({
    success: true,
    stats: {
      totalProducts: myProducts.length,
      activeProducts: activeProducts.length,
      totalSales: user?.sales || 0,
      rating: user?.rating || 5.0
    }
  });
});

// ============ USERS ROUTES ============

// Get all users (public info only)
app.get('/api/users', (req, res) => {
  const db = readDB('users');
  const publicUsers = db.users.map(u => ({
    id: u.id,
    name: u.name,
    username: u.username,
    avatar: u.avatar,
    specialization: u.specialization,
    rating: u.rating,
    sales: u.sales
  }));
  
  res.json({ success: true, users: publicUsers });
});

// Get user by ID (public info)
app.get('/api/users/:id', (req, res) => {
  const db = readDB('users');
  const user = db.users.find(u => u.id === req.params.id);
  
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      message: 'المستخدم غير موجود' 
    });
  }
  
  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
      specialization: user.specialization,
      grade: user.grade,
      rating: user.rating,
      sales: user.sales,
      createdAt: user.createdAt
    }
  });
});

// ============ HTML ROUTES (SPA Support) ============

// Serve specific HTML pages
const htmlPages = ['index', 'login', 'register', 'products', 'product', 'add-product', 'dashboard', 'profile', 'about'];

htmlPages.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', `${page}.html`));
  });
  
  // Also handle .html extension
  app.get(`/${page}.html`, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', `${page}.html`));
  });
});

// ============ ERROR HANDLING ============

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'حدث خطأ في الخادم' 
  });
});

// Handle 404
app.use((req, res) => {
  // If API route, return JSON
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ 
      success: false, 
      message: 'الخدمة غير موجودة' 
    });
  }
  // Otherwise serve index.html (SPA fallback)
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============ GRACEFUL SHUTDOWN ============
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// ============ START SERVER ============

// Ensure database exists before starting
ensureDbExists();

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║                                                  ║');
  console.log('║   ☀️ Mashriq Server - مشرق                       ║');
  console.log('║   Production Ready - Sunrise Theme               ║');
  console.log('║                                                  ║');
  console.log(`║   🌐 Port: ${PORT}                                   ║`);
  console.log(`║   📍 Environment: ${(process.env.NODE_ENV || 'development').padEnd(24)}║`);
  console.log('║                                                  ║');
  console.log('║   📚 API Endpoints:                              ║');
  console.log('║   • GET  /api/health      - Health check         ║');
  console.log('║   • POST /api/auth/register - تسجيل جديد         ║');
  console.log('║   • POST /api/auth/login    - تسجيل دخول         ║');
  console.log('║   • GET  /api/products      - المنتجات           ║');
  console.log('║   • GET  /api/users         - المستخدمين         ║');
  console.log('║                                                  ║');
  console.log('║   👤 Demo Accounts:                              ║');
  console.log('║   • student@demo.com / demo123                   ║');
  console.log('║   • seller@demo.com  / demo123                   ║');
  console.log('║                                                  ║');
  console.log('║   Created by Peter Youssef ❤️                    ║');
  console.log('║   Railway-Ready Deployment                       ║');
  console.log('║                                                  ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
});
