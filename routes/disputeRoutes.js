/* ========================================
   Mashriq (مشرق) - Dispute Routes
   ========================================
   
   PURPOSE:
   Express Router for dispute endpoints.
   Maps HTTP routes to DisputeController methods.
   
   RULES:
   - NO logic in routes
   - NO model or service access
   - Authentication via middleware at mount point
   - Permissions enforced in controller
   
   ======================================== */

const express = require('express');
const router = express.Router();

// Controller
const DisputeController = require('../controllers/DisputeController');

// ============================================================
// DISPUTE ROUTES
// All routes require authentication (applied at mount point)
// ============================================================

/**
 * @route   POST /api/disputes
 * @desc    Open a new dispute on an order
 * @access  Private (Buyer)
 */
router.post('/', DisputeController.openDispute.bind(DisputeController));

/**
 * @route   GET /api/disputes
 * @desc    Get disputes list (admin view)
 * @access  Private (Admin)
 */
router.get('/', DisputeController.getDisputes.bind(DisputeController));

/**
 * @route   GET /api/disputes/order/:orderId
 * @desc    Get dispute for a specific order
 * @access  Private (Buyer/Seller/Admin)
 */
router.get('/order/:orderId', DisputeController.getDisputeByOrderId.bind(DisputeController));

/**
 * @route   GET /api/disputes/:id
 * @desc    Get single dispute by ID
 * @access  Private (Buyer/Seller/Admin)
 */
router.get('/:id', DisputeController.getDisputeById.bind(DisputeController));

/**
 * @route   PUT /api/disputes/:id/review
 * @desc    Move dispute to under review status
 * @access  Private (Admin only)
 */
router.put('/:id/review', DisputeController.moveToUnderReview.bind(DisputeController));

/**
 * @route   PUT /api/disputes/:id/resolve
 * @desc    Resolve dispute with a decision
 * @access  Private (Admin only)
 */
router.put('/:id/resolve', DisputeController.resolveDispute.bind(DisputeController));

module.exports = router;
