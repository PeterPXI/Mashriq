/* ========================================
   Mashriq (مشرق) - Production Backend Server
   Sunrise Theme Platform
   Created by Peter Youssef
   Railway-Ready Deployment Configuration
   ======================================== */

// 1. Load env vars BEFORE anything else
if (process.env.NODE_ENV !== 'production') {
    const dotenvResult = require('dotenv').config();
    if (dotenvResult.error) {
        console.log('ℹ️  Note: No .env file found (using system environment variables)');
    } else {
        console.log('✅ Local .env file loaded successfully');
    }
}

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Models
const User = require('./models/User');
const Product = require('./models/Product');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'mashriq_simple_secret';

// Connect to Database
connectDB();

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

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ============ AUTHENTICATION MIDDLEWARE ============
const authenticateToken = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'المستخدم غير موجود' });
      }
      
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ success: false, message: 'الجلسة منتهية، يرجى تسجيل الدخول مجدداً' });
    }
  } else {
    res.status(401).json({ success: false, message: 'يجب تسجيل الدخول للوصول لهذه الخدمة' });
  }
};

// ============ HEALTH CHECK ENDPOINT ============
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ============ AUTH ROUTES ============

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, username, email, password, phone, grade, specialization } = req.body;
    
    // Validation handled by Mongoose usually, but early check good
    if (!name || !username || !email || !password) {
      return res.status(400).json({ success: false, message: 'جميع الحقول المطلوبة يجب ملؤها' });
    }

    // Check existing
    const userExists = await User.findOne({ 
        $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] 
    });

    if (userExists) {
        return res.status(400).json({ success: false, message: 'البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل' });
    }

    // Create user (password hashing handled in pre-save hook)
    const user = await User.create({
        name,
        username,
        email: email.toLowerCase(),
        password,
        phone,
        grade,
        specialization,
        avatar: name.charAt(0).toUpperCase()
    });

    // Generate token
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح! مرحباً بك 🎉',
      user: {
          id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          role: user.isDemo ? 'demo' : 'user'
      },
      token
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: error.message || 'حدث خطأ في الخادم' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
    }
    
    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
        return res.status(401).json({ success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }
    
    // Check password
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
        return res.status(401).json({ success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }
    
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح! مرحباً بك 👋',
      user: {
          id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          grade: user.grade,
          specialization: user.specialization,
          sales: user.sales,
          rating: user.rating
      },
      token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// Verify Token & Get Current User
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    // req.user is already fetched in middleware
    const user = req.user;
    
    res.json({ 
        success: true, 
        user: {
            id: user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            phone: user.phone,
            grade: user.grade,
            specialization: user.specialization,
            avatar: user.avatar,
            sales: user.sales,
            rating: user.rating,
            createdAt: user.createdAt
        } 
    });
});

// Update User Profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone, grade, specialization } = req.body;
    const user = await User.findById(req.user.id);
    
    if (name) {
        user.name = name;
        user.avatar = name.charAt(0).toUpperCase();
    }
    if (phone) user.phone = phone;
    if (grade) user.grade = grade;
    if (specialization) user.specialization = specialization;
    
    await user.save();
    
    res.json({
      success: true,
      message: 'تم تحديث الملف الشخصي بنجاح',
      user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          grade: user.grade,
          specialization: user.specialization,
          avatar: user.avatar
      }
    });
    
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// Change Password
app.put('/api/auth/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال كلمة المرور الحالية والجديدة' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });
    }
    
    const user = await User.findById(req.user.id);
    
    // Check current
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
       return res.status(401).json({ success: false, message: 'كلمة المرور الحالية غير صحيحة' });
    }
    
    // Update (pre-save hook will hash it)
    user.password = newPassword;
    await user.save();
    
    res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
    
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// ============ PRODUCTS ROUTES ============

