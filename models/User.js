/* ========================================
   Mashriq (مشرق) - User Model
   Updated for Freelance Marketplace
   ======================================== */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// === USER ROLES ===
const USER_ROLES = {
    BUYER: 'buyer',
    SELLER: 'seller',
    ADMIN: 'admin'
};

const userSchema = new mongoose.Schema({
    // === Basic Information ===
    name: {
        type: String,
        required: [true, 'يرجى إدخال الاسم']
    },
    username: {
        type: String,
        required: [true, 'يرجى إدخال اسم المستخدم'],
        unique: true,
        lowercase: true,
        trim: true
    },
    email: {
        type: String,
        required: [true, 'يرجى إدخال البريد الإلكتروني'],
        unique: true,
        lowercase: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'يرجى إدخال بريد إلكتروني صالح'
        ]
    },
    password: {
        type: String,
        required: [true, 'يرجى إدخال كلمة المرور']
    },
    phone: {
        type: String,
        default: ''
    },
    
    // === Student Information ===
    grade: {
        type: String,
        default: ''
    },
    specialization: {
        type: String,
        default: ''
    },
    
    // === Profile ===
    avatar: {
        type: String
    },
    bio: {
        type: String,
        maxlength: [500, 'الوصف يجب أن يكون أقل من 500 حرف'],
        default: ''
    },
    
    // === Role & Seller Status ===
    role: {
        type: String,
        enum: Object.values(USER_ROLES),
        default: USER_ROLES.BUYER
    },
    isSeller: {
        type: Boolean,
        default: false
    },
    sellerActivatedAt: {
        type: Date
    },
    
    // === Financial (Escrow Wallet) ===
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    pendingBalance: {
        type: Number,
        default: 0,
        min: 0
    },
    totalEarnings: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // === Statistics (Kept for backwards compatibility, updated by Orders) ===
    sales: {
        type: Number,
        default: 0
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    reviewsCount: {
        type: Number,
        default: 0
    },
    
    // === System ===
    isDemo: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// === INDEXES ===
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ isSeller: 1 });
userSchema.index({ role: 1 });

// === VIRTUAL: Services (for sellers) ===
userSchema.virtual('services', {
    ref: 'Service',
    localField: '_id',
    foreignField: 'sellerId',
    justOne: false
});

// === VIRTUAL: Orders as Buyer ===
userSchema.virtual('ordersAsBuyer', {
    ref: 'Order',
    localField: '_id',
    foreignField: 'buyerId',
    justOne: false
});

// === VIRTUAL: Orders as Seller ===
userSchema.virtual('ordersAsSeller', {
    ref: 'Order',
    localField: '_id',
    foreignField: 'sellerId',
    justOne: false
});

// Encrypt password using bcrypt
userSchema.pre('save', async function(next) {
    // Update timestamp
    this.updatedAt = Date.now();
    
    // Hash password if modified
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
    if (this.isDemo && enteredPassword === 'demo123') {
        return true;
    }
    return await bcrypt.compare(enteredPassword, this.password);
};

// === METHOD: Activate seller mode ===
userSchema.methods.activateSeller = async function() {
    if (this.isSeller) {
        return { success: false, message: 'أنت بائع بالفعل' };
    }
    
    this.isSeller = true;
    this.role = USER_ROLES.SELLER;
    this.sellerActivatedAt = Date.now();
    await this.save();
    
    return { success: true, message: 'تم تفعيل وضع البائع بنجاح!' };
};

// === METHOD: Check if user can sell ===
userSchema.methods.canSell = function() {
    return this.isSeller || this.role === USER_ROLES.SELLER || this.role === USER_ROLES.ADMIN;
};

// === METHOD: Check if user is admin ===
userSchema.methods.isAdmin = function() {
    return this.role === USER_ROLES.ADMIN;
};

// Export model and constants
const User = mongoose.model('User', userSchema);
module.exports = User;
module.exports.USER_ROLES = USER_ROLES;

