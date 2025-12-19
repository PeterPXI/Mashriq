/* ========================================
   Mashriq (مشرق) - Review Routes
   ========================================
   
   PURPOSE:
   Express Router for review endpoints.
   Maps HTTP routes to ReviewController methods.
   
   RULES:
   - NO logic in routes
   - NO model or service access
   - Authentication applied per-route (not globally)
   - Permissions enforced in controller
   
   AUTH STRATEGY:
   - POST / → requires auth (buyer creates review)
   - GET /check/:orderId → requires auth
   - All other GET routes → public
   
   ROUTE ORDER:
   Static paths BEFORE dynamic params to avoid collision.
   e.g. /order/:orderId BEFORE /:id
   
   ======================================== */

const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Controller
const ReviewController = require('../controllers/ReviewController');

// Model (for auth middleware only)
const User = require('../models/User');

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'mashriq_simple_secret';

// ============================================================
// AUTHENTICATION MIDDLEWARE (Per-Route)
// ============================================================

/**
 * Authenticate token middleware.
 * Used only for protected routes in this router.
 */
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

// ============================================================
// REVIEW ROUTES
// ============================================================

/**
 * @route   POST /api/reviews
 * @desc    Create a review for a completed order
 * @access  Private (Buyer)
 */
router.post('/', authenticateToken, ReviewController.createReview.bind(ReviewController));

/**
 * @route   GET /api/reviews/order/:orderId
 * @desc    Get review for a specific order
 * @access  Public
 * 
 * NOTE: Must be before /:id to avoid collision
 */
router.get('/order/:orderId', ReviewController.getReviewByOrderId.bind(ReviewController));

/**
 * @route   GET /api/reviews/seller/:sellerId
 * @desc    Get all reviews for a seller
 * @access  Public
 * 
 * NOTE: Must be before /:id to avoid collision
 */
router.get('/seller/:sellerId', ReviewController.getReviewsForSeller.bind(ReviewController));

/**
 * @route   GET /api/reviews/check/:orderId
 * @desc    Check if an order has a review
 * @access  Private
 * 
 * NOTE: Must be before /:id to avoid collision
 */
router.get('/check/:orderId', authenticateToken, ReviewController.checkOrderHasReview.bind(ReviewController));

/**
 * @route   GET /api/reviews/:id
 * @desc    Get review by ID
 * @access  Public
 */
router.get('/:id', ReviewController.getReviewById.bind(ReviewController));

module.exports = router;
