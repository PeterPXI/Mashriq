/* ========================================
   Mashriq (مشرق) - Order Model
   Freelance Orders & Escrow System
   ======================================== */

const mongoose = require('mongoose');

// === ORDER STATUS CONSTANTS ===
const ORDER_STATUSES = {
    PENDING: 'pending',           // في انتظار قبول البائع
    IN_PROGRESS: 'in_progress',   // البائع يعمل على الطلب
    DELIVERED: 'delivered',       // البائع سلّم العمل
    REVISION: 'revision',         // المشتري طلب تعديل
    APPROVED: 'approved',         // المشتري وافق (قبل تحويل الأموال)
    COMPLETED: 'completed',       // تم الإغلاق + تحويل الأموال
    DISPUTED: 'disputed',         // نزاع مفتوح
    CANCELLED: 'cancelled',       // ملغي (قبل البدء)
    REFUNDED: 'refunded'          // تم رد الأموال
};

const orderSchema = new mongoose.Schema({
    // === Order Identification ===
    orderNumber: {
        type: String,
        unique: true,
        required: true
    },
    
    // === Service Reference (Snapshot) ===
    serviceId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Service',
        required: [true, 'الطلب يجب أن يكون مرتبطاً بخدمة']
    },
    serviceSnapshot: {
        title: { type: String, required: true },
        price: { type: Number, required: true },
        deliveryTime: { type: Number, required: true },
        revisions: { type: Number, default: 1 },
        image: { type: String }
    },
    
    // === Buyer Information ===
    buyerId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: [true, 'الطلب يجب أن يكون مرتبطاً بمشتري']
    },
    buyerName: {
        type: String,
        required: true
    },
    
    // === Seller Information ===
    sellerId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: [true, 'الطلب يجب أن يكون مرتبطاً ببائع']
    },
    sellerName: {
        type: String,
        required: true
    },
    
    // === Buyer Requirements ===
    buyerRequirements: {
        type: String,
        default: '',
        maxlength: [2000, 'المتطلبات يجب أن تكون أقل من 2000 حرف']
    },
    
    // === Financial Details ===
    amount: {
        type: Number,
        required: [true, 'يجب تحديد المبلغ'],
        min: [0, 'المبلغ لا يمكن أن يكون سالباً']
    },
    platformFeePercent: {
        type: Number,
        default: 20  // 20%
    },
    platformFee: {
        type: Number,
        default: 0
    },
    sellerEarnings: {
        type: Number,
        default: 0
    },
    
    // === Order Status ===
    status: {
        type: String,
        enum: {
            values: Object.values(ORDER_STATUSES),
            message: 'حالة الطلب غير صالحة'
        },
        default: ORDER_STATUSES.PENDING
    },
    
    // === Revision Tracking ===
    revisionsUsed: {
        type: Number,
        default: 0
    },
    revisionsAllowed: {
        type: Number,
        default: 1
    },
    
    // === Delivery Information ===
    expectedDeliveryDate: {
        type: Date
    },
    deliveredAt: {
        type: Date
    },
    deliveryMessage: {
        type: String,
        maxlength: [1000, 'رسالة التسليم يجب أن تكون أقل من 1000 حرف']
    },
    
    // === Dispute Information ===
    disputeReason: {
        type: String,
        maxlength: [1000, 'سبب النزاع يجب أن يكون أقل من 1000 حرف']
    },
    disputeOpenedAt: {
        type: Date
    },
    disputeResolution: {
        type: String
    },
    disputeResolvedAt: {
        type: Date
    },
    resolvedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    },
    
    // === Cancellation Information ===
    cancelledBy: {
        type: String,
        enum: ['buyer', 'seller', 'admin', 'system']
    },
    cancellationReason: {
        type: String
    },
    
    // === Timestamps ===
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    acceptedAt: {
        type: Date
    },
    completedAt: {
        type: Date
    }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// === INDEXES ===
orderSchema.index({ buyerId: 1 });
orderSchema.index({ sellerId: 1 });
orderSchema.index({ serviceId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ createdAt: -1 });

// === VIRTUAL: Calculate if can request revision ===
orderSchema.virtual('canRequestRevision').get(function() {
    return this.status === ORDER_STATUSES.DELIVERED && 
           this.revisionsUsed < this.revisionsAllowed;
});

