/* ========================================
   Mashriq (مشرق) - Chat Routes
   ========================================
   
   PURPOSE:
   Express Router for chat endpoints.
   Maps HTTP routes to ChatController methods.
   
   RULES:
   - NO logic in routes
   - NO model or service access
   - Authentication via middleware at mount point
   - Permissions enforced in controller
   
   ROUTE ORDER:
   Static paths BEFORE dynamic params to avoid collision.
   e.g. /order/:orderId BEFORE /:chatId
   
   ======================================== */

const express = require('express');
const router = express.Router();

// Controller
const ChatController = require('../controllers/ChatController');

// ============================================================
// CHAT ROUTES
// All routes require authentication (applied at mount point)
// ============================================================

/**
 * @route   GET /api/chats
 * @desc    Get all chats for authenticated user
 * @access  Private (Buyer/Seller)
 */
router.get('/', ChatController.getMyChats.bind(ChatController));

/**
 * @route   GET /api/chats/order/:orderId
 * @desc    Get chat for a specific order
 * @access  Private (Buyer/Seller)
 * 
 * NOTE: This route MUST be before /:chatId to avoid collision
 */
router.get('/order/:orderId', ChatController.getChatForOrder.bind(ChatController));

/**
 * @route   GET /api/chats/:chatId
 * @desc    Get chat by ID
 * @access  Private (Buyer/Seller)
 */
router.get('/:chatId', ChatController.getChatById.bind(ChatController));

/**
 * @route   GET /api/chats/:chatId/messages
 * @desc    Get messages for a chat
 * @access  Private (Buyer/Seller)
 */
router.get('/:chatId/messages', ChatController.getMessages.bind(ChatController));

/**
 * @route   POST /api/chats/:chatId/messages
 * @desc    Send a message in a chat
 * @access  Private (Buyer/Seller)
 */
router.post('/:chatId/messages', ChatController.sendMessage.bind(ChatController));

module.exports = router;
