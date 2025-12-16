/* ========================================
   Mashriq (مشرق) - Service Model
   Freelance Services Schema
   Refactored from Product Model
   ======================================== */

const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    // === Basic Information ===
    title: {
        type: String,
        required: [true, 'يرجى إدخال عنوان الخدمة'],
        trim: true,
        maxlength: [100, 'العنوان يجب أن يكون أقل من 100 حرف']
    },
    description: {
        type: String,
        required: [true, 'يرجى إدخال وصف الخدمة'],
        maxlength: [2000, 'الوصف يجب أن يكون أقل من 2000 حرف']
    },
    
    // === Pricing ===
    price: {
        type: Number,
        required: [true, 'يرجى تحديد سعر الخدمة'],
        min: [0, 'السعر لا يمكن أن يكون سالباً']
    },
    
    // === Delivery Terms ===
    deliveryTime: {
        type: Number,
        required: [true, 'يرجى تحديد مدة التسليم'],
        default: 3,
        min: [1, 'مدة التسليم يجب أن تكون يوم واحد على الأقل'],
        max: [90, 'مدة التسليم يجب أن تكون أقل من 90 يوم']
    },
    revisions: {
        type: Number,
        default: 1,
        min: [0, 'عدد التعديلات لا يمكن أن يكون سالباً'],
        max: [10, 'عدد التعديلات يجب أن يكون أقل من 10']
    },
    
    // === Categorization ===
    category: {
        type: String,
        required: [true, 'يرجى اختيار تصنيف الخدمة'],
        enum: {
            values: ['programming', 'design', 'art', 'crafts', 'education', 'other'],
            message: 'التصنيف غير صالح'
        }
    },
    
    // === Media ===
    image: {
        type: String,
        default: 'https://via.placeholder.com/600x400?text=صورة+الخدمة'
    },
    
    // === Seller Information ===
    sellerId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: [true, 'الخدمة يجب أن تكون مرتبطة ببائع']
    },
    sellerName: {
        type: String,
        required: true
    },
    
    // === Buyer Requirements ===
    requirements: {
        type: String,
        default: '',
        maxlength: [1000, 'المتطلبات يجب أن تكون أقل من 1000 حرف']
    },
    
    // === Service Status ===
    status: {
        type: String,
        enum: {
            values: ['active', 'paused', 'deleted'],
            message: 'الحالة غير صالحة'
        },
        default: 'active'
    },
    
    // === Statistics (Denormalized for performance) ===
    ordersCount: {
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
    
    // === Timestamps ===
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

// === INDEXES for Query Performance ===
serviceSchema.index({ sellerId: 1 });
serviceSchema.index({ category: 1 });
serviceSchema.index({ status: 1 });
serviceSchema.index({ createdAt: -1 });
serviceSchema.index({ title: 'text', description: 'text' });

// === VIRTUAL: Seller's Full Profile ===
serviceSchema.virtual('seller', {
    ref: 'User',
    localField: 'sellerId',
    foreignField: '_id',
    justOne: true
});

// === PRE-SAVE: Update timestamp ===
serviceSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// === STATIC: Find active services ===
serviceSchema.statics.findActive = function(filters = {}) {
    return this.find({ status: 'active', ...filters });
};

// === METHOD: Check if user is owner ===
serviceSchema.methods.isOwner = function(userId) {
    return this.sellerId.toString() === userId.toString();
};

module.exports = mongoose.model('Service', serviceSchema);
