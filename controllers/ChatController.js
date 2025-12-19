/* ========================================
   Mashriq (مشرق) - Chat Controller
   ========================================
   
   PURPOSE:
   HTTP interface layer for chat operations.
   Handles authentication, validation, and permission enforcement.
   Delegates ALL business logic to ChatService.
   
   ARCHITECTURE:
   Controller → Service → Model
   
   RULES:
   - NO direct model access
   - NO business logic
   - ONLY call ChatService methods
   - Buyer & Seller access only (no admin)
   
   ======================================== */

const ChatService = require('../services/ChatService');

/**
 * ChatController
 * 
 * HTTP interface for chat operations.
 * All methods are async Express route handlers.
 */
class ChatController {
    
    // ============================================================
    // GET CHAT FOR ORDER
    // GET /api/chats/order/:orderId
    // Permission: Buyer or Seller of the order
    // ============================================================
    
    /**
     * Get the chat for a specific order.
     * 
     * @route GET /api/chats/order/:orderId
     * @access Private (Buyer/Seller)
     */
    async getChatForOrder(req, res) {
        try {
            const { orderId } = req.params;
            
            // Validate orderId format
            if (!orderId || orderId.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: 'معرّف الطلب غير صالح'
                });
            }
            
            // Call ChatService - it validates access
            const chat = await ChatService.getChatForOrder(orderId, req.user._id);
            
            // Check if chat can receive messages
            const canSend = await ChatService.canSendMessages(chat._id);
            
