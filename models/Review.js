/* ========================================
   Mashriq (مشرق) - Review Model
   ========================================
   
   PURPOSE:
   Represents a buyer's feedback on a COMPLETED order.
   Reviews are public but cannot be edited or deleted.
   Reviews contribute to seller reputation internally
   (via TrustService, not publicly displayed as scores).
   
   CONSTITUTION RULES:
   - Reviews are IMMUTABLE (cannot be edited or deleted once created)
   - Reviews are tied to COMPLETED orders only
   - Only the buyer can submit a review
   - Each order can have at most one review
   - Rating and review data contribute to internal trust metrics
   
   IMMUTABLE FIELDS:
   - ALL FIELDS ARE IMMUTABLE
   - Reviews cannot be edited or deleted once created
   
   WRITE PERMISSIONS:
   - ReviewService: Create only
   
   NO UPDATES OR DELETES ALLOWED BY ANY SERVICE.
   
   READ PERMISSIONS:
   - ReviewService: All fields
   - ServiceService: All fields (to display on service page)
   - TrustService: rating, sellerId (to update trust metrics)
   
   CRITICAL INVARIANTS:
   1. A review can ONLY be created for an order in COMPLETED status
   2. Only the BUYER can create a review (reviewerId must be order's buyerId)
   3. Each order can have AT MOST ONE review
   4. rating must be between 1 and 5 inclusive
   5. Reviews are NEVER deleted (admin can hide but not destroy)
   6. sellerId must match order's sellerId
   
   ======================================== */

const mongoose = require('mongoose');

// ============================================================
// REVIEW SCHEMA
// ============================================================
const reviewSchema = new mongoose.Schema({
    
    // ============================================================
    // REFERENCES
    // ============================================================
    
    /**
     * Reference to the completed Order being reviewed.
     * UNIQUE - each order can have at most one review.
     * IMMUTABLE.
     */
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: [true, 'التقييم يجب أن يكون مرتبطاً بطلب'],
        unique: true,
        immutable: true
    },
    
    /**
     * Reference to the buyer User who wrote the review.
     * MUST be the order's buyerId.
     * IMMUTABLE.
     */
    reviewerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'التقييم يجب أن يكون مرتبطاً بمشتري'],
        immutable: true
    },
    
    /**
     * Reference to the seller User being reviewed.
     * MUST match order's sellerId.
     * Used for aggregating seller ratings.
     * IMMUTABLE.
     */
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'التقييم يجب أن يكون مرتبطاً ببائع'],
        immutable: true
    },
    
    // ============================================================
    // REVIEW CONTENT
    // ============================================================
    
    /**
     * Numeric rating (1-5 stars).
     * IMMUTABLE.
     */
    rating: {
        type: Number,
        required: [true, 'التقييم مطلوب'],
        min: [1, 'التقييم يجب أن يكون 1 على الأقل'],
        max: [5, 'التقييم يجب أن يكون 5 كحد أقصى'],
        immutable: true
    },
    
    /**
     * Text review content.
     * Optional but encouraged.
     * IMMUTABLE.
     */
    comment: {
        type: String,
        default: '',
        maxlength: [2000, 'التعليق يجب أن يكون أقل من 2000 حرف'],
        immutable: true
    },
    
    // ============================================================
    // TIMESTAMP
    // ============================================================
    
    /**
     * Review creation timestamp.
     * IMMUTABLE - set once at creation.
     */
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true
    }
    
}, {
    // Enable virtuals in JSON/Object conversion
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ============================================================
// INDEXES
// Optimize database queries for common access patterns.
// ============================================================

// Order lookup (check if order has review)
reviewSchema.index({ orderId: 1 }, { unique: true });

// Seller's reviews (for profile page and rating calculation)
reviewSchema.index({ sellerId: 1, createdAt: -1 });

// Reviewer's reviews (for user's review history)
reviewSchema.index({ reviewerId: 1 });

// Rating distribution analysis
reviewSchema.index({ sellerId: 1, rating: 1 });

// Chronological listing
reviewSchema.index({ createdAt: -1 });

// ============================================================
// VIRTUALS
// Computed properties from relationships.
// ============================================================

/**
 * Virtual: Related order.
 * Populated from Order model when needed.
 */
reviewSchema.virtual('order', {
    ref: 'Order',
    localField: 'orderId',
    foreignField: '_id',
    justOne: true
});

/**
 * Virtual: Reviewer's profile.
 * Populated from User model when needed.
 */
reviewSchema.virtual('reviewer', {
    ref: 'User',
    localField: 'reviewerId',
    foreignField: '_id',
    justOne: true
});

/**
 * Virtual: Seller's profile.
 * Populated from User model when needed.
 */
reviewSchema.virtual('seller', {
    ref: 'User',
    localField: 'sellerId',
    foreignField: '_id',
    justOne: true
});

// ============================================================
// CRITICAL INVARIANTS (Documented for reference)
// These are NOT enforced by the model - they are enforced by SERVICES.
// ============================================================
/*
 * 1. A review can ONLY be created for an order in COMPLETED status
 * 2. Only the BUYER can create a review (reviewerId must be order's buyerId)
 * 3. Each order can have AT MOST ONE review
 * 4. rating must be between 1 and 5 inclusive
 * 5. Reviews are NEVER deleted (admin can hide but not destroy)
 * 6. sellerId must match order's sellerId
 */

// ============================================================
// EXPORT
// ============================================================

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
