/* ========================================
   Mashriq (مشرق) - Production Backend Server
   Sunrise Theme Platform
   Created by Peter Youssef
   Railway-Ready Deployment Configuration
   ======================================== */

const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

// Models
const User = require('./models/User');
const { USER_ROLES } = require('./models/User');
const Product = require('./models/Product');  // Legacy - will be removed after migration
const Service = require('./models/Service');
const Order = require('./models/Order');
const { ORDER_STATUSES } = require('./models/Order');
const Review = require('./models/Review');

// Routes
const orderRoutes = require('./routes/orderRoutes');
const disputeRoutes = require('./routes/disputeRoutes');
const chatRoutes = require('./routes/chatRoutes');
const reviewRoutes = require('./routes/reviewRoutes');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'mashriq_simple_secret';

// ============ MIDDLEWARE ============

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

// ============ DATABASE CONNECTION ============

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ============ AUTHENTICATION MIDDLEWARE ============
const authenticateToken = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      
      req.user = await User.findById(decoded.id).select('-passwordHash');
      
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

// ============ SELLER AUTHORIZATION MIDDLEWARE ============
const requireSeller = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'يجب تسجيل الدخول أولاً' });
  }
  
  // User must have SELLER or ADMIN role to perform seller actions
  if (req.user.role !== USER_ROLES.SELLER && req.user.role !== USER_ROLES.ADMIN) {
    return res.status(403).json({ 
      success: false, 
      message: 'يجب تفعيل وضع البائع أولاً للقيام بهذا الإجراء',
      requiresSeller: true
    });
  }
  
  next();
};

// ============ ADMIN AUTHORIZATION MIDDLEWARE ============
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'يجب تسجيل الدخول أولاً' });
  }
  
  if (req.user.role !== USER_ROLES.ADMIN) {
    return res.status(403).json({ success: false, message: 'هذا الإجراء متاح للمسؤولين فقط' });
  }
  
  next();
};

