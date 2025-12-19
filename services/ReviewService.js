/* ========================================
   Mashriq (مشرق) - Review Service
   ========================================
   
   PURPOSE:
   Provides business logic for review operations.
   Handles review creation, retrieval, and validation.
   
   CONSTITUTION RULES ENFORCED:
   - Reviews allowed ONLY after order COMPLETED
   - Only buyer can leave a review
   - One review per order
   - Review is immutable after creation
   - Trust/reputation values NEVER exposed
   - No admin editing of reviews
   
   INTEGRATIONS:
   - OrderService: For order status checks (read-only)
   - Review Model: For review storage
   
   SECURITY:
   - Validate order is COMPLETED before allowing review
   - Validate user is the order buyer
   - No trust exposure
   - No money handling
   
   ======================================== */

// Models
const Review = require('../models/Review');

// Services
const OrderService = require('./OrderService');
const { ORDER_STATUSES } = require('../models/Order');

/**
 * ReviewService
 * 
 * Business logic layer for review operations.
 * All review operations MUST go through this service.
 */
class ReviewService {
    
    // ============================================================
    // CREATE REVIEW
    // ============================================================
    
    /**
     * Create a review for a completed order.
     * 
     * Business Rules Enforced:
     * 1. Order must exist
     * 2. Order must be in COMPLETED status
     * 3. User must be the buyer of the order
     * 4. Order must not already have a review
     * 5. Rating must be between 1 and 5
     * 
     * @param {string} orderId - ID of the completed order
     * @param {string} buyerId - ID of the buyer creating the review
     * @param {number} rating - Rating (1-5)
     * @param {string} comment - Optional review comment
     * @returns {Promise<Object>} Created review
     * @throws {Error} If validation fails
     */
    async createReview(orderId, buyerId, rating, comment = '') {
        // ============================================================
        // STEP 1: Validate inputs
        // ============================================================
        if (!orderId) {
            throw new Error('رقم الطلب مطلوب');
        }
        
        if (!buyerId) {
            throw new Error('معرف المشتري مطلوب');
        }
        
        if (!rating) {
            throw new Error('التقييم مطلوب');
        }
        
        // Validate rating range
        const parsedRating = parseInt(rating, 10);
        if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
            throw new Error('التقييم يجب أن يكون بين 1 و 5');
        }
        
        // Validate comment length if provided
        if (comment && comment.length > 2000) {
            throw new Error('التعليق يجب أن يكون أقل من 2000 حرف');
        }
        
        // ============================================================
        // STEP 2: Get order and validate existence
        // ============================================================
        const order = await OrderService.getOrderById(orderId);
        
        if (!order) {
            throw new Error('الطلب غير موجود');
        }
        
        // ============================================================
        // STEP 3: Validate order is COMPLETED
        // Constitution: Reviews allowed ONLY after order COMPLETED
        // ============================================================
        if (order.status !== ORDER_STATUSES.COMPLETED) {
            throw new Error('يمكن التقييم فقط بعد إكمال الطلب');
        }
        
        // ============================================================
        // STEP 4: Validate user is the buyer
        // Constitution: Only buyer can create review
        // ============================================================
        if (order.buyerId.toString() !== buyerId.toString()) {
            throw new Error('فقط المشتري يمكنه تقييم هذا الطلب');
        }
        
        // ============================================================
        // STEP 5: Check if order already has a review
        // Constitution: One review per order
        // ============================================================
        const existingReview = await Review.findOne({ orderId });
        
        if (existingReview) {
            throw new Error('تم تقييم هذا الطلب مسبقاً');
        }
        
        // ============================================================
        // STEP 6: Create the review
        // Constitution: Review is immutable after creation
        // ============================================================
        const review = await Review.create({
            orderId: order._id,
            reviewerId: buyerId,
            sellerId: order.sellerId,
            rating: parsedRating,
            comment: comment ? comment.trim() : ''
        });
        
        console.log(`⭐ Review created: ${review._id} | Order: ${orderId} | Rating: ${parsedRating}`);
        
