/* ========================================
   Mashriq (مشرق) - Review Model
   Service Reviews & Ratings
   ======================================== */

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    // === Order Reference (One review per completed order) ===
    orderId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Order',
        required: [true, 'التقييم يجب أن يكون مرتبطاً بطلب'],
        unique: true  // Ensures one review per order
    },
    
    // === Service Reference ===
    serviceId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Service',
        required: [true, 'التقييم يجب أن يكون مرتبطاً بخدمة']
    },
    
    // === Reviewer (Buyer) ===
    reviewerId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: [true, 'التقييم يجب أن يكون مرتبطاً بمشتري']
    },
    reviewerName: {
        type: String,
        required: true
    },
    
    // === Seller being reviewed ===
    sellerId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: [true, 'التقييم يجب أن يكون مرتبطاً ببائع']
    },
    
    // === Rating ===
    rating: {
        type: Number,
        required: [true, 'يرجى تحديد التقييم'],
        min: [1, 'التقييم يجب أن يكون 1 على الأقل'],
        max: [5, 'التقييم يجب أن يكون 5 كحد أقصى']
    },
    
    // === Review Content ===
    comment: {
        type: String,
        maxlength: [1000, 'التعليق يجب أن يكون أقل من 1000 حرف'],
        default: ''
    },
    
    // === Seller Response (Optional) ===
    sellerResponse: {
        type: String,
        maxlength: [500, 'الرد يجب أن يكون أقل من 500 حرف']
    },
    sellerRespondedAt: {
        type: Date
    },
    
    // === Timestamps ===
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// === INDEXES ===
reviewSchema.index({ serviceId: 1 });
reviewSchema.index({ sellerId: 1 });
reviewSchema.index({ reviewerId: 1 });
reviewSchema.index({ orderId: 1 }, { unique: true });
reviewSchema.index({ createdAt: -1 });

// === STATIC: Calculate average rating for a service ===
reviewSchema.statics.calculateServiceRating = async function(serviceId) {
    const result = await this.aggregate([
        { $match: { serviceId: new mongoose.Types.ObjectId(serviceId) } },
        {
            $group: {
                _id: '$serviceId',
                averageRating: { $avg: '$rating' },
                reviewsCount: { $sum: 1 }
            }
        }
    ]);
    
    if (result.length > 0) {
        await mongoose.model('Service').findByIdAndUpdate(serviceId, {
            rating: Math.round(result[0].averageRating * 10) / 10,
            reviewsCount: result[0].reviewsCount
        });
    }
    
    return result[0] || { averageRating: 0, reviewsCount: 0 };
};

// === STATIC: Calculate average rating for a seller ===
reviewSchema.statics.calculateSellerRating = async function(sellerId) {
    const result = await this.aggregate([
        { $match: { sellerId: new mongoose.Types.ObjectId(sellerId) } },
        {
            $group: {
                _id: '$sellerId',
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 }
            }
        }
    ]);
    
    if (result.length > 0) {
        await mongoose.model('User').findByIdAndUpdate(sellerId, {
            rating: Math.round(result[0].averageRating * 10) / 10
        });
    }
    
    return result[0] || { averageRating: 0, totalReviews: 0 };
};

// === POST-SAVE: Update ratings ===
reviewSchema.post('save', async function() {
    await this.constructor.calculateServiceRating(this.serviceId);
    await this.constructor.calculateSellerRating(this.sellerId);
});

// === POST-REMOVE: Recalculate ratings ===
reviewSchema.post('remove', async function() {
    await this.constructor.calculateServiceRating(this.serviceId);
    await this.constructor.calculateSellerRating(this.sellerId);
});

module.exports = mongoose.model('Review', reviewSchema);