// ============ HEALTH CHECK ENDPOINT ============
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ============ AUTH ROUTES ============

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, username, email, password } = req.body;
    
    // Validate required fields
    if (!fullName || !username || !email || !password) {
      return res.status(400).json({ success: false, message: 'جميع الحقول المطلوبة يجب ملؤها' });
    }
    
    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    // Check if email or username already exists
    const userExists = await User.findOne({ 
        $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] 
    });

    if (userExists) {
        return res.status(400).json({ success: false, message: 'البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل' });
    }

    // Create user (password hashing handled in pre-save hook via passwordHash field)
    const user = await User.create({
        fullName,
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        passwordHash: password  // Will be hashed in pre-save hook
    });

    // Generate JWT token
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    console.log(`🎉 New user registered: ${user.fullName} (${user.email})`);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح! مرحباً بك 🎉',
      user: {
          id: user._id,
          fullName: user.fullName,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatarUrl,
          role: user.role
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
    
    // Find user by email
    const user = await User.findByEmail(email);
    
    if (!user) {
        return res.status(401).json({ success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }
    
    // Check if account is active
    if (!user.isActive) {
        return res.status(401).json({ success: false, message: 'هذا الحساب معطّل' });
    }
    
    // Verify password
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
        return res.status(401).json({ success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }
    
    // Update last active timestamp
    user.lastActiveAt = Date.now();
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح! مرحباً بك 👋',
      user: {
          id: user._id,
          fullName: user.fullName,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          role: user.role
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
    // req.user is already fetched in middleware (excludes passwordHash)
    const user = req.user;
    
    // NOTE: Trust fields are NEVER returned in API responses
    res.json({ 
        success: true, 
        user: {
            id: user._id,
            fullName: user.fullName,
            username: user.username,
            email: user.email,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
            createdAt: user.createdAt
        } 
    });
});

// Update User Profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { fullName, bio, avatarUrl } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }
    
    // Update allowed profile fields
    if (fullName) user.fullName = fullName;
    if (bio !== undefined) user.bio = bio;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    
    await user.save();
    
    res.json({
      success: true,
      message: 'تم تحديث الملف الشخصي بنجاح',
      user: {
          id: user._id,
          fullName: user.fullName,
          username: user.username,
          email: user.email,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
          role: user.role
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
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }
    
    // Verify current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
       return res.status(401).json({ success: false, message: 'كلمة المرور الحالية غير صحيحة' });
    }
    
    // Update password (pre-save hook will hash it)
    user.passwordHash = newPassword;
    await user.save();
    
    res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
    
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// Activate Seller Mode
app.post('/api/auth/activate-seller', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }
    
    // Check if already a seller
    if (user.role === USER_ROLES.SELLER || user.role === USER_ROLES.ADMIN) {
      return res.status(400).json({ success: false, message: 'أنت بائع بالفعل' });
    }
    
    // Upgrade role to seller
    user.role = USER_ROLES.SELLER;
    await user.save();
    
    console.log(`🎉 New seller activated: ${user.fullName} (${user.email})`);
    
    res.json({ 
      success: true, 
      message: 'تم تفعيل وضع البائع بنجاح! يمكنك الآن إضافة خدماتك 🎉',
      user: {
        id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Activate seller error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// ============ SERVICES ROUTES ============

// Get all services (public)
app.get('/api/services', async (req, res) => {
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
    
    let servicesQuery = Service.find(query);
    if (limit) servicesQuery = servicesQuery.limit(parseInt(limit));
    
    const services = await servicesQuery.sort({ createdAt: -1 });
    
    res.json({ success: true, services: services.map(s => s.toObject({ getters: true })) });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// Get single service (public)
app.get('/api/services/:id', async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ success: false, message: 'الخدمة غير موجودة' });
    }
    
    // Get seller info (only public fields, never trust metrics)
    const seller = await User.findById(service.sellerId).select('fullName username avatarUrl bio');
    
    res.json({ 
      success: true, 
      service: service.toObject({ getters: true }),
      seller: seller ? seller.toObject({ getters: true }) : null
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ success: false, message: 'الخدمة غير موجودة' });
    }
    console.error('Get service error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// Create new service (seller only)
app.post('/api/services', authenticateToken, requireSeller, async (req, res) => {
  try {
    const { title, description, price, category, image, deliveryTime, revisions, requirements } = req.body;
    
    if (!title || !description || !price || !category) {
      return res.status(400).json({ success: false, message: 'جميع الحقول المطلوبة يجب ملؤها' });
    }
    
    const service = await Service.create({
      title,
      description,
      price: parseFloat(price),
      category,
      image: image || 'https://via.placeholder.com/600x400?text=صورة+الخدمة',
      deliveryTime: deliveryTime || 3,
      revisions: revisions || 1,
      requirements: requirements || '',
      sellerId: req.user.id,
      sellerName: req.user.fullName
    });
    
    console.log(`✅ New service added: "${service.title}" by ${req.user.fullName}`);
    
    res.status(201).json({
      success: true,
      message: 'تم إضافة الخدمة بنجاح! 🎉',
      service: service.toObject({ getters: true })
    });
    
  } catch (error) {
    console.error('Add service error:', error);
    res.status(500).json({ success: false, message: error.message || 'حدث خطأ في الخادم' });
  }
});

// Update service (owner only)
app.put('/api/services/:id', authenticateToken, async (req, res) => {
  try {
    let service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ success: false, message: 'الخدمة غير موجودة' });
    }
    
    // Check ownership
    if (!service.isOwner(req.user.id)) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية لتعديل هذه الخدمة' });
    }
    
    // Update fields
    const { title, description, price, category, image, deliveryTime, revisions, requirements, status } = req.body;
    if (title) service.title = title;
    if (description) service.description = description;
    if (price) service.price = parseFloat(price);
    if (category) service.category = category;
    if (image) service.image = image;
    if (deliveryTime) service.deliveryTime = deliveryTime;
    if (revisions !== undefined) service.revisions = revisions;
    if (requirements !== undefined) service.requirements = requirements;
    if (status && ['active', 'paused'].includes(status)) service.status = status;
    
    await service.save();
    
    res.json({
      success: true,
      message: 'تم تحديث الخدمة بنجاح',
      service: service.toObject({ getters: true })
    });
    
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// Delete/Deactivate service (owner only)
app.delete('/api/services/:id', authenticateToken, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({ success: false, message: 'الخدمة غير موجودة' });
    }
    
    if (!service.isOwner(req.user.id)) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية لحذف هذه الخدمة' });
    }
    
    // Soft delete - mark as deleted instead of removing
    service.status = 'deleted';
    await service.save();
    
    console.log(`🗑️ Service deactivated: "${service.title}"`);
    
    res.json({ success: true, message: 'تم حذف الخدمة بنجاح' });
    
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// Get my services (seller)
app.get('/api/my-services', authenticateToken, async (req, res) => {
  try {
    const services = await Service.find({ 
      sellerId: req.user.id,
      status: { $ne: 'deleted' }  // Exclude deleted
    }).sort({ createdAt: -1 });
    
    res.json({ success: true, services: services.map(s => s.toObject({ getters: true })) });
  } catch (error) {
    console.error('Get my services error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// ============ PRODUCTS ROUTES (LEGACY - Will be removed after migration) ============

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
        sellerName: req.user.fullName
    });
    
    // Increment stats logic could go here, or be just a calculation on retrieval
    
    console.log(`✅ New product added: ${product.title} by ${req.user.fullName}`);
    
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

// ============ ORDERS ROUTES (NEW - via Controller) ============

// Mount order routes with authentication
app.use('/api/orders', authenticateToken, orderRoutes);

// ============ DISPUTES ROUTES (NEW - via Controller) ============

// Mount dispute routes with authentication
app.use('/api/disputes', authenticateToken, disputeRoutes);

// ============ CHATS ROUTES (NEW - via Controller) ============

// Mount chat routes with authentication
app.use('/api/chats', authenticateToken, chatRoutes);

// ============ REVIEWS ROUTES (NEW - via Controller) ============

// Mount review routes (auth applied per-route, not globally)
app.use('/api/reviews', reviewRoutes);

// ============ LEGACY ORDERS ROUTES (DEPRECATED - DO NOT USE) ============
// NOTE: The routes below are LEGACY and will be removed after migration verification.
// The new routes above via OrderController now handle all order operations.

/*
// Create new order (buyer) - DEPRECATED
app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { serviceId, buyerRequirements } = req.body;
    
    if (!serviceId) {
      return res.status(400).json({ success: false, message: 'يجب تحديد الخدمة المطلوبة' });
    }
    
    // Get service
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: 'الخدمة غير موجودة' });
    }
    
    if (service.status !== 'active') {
      return res.status(400).json({ success: false, message: 'هذه الخدمة غير متاحة حالياً' });
    }
    
    // Prevent self-purchase
    if (service.sellerId.toString() === req.user.id.toString()) {
      return res.status(400).json({ success: false, message: 'لا يمكنك شراء خدمتك الخاصة' });
    }
    
    // Get seller
    const seller = await User.findById(service.sellerId);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'البائع غير موجود' });
    }
    
    // Generate order number
    const orderNumber = await Order.generateOrderNumber();
    
    // Create order
    const order = await Order.create({
      orderNumber,
      serviceId: service._id,
      serviceSnapshot: {
        title: service.title,
        price: service.price,
        deliveryTime: service.deliveryTime,
        revisions: service.revisions,
        image: service.image
      },
      buyerId: req.user.id,
      buyerName: req.user.fullName,
      sellerId: service.sellerId,
      sellerName: service.sellerName,
      buyerRequirements: buyerRequirements || '',
      amount: service.price,
      revisionsAllowed: service.revisions
    });
    
    console.log(`📦 New order created: ${order.orderNumber} - "${service.title}"`);
    
    res.status(201).json({
      success: true,
      message: 'تم إنشاء الطلب بنجاح! في انتظار قبول البائع 🎉',
      order: order.toObject({ getters: true })
    });
    
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: error.message || 'حدث خطأ في الخادم' });
  }
});

// Get my orders (as buyer or seller)
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { role, status } = req.query;
    let query = {};
    
    // Filter by role
    if (role === 'buyer') {
      query.buyerId = req.user.id;
    } else if (role === 'seller') {
      query.sellerId = req.user.id;
    } else {
      // Default: get all orders where user is involved
      query.$or = [
        { buyerId: req.user.id },
        { sellerId: req.user.id }
      ];
    }
    
    // Filter by status
    if (status) {
      query.status = status;
    }
    
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json({ 
      success: true, 
      orders: orders.map(o => o.toObject({ getters: true })) 
    });
    
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// Get single order
app.get('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }
    
    // Check if user is involved
    if (!order.isInvolved(req.user.id)) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية لعرض هذا الطلب' });
    }
    
    // Get review if exists
    const review = await Review.findOne({ orderId: order._id });
    
    res.json({ 
      success: true, 
      order: order.toObject({ getters: true }),
      review: review ? review.toObject({ getters: true }) : null,
      userRole: order.isBuyer(req.user.id) ? 'buyer' : 'seller'
    });
    
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }
    console.error('Get order error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// Accept order (seller)
app.put('/api/orders/:id/accept', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }
    
    if (!order.isSeller(req.user.id)) {
      return res.status(403).json({ success: false, message: 'فقط البائع يمكنه قبول الطلب' });
    }
    
    if (order.status !== ORDER_STATUSES.PENDING) {
      return res.status(400).json({ success: false, message: 'لا يمكن قبول هذا الطلب في حالته الحالية' });
    }
    
    order.status = ORDER_STATUSES.IN_PROGRESS;
    order.acceptedAt = Date.now();
    
    // Recalculate expected delivery from now
    order.expectedDeliveryDate = new Date(Date.now() + order.serviceSnapshot.deliveryTime * 24 * 60 * 60 * 1000);
    
    await order.save();
    
    console.log(`✅ Order accepted: ${order.orderNumber}`);
    
    res.json({ 
      success: true, 
      message: 'تم قبول الطلب! ابدأ العمل الآن 🚀',
      order: order.toObject({ getters: true })
    });
    
  } catch (error) {
    console.error('Accept order error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// Decline order (seller)
app.put('/api/orders/:id/decline', authenticateToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }
    
    if (!order.isSeller(req.user.id)) {
      return res.status(403).json({ success: false, message: 'فقط البائع يمكنه رفض الطلب' });
    }
    
    if (order.status !== ORDER_STATUSES.PENDING) {
      return res.status(400).json({ success: false, message: 'لا يمكن رفض هذا الطلب في حالته الحالية' });
    }
    
    order.status = ORDER_STATUSES.CANCELLED;
    order.cancelledBy = 'seller';
    order.cancellationReason = reason || 'رفض البائع الطلب';
    
    await order.save();
    
    console.log(`❌ Order declined: ${order.orderNumber}`);
    
    res.json({ 
      success: true, 
      message: 'تم رفض الطلب',
      order: order.toObject({ getters: true })
    });
    
  } catch (error) {
    console.error('Decline order error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// Deliver order (seller)
app.put('/api/orders/:id/deliver', authenticateToken, async (req, res) => {
  try {
    const { deliveryMessage } = req.body;
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }
    
    if (!order.isSeller(req.user.id)) {
      return res.status(403).json({ success: false, message: 'فقط البائع يمكنه تسليم الطلب' });
    }
    
    if (order.status !== ORDER_STATUSES.IN_PROGRESS && order.status !== ORDER_STATUSES.REVISION) {
      return res.status(400).json({ success: false, message: 'لا يمكن تسليم هذا الطلب في حالته الحالية' });
    }
    
    order.status = ORDER_STATUSES.DELIVERED;
    order.deliveredAt = Date.now();
    order.deliveryMessage = deliveryMessage || '';
    
    await order.save();
    
    console.log(`📬 Order delivered: ${order.orderNumber}`);
    
    res.json({ 
      success: true, 
      message: 'تم تسليم الطلب! في انتظار موافقة المشتري ✨',
      order: order.toObject({ getters: true })
    });
    
  } catch (error) {
    console.error('Deliver order error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// Approve delivery (buyer)
app.put('/api/orders/:id/approve', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }
    
    if (!order.isBuyer(req.user.id)) {
      return res.status(403).json({ success: false, message: 'فقط المشتري يمكنه الموافقة على التسليم' });
    }
    
    if (order.status !== ORDER_STATUSES.DELIVERED) {
      return res.status(400).json({ success: false, message: 'لا يمكن الموافقة على هذا الطلب في حالته الحالية' });
    }
    
    order.status = ORDER_STATUSES.COMPLETED;
    order.completedAt = Date.now();
    
    await order.save();
    
    // Update service stats
    await Service.findByIdAndUpdate(order.serviceId, {
      $inc: { ordersCount: 1 }
    });
    
    // Update seller stats (sales count and balance)
    await User.findByIdAndUpdate(order.sellerId, {
      $inc: { 
        sales: 1,
        balance: order.sellerEarnings,
        totalEarnings: order.sellerEarnings
      }
    });
    
    console.log(`🎉 Order completed: ${order.orderNumber} - Seller earned ${order.sellerEarnings} EGP`);
    
    res.json({ 
      success: true, 
      message: 'تم إكمال الطلب بنجاح! شكراً لك 🎉',
      order: order.toObject({ getters: true })
    });
    
  } catch (error) {
    console.error('Approve order error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// Request revision (buyer)
app.put('/api/orders/:id/revision', authenticateToken, async (req, res) => {
  try {
    const { revisionMessage } = req.body;
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }
    
    if (!order.isBuyer(req.user.id)) {
      return res.status(403).json({ success: false, message: 'فقط المشتري يمكنه طلب تعديل' });
    }
    
    if (order.status !== ORDER_STATUSES.DELIVERED) {
      return res.status(400).json({ success: false, message: 'لا يمكن طلب تعديل في حالة الطلب الحالية' });
    }
    
    if (order.revisionsUsed >= order.revisionsAllowed) {
      return res.status(400).json({ 
        success: false, 
        message: `لقد استنفدت جميع التعديلات المسموحة (${order.revisionsAllowed})` 
      });
    }
    
    order.status = ORDER_STATUSES.REVISION;
    order.revisionsUsed += 1;
    order.deliveryMessage = revisionMessage || 'المشتري طلب تعديلات';
    
    await order.save();
    
    console.log(`🔄 Revision requested: ${order.orderNumber} (${order.revisionsUsed}/${order.revisionsAllowed})`);
    
    res.json({ 
      success: true, 
      message: `تم طلب التعديل (${order.revisionsUsed}/${order.revisionsAllowed})`,
      order: order.toObject({ getters: true })
    });
    
  } catch (error) {
    console.error('Request revision error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// END LEGACY ORDERS ROUTES */

// ============ REVIEWS ROUTES ============

// Submit review (buyer, after order completion)
app.post('/api/reviews', authenticateToken, async (req, res) => {
  try {
    const { orderId, rating, comment } = req.body;
    
    if (!orderId || !rating) {
      return res.status(400).json({ success: false, message: 'يجب تحديد الطلب والتقييم' });
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'التقييم يجب أن يكون بين 1 و 5' });
    }
    
    // Get order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }
    
    // Must be buyer
    if (!order.isBuyer(req.user.id)) {
      return res.status(403).json({ success: false, message: 'فقط المشتري يمكنه تقييم الطلب' });
    }
    
    // Must be completed
    if (order.status !== ORDER_STATUSES.COMPLETED) {
      return res.status(400).json({ success: false, message: 'يمكن التقييم فقط بعد إكمال الطلب' });
    }
    
    // Check if already reviewed
    const existingReview = await Review.findOne({ orderId: order._id });
    if (existingReview) {
      return res.status(400).json({ success: false, message: 'تم تقييم هذا الطلب بالفعل' });
    }
    
    // Create review
    const review = await Review.create({
      orderId: order._id,
      serviceId: order.serviceId,
      reviewerId: req.user.id,
      reviewerName: req.user.fullName,
      sellerId: order.sellerId,
      rating: parseInt(rating),
      comment: comment || ''
    });
    
    console.log(`⭐ Review submitted: ${rating}/5 for order ${order.orderNumber}`);
    
    res.status(201).json({
      success: true,
      message: 'شكراً لتقييمك! ⭐',
      review: review.toObject({ getters: true })
    });
    
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ success: false, message: error.message || 'حدث خطأ في الخادم' });
  }
});

// Get reviews for a service
app.get('/api/reviews/service/:serviceId', async (req, res) => {
  try {
    const reviews = await Review.find({ serviceId: req.params.serviceId })
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json({ 
      success: true, 
      reviews: reviews.map(r => r.toObject({ getters: true })) 
    });
    
  } catch (error) {
    console.error('Get service reviews error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// Get reviews for a seller
app.get('/api/reviews/seller/:sellerId', async (req, res) => {
  try {
    const reviews = await Review.find({ sellerId: req.params.sellerId })
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json({ 
      success: true, 
      reviews: reviews.map(r => r.toObject({ getters: true })) 
    });
    
  } catch (error) {
    console.error('Get seller reviews error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// ============ STATS ROUTES ============

// Get platform stats
app.get('/api/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ isActive: true });
        const activeProducts = await Product.countDocuments({ status: 'active' });
        const activeServices = await Service.countDocuments({ status: 'active' });
        
        // Calculate total completed orders from Order model (derived, not stored on User)
        const completedOrders = await Order.countDocuments({ status: 'completed' });
        
        res.json({
            success: true,
            stats: {
                totalUsers,
                totalProducts: activeProducts,
                totalServices: activeServices,
                totalCompletedOrders: completedOrders
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Get user stats (seller dashboard)
app.get('/api/my-stats', authenticateToken, async (req, res) => {
    try {
        // Get services (new model) and products (legacy)
        const myServices = await Service.find({ sellerId: req.user.id, status: { $ne: 'deleted' } });
        const myProducts = await Product.find({ sellerId: req.user.id });
        const activeServices = myServices.filter(s => s.status === 'active').length;
        const activeProducts = myProducts.filter(p => p.status === 'active').length;
        
        // Calculate sales from completed orders (derived, not stored on User)
        const completedOrders = await Order.countDocuments({ 
            sellerId: req.user.id, 
            status: 'completed' 
        });
        
        // Calculate average rating from reviews (derived, not stored on User)
        const reviews = await Review.find({ sellerId: req.user.id });
        const avgRating = reviews.length > 0 
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
            : null;  // null means no reviews yet
        
        res.json({
            success: true,
            stats: {
                totalServices: myServices.length,
                activeServices,
                totalProducts: myProducts.length,  // Legacy
                activeProducts,  // Legacy
                completedOrders,
                averageRating: avgRating,
                reviewsCount: reviews.length
            }
        });
    } catch (error) {
        console.error('Get my stats error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// ============ PUBLIC USERS ROUTES ============

// Get public list of users (for seller discovery)
app.get('/api/users', async (req, res) => {
    try {
        // Only return public profile fields, NEVER trust metrics
        const users = await User.find(
            { isActive: true },  // Only active users
            'fullName username avatarUrl bio role'
        );
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
  // Redirect to V2 frontend
  res.sendFile(path.join(__dirname, 'public', 'v2', 'index.html'));
});

// ============ START SERVER ============

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
