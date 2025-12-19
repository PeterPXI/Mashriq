/* ========================================
   Mashriq (مشرق) - Review Controller
   ========================================
   
   PURPOSE:
   HTTP interface layer for review operations.
   Handles authentication, validation, and permission enforcement.
   Delegates ALL business logic to ReviewService.
   
   ARCHITECTURE:
   Controller → Service → Model
   
   RULES:
   - NO direct model access
   - NO business logic
   - ONLY call ReviewService methods
   - Buyer only for creating reviews
   
   ======================================== */

const ReviewService = require('../services/ReviewService');

/**
 * ReviewController
 * 
 * HTTP interface for review operations.
 * All methods are async Express route handlers.
 */
class ReviewController {
    
    // ============================================================
    // CREATE REVIEW
    // POST /api/reviews
    // Permission: Buyer only (on their own completed order)
    // ============================================================
    
    /**
     * Create a review for a completed order.
     * 
     * @route POST /api/reviews
     * @body orderId - ID of the completed order
     * @body rating - Rating (1-5)
     * @body comment - Optional review comment
     * @access Private (Buyer)
     */
    async createReview(req, res) {
        try {
            const { orderId, rating, comment } = req.body;
            
            // Validate orderId is provided
            if (!orderId) {
                return res.status(400).json({
                    success: false,
                    message: 'رقم الطلب مطلوب'
                });
            }
            
            // Validate orderId format
            if (typeof orderId !== 'string' || orderId.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: 'معرّف الطلب غير صالح'
                });
            }
            
            // Validate rating is provided
            if (rating === undefined || rating === null) {
                return res.status(400).json({
                    success: false,
                    message: 'التقييم مطلوب'
                });
            }
            
            // Validate rating is a number
            const parsedRating = parseInt(rating, 10);
            if (isNaN(parsedRating)) {
                return res.status(400).json({
                    success: false,
                    message: 'التقييم يجب أن يكون رقماً'
                });
            }
            
            // Validate rating range
            if (parsedRating < 1 || parsedRating > 5) {
                return res.status(400).json({
                    success: false,
                    message: 'التقييم يجب أن يكون بين 1 و 5'
                });
            }
            