        return review;
    }
    
    // ============================================================
    // GET REVIEW BY ORDER ID
    // ============================================================
    
    /**
     * Get the review for an order.
     * 
     * @param {string} orderId - Order ID
     * @returns {Promise<Object|null>} Review or null
     */
    async getReviewByOrderId(orderId) {
        if (!orderId) {
            throw new Error('رقم الطلب مطلوب');
        }
        
        return await Review.findOne({ orderId });
    }
    
    // ============================================================
    // GET REVIEW BY ID
    // ============================================================
    
    /**
     * Get a review by its ID.
     * 
     * @param {string} reviewId - Review ID
     * @returns {Promise<Object|null>} Review or null
     */
    async getReviewById(reviewId) {
        if (!reviewId) {
            throw new Error('معرّف التقييم مطلوب');
        }
        
        return await Review.findById(reviewId);
    }
    
    // ============================================================
    // GET REVIEWS FOR SELLER
    // ============================================================
    
    /**
     * Get all reviews for a seller.
     * Public endpoint - no access restriction.
     * 
     * @param {string} sellerId - Seller's user ID
     * @param {Object} options - Query options
     * @param {number} options.limit - Max reviews to return (default: 50)
     * @param {number} options.skip - Number of reviews to skip (pagination)
     * @returns {Promise<Array>} Array of reviews
     */
    async getReviewsForSeller(sellerId, { limit = 50, skip = 0 } = {}) {
        if (!sellerId) {
            throw new Error('معرّف البائع مطلوب');
        }
        
        const reviews = await Review.find({ sellerId })
            .sort({ createdAt: -1 })  // Most recent first
            .skip(skip)
            .limit(Math.min(limit, 100));  // Cap at 100
        
        return reviews;
    }
    
    // ============================================================
    // GET SELLER RATING SUMMARY
    // ============================================================
    
    /**
     * Get rating summary for a seller.
     * Returns average rating and count.
     * Does NOT expose trust or internal scores.
     * 
     * @param {string} sellerId - Seller's user ID
     * @returns {Promise<Object>} { averageRating, totalReviews }
     */
    async getSellerRatingSummary(sellerId) {
        if (!sellerId) {
            throw new Error('معرّف البائع مطلوب');
        }
        
        const result = await Review.aggregate([
            { $match: { sellerId: require('mongoose').Types.ObjectId(sellerId) } },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: '$rating' },
                    totalReviews: { $sum: 1 }
                }
            }
        ]);
        
        if (result.length === 0) {
            return {
                averageRating: 0,
                totalReviews: 0
            };
        }
        
        return {
            averageRating: Math.round(result[0].averageRating * 10) / 10,  // Round to 1 decimal
            totalReviews: result[0].totalReviews
        };
    }
    
    // ============================================================
    // CHECK IF ORDER HAS REVIEW
    // ============================================================
    
    /**
     * Check if an order has a review.
     * 
     * @param {string} orderId - Order ID
     * @returns {Promise<boolean>} True if order has a review
     */
    async hasReview(orderId) {
        if (!orderId) {
            return false;
        }
        
        const review = await Review.findOne({ orderId }).select('_id');
        return !!review;
    }
    
    // ============================================================
    // GET REVIEWS BY USER (AS REVIEWER)
    // ============================================================
    
    /**
     * Get all reviews written by a user.
     * 
     * @param {string} reviewerId - Reviewer's user ID
     * @param {Object} options - Query options
     * @param {number} options.limit - Max reviews to return (default: 50)
     * @returns {Promise<Array>} Array of reviews
     */
    async getReviewsByUser(reviewerId, { limit = 50 } = {}) {
        if (!reviewerId) {
            throw new Error('معرّف المستخدم مطلوب');
        }
        
        const reviews = await Review.find({ reviewerId })
            .sort({ createdAt: -1 })
            .limit(Math.min(limit, 100));
        
        return reviews;
    }
}

// Export singleton instance
module.exports = new ReviewService();