// === VIRTUAL: Check if order is active ===
orderSchema.virtual('isActive').get(function() {
    return [
        ORDER_STATUSES.PENDING,
        ORDER_STATUSES.IN_PROGRESS,
        ORDER_STATUSES.DELIVERED,
        ORDER_STATUSES.REVISION
    ].includes(this.status);
});

// === PRE-SAVE: Auto-generate order number & calculate fees ===
orderSchema.pre('save', async function(next) {
    // Update timestamp
    this.updatedAt = Date.now();
    
    // Generate order number if new
    if (this.isNew && !this.orderNumber) {
        const year = new Date().getFullYear();
        const count = await mongoose.model('Order').countDocuments();
        this.orderNumber = `MSH-${year}-${String(count + 1).padStart(6, '0')}`;
    }
    
    // Calculate financial split
    if (this.amount && !this.platformFee) {
        this.platformFee = Math.round(this.amount * (this.platformFeePercent / 100));
        this.sellerEarnings = this.amount - this.platformFee;
    }
    
    // Set expected delivery date if not set
    if (this.isNew && this.serviceSnapshot?.deliveryTime && !this.expectedDeliveryDate) {
        const deliveryDays = this.serviceSnapshot.deliveryTime;
        this.expectedDeliveryDate = new Date(Date.now() + deliveryDays * 24 * 60 * 60 * 1000);
    }
    
    // Set revisions allowed from service snapshot
    if (this.isNew && this.serviceSnapshot?.revisions) {
        this.revisionsAllowed = this.serviceSnapshot.revisions;
    }
    
    next();
});

// === STATIC: Generate unique order number ===
orderSchema.statics.generateOrderNumber = async function() {
    const year = new Date().getFullYear();
    const count = await this.countDocuments();
    return `MSH-${year}-${String(count + 1).padStart(6, '0')}`;
};

// === METHOD: Check if user is buyer ===
orderSchema.methods.isBuyer = function(userId) {
    return this.buyerId.toString() === userId.toString();
};

// === METHOD: Check if user is seller ===
orderSchema.methods.isSeller = function(userId) {
    return this.sellerId.toString() === userId.toString();
};

// === METHOD: Check if user is involved ===
orderSchema.methods.isInvolved = function(userId) {
    return this.isBuyer(userId) || this.isSeller(userId);
};

// === METHOD: Can transition to status ===
orderSchema.methods.canTransitionTo = function(newStatus, userId) {
    const currentStatus = this.status;
    const isBuyer = this.isBuyer(userId);
    const isSeller = this.isSeller(userId);
    
    const transitions = {
        [ORDER_STATUSES.PENDING]: {
            [ORDER_STATUSES.IN_PROGRESS]: isSeller,      // Seller accepts
            [ORDER_STATUSES.CANCELLED]: isSeller         // Seller declines
        },
        [ORDER_STATUSES.IN_PROGRESS]: {
            [ORDER_STATUSES.DELIVERED]: isSeller,        // Seller delivers
            [ORDER_STATUSES.DISPUTED]: isBuyer || isSeller
        },
        [ORDER_STATUSES.DELIVERED]: {
            [ORDER_STATUSES.APPROVED]: isBuyer,          // Buyer approves
            [ORDER_STATUSES.REVISION]: isBuyer,          // Buyer requests revision
            [ORDER_STATUSES.DISPUTED]: isBuyer || isSeller
        },
        [ORDER_STATUSES.REVISION]: {
            [ORDER_STATUSES.DELIVERED]: isSeller,        // Seller re-delivers
            [ORDER_STATUSES.DISPUTED]: isBuyer || isSeller
        },
        [ORDER_STATUSES.APPROVED]: {
            [ORDER_STATUSES.COMPLETED]: true             // Auto or admin
        },
        [ORDER_STATUSES.DISPUTED]: {
            [ORDER_STATUSES.COMPLETED]: false,           // Admin only
            [ORDER_STATUSES.REFUNDED]: false             // Admin only
        }
    };
    
    const allowed = transitions[currentStatus]?.[newStatus];
    return allowed === true || allowed === isBuyer || allowed === isSeller;
};

// Export model and constants
module.exports = mongoose.model('Order', orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