            // Validate comment if provided
            if (comment !== undefined && typeof comment !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'التعليق يجب أن يكون نصاً'
                });
            }
            
            // Call ReviewService - it validates buyer ownership and order status
            const review = await ReviewService.createReview(
                orderId,
                req.user._id,
                parsedRating,
                comment || ''
            );
            
            res.status(201).json({
                success: true,
                message: 'تم إضافة التقييم بنجاح! شكراً لك ⭐',
                review
            });
            
        } catch (error) {
            console.error('Create review error:', error);
            
            const message = error.message;
            let statusCode = 400;
            
            if (message.includes('فقط المشتري')) {
                statusCode = 403;
            } else if (message.includes('غير موجود')) {
                statusCode = 404;
            } else if (message.includes('مسبقاً')) {
                statusCode = 409;  // Conflict - already reviewed
            }
            
            res.status(statusCode).json({
                success: false,
                message: message || 'حدث خطأ في إضافة التقييم'
            });
        }
    }
    
    // ============================================================
    // GET REVIEW FOR ORDER
    // GET /api/reviews/order/:orderId
    // Permission: Public (reviews are public)
    // ============================================================
    
    /**
     * Get the review for a specific order.
     * 
     * @route GET /api/reviews/order/:orderId
     * @access Public
     */
    async getReviewByOrderId(req, res) {
        try {
            const { orderId } = req.params;
            
            // Validate orderId format
            if (!orderId || orderId.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: 'معرّف الطلب غير صالح'
                });
            }
            
            // Call ReviewService
            const review = await ReviewService.getReviewByOrderId(orderId);
            
            if (!review) {
                return res.status(404).json({
                    success: false,
                    message: 'لا يوجد تقييم لهذا الطلب'
                });
            }
            
            res.status(200).json({
                success: true,
                review
            });
            
        } catch (error) {
            console.error('Get review by order ID error:', error);
            
            res.status(500).json({
                success: false,
                message: 'حدث خطأ في جلب التقييم'
            });
        }
    }
    
    // ============================================================
    // GET REVIEW BY ID
    // GET /api/reviews/:id
    // Permission: Public (reviews are public)
    // ============================================================
    
    /**
     * Get a review by its ID.
     * 
     * @route GET /api/reviews/:id
     * @access Public
     */
    async getReviewById(req, res) {
        try {
            const { id } = req.params;
            
            // Validate ID format
            if (!id || id.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: 'معرّف التقييم غير صالح'
                });
            }
            
            // Call ReviewService
            const review = await ReviewService.getReviewById(id);
            
            if (!review) {
                return res.status(404).json({
                    success: false,
                    message: 'التقييم غير موجود'
                });
            }
            
            res.status(200).json({
                success: true,
                review
            });
            
        } catch (error) {
            console.error('Get review by ID error:', error);
            
            if (error.kind === 'ObjectId') {
                return res.status(404).json({
                    success: false,
                    message: 'التقييم غير موجود'
                });
            }
            
            res.status(500).json({
                success: false,
                message: 'حدث خطأ في جلب التقييم'
            });
        }
    }
    
    // ============================================================
    // GET REVIEWS FOR SELLER
    // GET /api/reviews/seller/:sellerId
    // Permission: Public (reviews are public)
    // ============================================================
    
    /**
     * Get all reviews for a seller.
     * 
     * @route GET /api/reviews/seller/:sellerId
     * @query limit - Max reviews to return (default: 50)
     * @query skip - Number of reviews to skip (pagination)
     * @access Public
     */
    async getReviewsForSeller(req, res) {
        try {
            const { sellerId } = req.params;
            const { limit, skip } = req.query;
            
            // Validate sellerId format
            if (!sellerId || sellerId.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: 'معرّف البائع غير صالح'
                });
            }
            
            // Parse limit
            let parsedLimit = 50;
            if (limit) {
                parsedLimit = parseInt(limit, 10);
                if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
                    return res.status(400).json({
                        success: false,
                        message: 'الحد الأقصى يجب أن يكون بين 1 و 100'
                    });
                }
            }
            
            // Parse skip
            let parsedSkip = 0;
            if (skip) {
                parsedSkip = parseInt(skip, 10);
                if (isNaN(parsedSkip) || parsedSkip < 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'قيمة التخطي غير صالحة'
                    });
                }
            }
            
            // Call ReviewService
            const reviews = await ReviewService.getReviewsForSeller(sellerId, {
                limit: parsedLimit,
                skip: parsedSkip
            });
            
            // Get rating summary
            const summary = await ReviewService.getSellerRatingSummary(sellerId);
            
            res.status(200).json({
                success: true,
                count: reviews.length,
                averageRating: summary.averageRating,
                totalReviews: summary.totalReviews,
                reviews
            });
            
        } catch (error) {
            console.error('Get reviews for seller error:', error);
            
            res.status(500).json({
                success: false,
                message: 'حدث خطأ في جلب التقييمات'
            });
        }
    }
    
    // ============================================================
    // CHECK IF ORDER HAS REVIEW
    // GET /api/reviews/check/:orderId
    // Permission: Authenticated
    // ============================================================
    
    /**
     * Check if an order has a review.
     * 
     * @route GET /api/reviews/check/:orderId
     * @access Private
     */
    async checkOrderHasReview(req, res) {
        try {
            const { orderId } = req.params;
            
            // Validate orderId format
            if (!orderId || orderId.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: 'معرّف الطلب غير صالح'
                });
            }
            
            // Call ReviewService
            const hasReview = await ReviewService.hasReview(orderId);
            
            res.status(200).json({
                success: true,
                hasReview
            });
            
        } catch (error) {
            console.error('Check order has review error:', error);
            
            res.status(500).json({
                success: false,
                message: 'حدث خطأ في التحقق من التقييم'
            });
        }
    }
}

// Export singleton instance
module.exports = new ReviewController();