// Get all products
app.get('/api/products', async (req, res) => {
  try {
      const { category, search, sellerId, limit } = req.query;
      let query = { status: 'active' };
      
      if (category) query.category = category;
      if (sellerId) query.sellerId = sellerId;
      if (search) {
          const regex = new RegExp(search, 'i');
          query.$or = [
              { title: regex },
              { description: regex },
              { sellerName: regex }
          ];
      }
      
      let productsQuery = Product.find(query);
      if (limit) productsQuery = productsQuery.limit(parseInt(limit));
      
      const products = await productsQuery.sort({ createdAt: -1 });
      
      res.json({ success: true, products: products.map(p => p.toObject({ getters: true })) });
  } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
  try {
      // NOTE: Removed parseInt since Mongoose uses ObjectIds (strings/objects)
      const product = await Product.findById(req.params.id);
      
      if (!product) {
        return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
      }
      
      res.json({ success: true, product: product.toObject({ getters: true }) });
  } catch (error) {
      if (error.kind === 'ObjectId') {
          return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
      }
      res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// Add new product
app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const { title, description, price, category, image } = req.body;
    
    if (!title || !description || !price || !category) {
      return res.status(400).json({ success: false, message: 'جميع الحقول المطلوبة يجب ملؤها' });
    }
    
    const product = await Product.create({
        title,
        description,
        price: parseFloat(price),
        category,
        image: image || 'https://via.placeholder.com/600x400?text=صورة+المنتج',
        sellerId: req.user.id,
        sellerName: req.user.name
    });
    
    // Increment stats logic could go here, or be just a calculation on retrieval
    
    console.log(`✅ New product added: ${product.title} by ${req.user.name}`);
    
    res.status(201).json({
      success: true,
      message: 'تم إضافة المنتج بنجاح! 🎉',
      product: product.toObject({ getters: true })
    });
    
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// Update product
app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
    }
    
    // Check ownership
    // Ensure ids are compared as strings
    if (product.sellerId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية لتعديل هذا المنتج' });
    }
    
    // Update fields
    const { title, description, price, category, image, status } = req.body;
    if (title) product.title = title;
    if (description) product.description = description;
    if (price) product.price = parseFloat(price);
    if (category) product.category = category;
    if (image) product.image = image;
    if (status) product.status = status;
    
    await product.save();
    
    res.json({
      success: true,
      message: 'تم تحديث المنتج بنجاح',
      product: product.toObject({ getters: true })
    });
    
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// Delete product
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
    }
    
    if (product.sellerId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية لحذف هذا المنتج' });
    }
    
    await product.deleteOne();
    
    console.log(`🗑️ Product deleted: ${product.title}`);
    
    res.json({ success: true, message: 'تم حذف المنتج بنجاح' });
    
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// Get user's products
app.get('/api/my-products', authenticateToken, async (req, res) => {
    try {
        const products = await Product.find({ sellerId: req.user.id }).sort({ createdAt: -1 });
        res.json({ success: true, products: products.map(p => p.toObject({ getters: true })) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// ============ STATS ROUTES ============

// Get platform stats
app.get('/api/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeProducts = await Product.countDocuments({ status: 'active' });
        
        // Calculate total sales from Users
        const users = await User.find({}, 'sales');
        const totalSales = users.reduce((sum, u) => sum + (u.sales || 0), 0);
        
        res.json({
            success: true,
            stats: {
                totalUsers,
                totalProducts: activeProducts,
                totalSales
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Get user stats
app.get('/api/my-stats', authenticateToken, async (req, res) => {
    try {
        const myProducts = await Product.find({ sellerId: req.user.id });
        const activeProducts = myProducts.filter(p => p.status === 'active').length;
        
        res.json({
            success: true,
            stats: {
                totalProducts: myProducts.length,
                activeProducts,
                totalSales: req.user.sales || 0,
                rating: req.user.rating || 5.0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// ============ PUBLIC USERS ROUTES ============

app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, 'name username avatar specialization rating sales id');
        res.json({ success: true, users: users.map(u => u.toObject({ getters: true })) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
             return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        }
        res.json({ success: true, user: user.toObject({ getters: true }) });
    } catch (error) {
        res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }
});

// ============ HTML ROUTES (SPA Support) ============

const htmlPages = ['index', 'login', 'register', 'products', 'product', 'add-product', 'dashboard', 'profile', 'about'];

htmlPages.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', `${page}.html`));
  });
  
  app.get(`/${page}.html`, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', `${page}.html`));
  });
});

// ============ ERROR HANDLING ============

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'الخدمة غير موجودة' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============ START SERVER ============

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