            res.status(200).json({
                success: true,
                chat,
                canSendMessages: canSend
            });
            
        } catch (error) {
            console.error('Get chat for order error:', error);
            
            const message = error.message;
            let statusCode = 400;
            
            if (message.includes('صلاحية')) {
                statusCode = 403;
            } else if (message.includes('غير موجود')) {
                statusCode = 404;
            }
            
            res.status(statusCode).json({
                success: false,
                message: message || 'حدث خطأ في جلب المحادثة'
            });
        }
    }
    
    // ============================================================
    // GET CHAT BY ID
    // GET /api/chats/:chatId
    // Permission: Buyer or Seller of the chat
    // ============================================================
    
    /**
     * Get a chat by its ID.
     * 
     * @route GET /api/chats/:chatId
     * @access Private (Buyer/Seller)
     */
    async getChatById(req, res) {
        try {
            const { chatId } = req.params;
            
            // Validate chatId format
            if (!chatId || chatId.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: 'معرّف المحادثة غير صالح'
                });
            }
            
            // Call ChatService - it validates access
            const chat = await ChatService.getChatById(chatId, req.user._id);
            
            // Check if chat can receive messages
            const canSend = await ChatService.canSendMessages(chat._id);
            
            // Determine user role in chat
            const userId = req.user._id.toString();
            const userRole = chat.buyerId.toString() === userId ? 'buyer' : 'seller';
            
            res.status(200).json({
                success: true,
                chat,
                userRole,
                canSendMessages: canSend
            });
            
        } catch (error) {
            console.error('Get chat by ID error:', error);
            
            const message = error.message;
            let statusCode = 400;
            
            if (message.includes('صلاحية')) {
                statusCode = 403;
            } else if (message.includes('غير موجود')) {
                statusCode = 404;
            }
            
            res.status(statusCode).json({
                success: false,
                message: message || 'حدث خطأ في جلب المحادثة'
            });
        }
    }
    
    // ============================================================
    // GET MESSAGES
    // GET /api/chats/:chatId/messages
    // Permission: Buyer or Seller of the chat
    // ============================================================
    
    /**
     * Get messages for a chat.
     * 
     * @route GET /api/chats/:chatId/messages
     * @query limit - Max messages to return (default: 100)
     * @query before - Get messages before this timestamp (ISO string)
     * @access Private (Buyer/Seller)
     */
    async getMessages(req, res) {
        try {
            const { chatId } = req.params;
            const { limit, before } = req.query;
            
            // Validate chatId format
            if (!chatId || chatId.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: 'معرّف المحادثة غير صالح'
                });
            }
            
            // Parse limit
            let parsedLimit = 100;
            if (limit) {
                parsedLimit = parseInt(limit, 10);
                if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 200) {
                    return res.status(400).json({
                        success: false,
                        message: 'الحد الأقصى يجب أن يكون بين 1 و 200'
                    });
                }
            }
            
            // Parse before date
            let beforeDate = null;
            if (before) {
                beforeDate = new Date(before);
                if (isNaN(beforeDate.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: 'تاريخ غير صالح'
                    });
                }
            }
            
            // Call ChatService - it validates access
            const messages = await ChatService.getMessages(chatId, req.user._id, {
                limit: parsedLimit,
                before: beforeDate
            });
            
            res.status(200).json({
                success: true,
                count: messages.length,
                messages
            });
            
        } catch (error) {
            console.error('Get messages error:', error);
            
            const message = error.message;
            let statusCode = 400;
            
            if (message.includes('صلاحية')) {
                statusCode = 403;
            } else if (message.includes('غير موجود')) {
                statusCode = 404;
            }
            
            res.status(statusCode).json({
                success: false,
                message: message || 'حدث خطأ في جلب الرسائل'
            });
        }
    }
    
    // ============================================================
    // SEND MESSAGE
    // POST /api/chats/:chatId/messages
    // Permission: Buyer or Seller of the chat
    // ============================================================
    
    /**
     * Send a message in a chat.
     * 
     * @route POST /api/chats/:chatId/messages
     * @body content - Message text content
     * @access Private (Buyer/Seller)
     */
    async sendMessage(req, res) {
        try {
            const { chatId } = req.params;
            const { content } = req.body;
            
            // Validate chatId format
            if (!chatId || chatId.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: 'معرّف المحادثة غير صالح'
                });
            }
            
            // Validate content is provided
            if (!content) {
                return res.status(400).json({
                    success: false,
                    message: 'محتوى الرسالة مطلوب'
                });
            }
            
            // Validate content is string
            if (typeof content !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'محتوى الرسالة يجب أن يكون نصاً'
                });
            }
            
            // Call ChatService - it validates access and order status
            const message = await ChatService.sendMessage(chatId, req.user._id, content);
            
            res.status(201).json({
                success: true,
                message: 'تم إرسال الرسالة',
                data: message
            });
            
        } catch (error) {
            console.error('Send message error:', error);
            
            const errorMessage = error.message;
            let statusCode = 400;
            
            if (errorMessage.includes('صلاحية')) {
                statusCode = 403;
            } else if (errorMessage.includes('غير موجود')) {
                statusCode = 404;
            } else if (errorMessage.includes('للقراءة فقط') || errorMessage.includes('لا يمكن إرسال')) {
                statusCode = 403;
            }
            
            res.status(statusCode).json({
                success: false,
                message: errorMessage || 'حدث خطأ في إرسال الرسالة'
            });
        }
    }
    
    // ============================================================
    // GET USER'S CHATS
    // GET /api/chats
    // Permission: Authenticated user
    // ============================================================
    
    /**
     * Get all chats for the authenticated user.
     * 
     * @route GET /api/chats
     * @query limit - Max chats to return (default: 50)
     * @access Private
     */
    async getMyChats(req, res) {
        try {
            const { limit } = req.query;
            
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
            
            // Call ChatService
            const chats = await ChatService.getChatsForUser(req.user._id, {
                limit: parsedLimit
            });
            
            res.status(200).json({
                success: true,
                count: chats.length,
                chats
            });
            
        } catch (error) {
            console.error('Get my chats error:', error);
            
            res.status(500).json({
                success: false,
                message: 'حدث خطأ في جلب المحادثات'
            });
        }
    }
}

// Export singleton instance
module.exports = new ChatController();
