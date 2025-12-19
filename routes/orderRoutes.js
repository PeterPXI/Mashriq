/* ========================================
   Mashriq (مشرق) - Order Routes
   ========================================
   
   PURPOSE:
   Express Router for order endpoints.
   Maps HTTP routes to OrderController methods.
   
   RULES:
   - NO logic in routes
   - NO model or service access
   - Authentication via middleware
   - Permissions enforced in controller
   
   ======================================== */

const express = require('express');
const router = express.Router();

// Controller
const OrderController = require('../controllers/OrderController');

// ============================================================
// ORDER ROUTES
// All routes require authentication (applied at mount point)
// ============================================================

/**
 * @route   POST /api/orders
 * @desc    Create a new order
 * @access  Private (Buyer)
 */
router.post('/', OrderController.createOrder.bind(OrderController));

/**
 * @route   GET /api/orders
 * @desc    Get orders for authenticated user
 * @access  Private
 */
router.get('/', OrderController.getOrders.bind(OrderController));

/**
 * @route   GET /api/orders/:id
 * @desc    Get single order by ID
 * @access  Private (Buyer/Seller/Admin)
 */
router.get('/:id', OrderController.getOrderById.bind(OrderController));

/**
 * @route   PUT /api/orders/:id/deliver
 * @desc    Mark order as delivered
 * @access  Private (Seller only)
 */
router.put('/:id/deliver', OrderController.deliverOrder.bind(OrderController));

/**
 * @route   PUT /api/orders/:id/complete
 * @desc    Complete order (accept delivery)
 * @access  Private (Buyer only)
 */
router.put('/:id/complete', OrderController.completeOrder.bind(OrderController));

/**
 * @route   PUT /api/orders/:id/cancel
 * @desc    Cancel order
 * @access  Private (Buyer/Seller)
 */
router.put('/:id/cancel', OrderController.cancelOrder.bind(OrderController));

module.exports = router;
