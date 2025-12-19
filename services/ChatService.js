/* ========================================
   Mashriq (مشرق) - Chat Service
   ========================================
   
   PURPOSE:
   Provides business logic for chat operations.
   Handles message sending, retrieval, and access control.
   
   CONSTITUTION RULES ENFORCED:
   - Chat exists ONLY if an order exists
   - Only buyer and seller can access the chat
   - Messages allowed ONLY while order is ACTIVE or DELIVERED
   - Chat becomes read-only after order COMPLETED or CANCELLED
   - No admin participation in chat
   - No file uploads (text only)
   - Messages are immutable (cannot be edited/deleted)
   
   INTEGRATIONS:
   - OrderService: For order status checks (read-only)
   - Chat Model: For chat access
   - Message Model: For message storage
   
   SECURITY:
   - Validate user is buyer or seller before any operation
   - Validate order status before sending messages
   - No trust exposure
   - No money handling
   
   ======================================== */

// Models
const Chat = require('../models/Chat');
const Message = require('../models/Message');

// Services
const OrderService = require('./OrderService');
const { ORDER_STATUSES } = require('../models/Order');

/**
 * ChatService
 * 
 * Business logic layer for chat operations.
 * All chat/message operations MUST go through this service.
 */
class ChatService {
    
    // ============================================================
    // GET CHAT FOR ORDER
    // ============================================================
    
    /**
     * Get the chat for an order.
     * 
     * Business Rules Enforced:
     * 1. Order must exist
     * 2. User must be buyer or seller of the order
     * 3. Chat must exist (created with order)
     * 
     * @param {string} orderId - ID of the order
     * @param {string} userId - ID of the user requesting access
     * @returns {Promise<Object>} Chat object
     * @throws {Error} If validation fails or access denied
     */
    async getChatForOrder(orderId, userId) {
        // ============================================================
        // STEP 1: Validate orderId
        // ============================================================
        if (!orderId) {
            throw new Error('رقم الطلب مطلوب');
        }
        
        // ============================================================
        // STEP 2: Get order and validate existence
        // ============================================================
        const order = await OrderService.getOrderById(orderId);
        
        if (!order) {
            throw new Error('الطلب غير موجود');
        }
        
        // ============================================================
        // STEP 3: Validate user is buyer or seller
        // Constitution: Only buyer and seller can access chat
        // ============================================================
        const userIdStr = userId.toString();
        const isBuyer = order.buyerId.toString() === userIdStr;
        const isSeller = order.sellerId.toString() === userIdStr;
        
        if (!isBuyer && !isSeller) {
            throw new Error('ليس لديك صلاحية للوصول لهذه المحادثة');
        }
        
        // ============================================================
        // STEP 4: Get chat
        // Chat should exist (created with order)
        // ============================================================
        const chat = await Chat.findOne({ orderId });
        
        if (!chat) {
            throw new Error('المحادثة غير موجودة');
        }
        
        return chat;
    }
    
    // ============================================================
    // GET CHAT BY ID
    // ============================================================
    
    /**
     * Get chat by its ID.
     * 
     * @param {string} chatId - Chat ID
     * @param {string} userId - ID of the user requesting access
     * @returns {Promise<Object>} Chat object
     * @throws {Error} If validation fails or access denied
     */
    async getChatById(chatId, userId) {
        // ============================================================
        // STEP 1: Validate chatId
        // ============================================================
        if (!chatId) {
            throw new Error('معرّف المحادثة مطلوب');
        }
        
        // ============================================================
        // STEP 2: Get chat
        // ============================================================
        const chat = await Chat.findById(chatId);
        
        if (!chat) {
            throw new Error('المحادثة غير موجودة');
        }
        
        // ============================================================
        // STEP 3: Validate user is buyer or seller
        // Constitution: Only buyer and seller can access chat
        // ============================================================
        const userIdStr = userId.toString();
        const isBuyer = chat.buyerId.toString() === userIdStr;
        const isSeller = chat.sellerId.toString() === userIdStr;
        
        if (!isBuyer && !isSeller) {
            throw new Error('ليس لديك صلاحية للوصول لهذه المحادثة');
        }
        
        return chat;
    }
    
    // ============================================================
    // GET MESSAGES
    // ============================================================
    
    /**
     * Get messages for a chat.
     * 
     * Business Rules Enforced:
     * 1. User must have access to the chat
     * 2. Messages returned in chronological order
     * 
     * @param {string} chatId - Chat ID
     * @param {string} userId - ID of the user requesting
     * @param {Object} options - Query options
     * @param {number} options.limit - Max messages to return (default: 100)
     * @param {Date} options.before - Get messages before this date
     * @returns {Promise<Array>} Array of messages
     * @throws {Error} If validation fails
     */
    async getMessages(chatId, userId, { limit = 100, before = null } = {}) {
        // ============================================================
        // STEP 1: Validate access to chat
        // This also validates chatId and user permissions
        // ============================================================
        await this.getChatById(chatId, userId);
        
        // ============================================================
        // STEP 2: Build query
        // ============================================================
        const query = { chatId };
        
        if (before) {
            query.createdAt = { $lt: before };
        }
        
        // ============================================================
        // STEP 3: Get messages
        // ============================================================
        const messages = await Message.find(query)
            .sort({ createdAt: 1 })  // Oldest first (chronological)
            .limit(Math.min(limit, 200));  // Cap at 200
        
        return messages;
    }
    
    // ============================================================
    // SEND MESSAGE
    // ============================================================
    
    /**
     * Send a message in a chat.
     * 
     * Business Rules Enforced:
     * 1. User must be buyer or seller
     * 2. Order must be in ACTIVE or DELIVERED status
     * 3. Chat must not be read-only
     * 4. Message content cannot be empty
     * 
     * @param {string} chatId - Chat ID
     * @param {string} senderId - ID of the sender
     * @param {string} content - Message content
     * @returns {Promise<Object>} Created message
     * @throws {Error} If validation fails
     */
    async sendMessage(chatId, senderId, content) {
        // ============================================================
        // STEP 1: Validate content
        // ============================================================
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            throw new Error('محتوى الرسالة مطلوب');
        }
        
        const trimmedContent = content.trim();
        
        if (trimmedContent.length > 5000) {
            throw new Error('الرسالة يجب أن تكون أقل من 5000 حرف');
        }
        
        // ============================================================
        // STEP 2: Get chat and validate access
        // ============================================================
        const chat = await this.getChatById(chatId, senderId);
        
        // ============================================================
        // STEP 3: Check if chat is read-only
        // Constitution: No messages after order closure
        // ============================================================
        if (chat.isReadOnly) {
            throw new Error('هذه المحادثة للقراءة فقط');
        }
        
        // ============================================================
        // STEP 4: Get order and validate status
        // Constitution: Messages allowed ONLY in ACTIVE or DELIVERED
        // ============================================================
        const order = await OrderService.getOrderById(chat.orderId);
        
        if (!order) {
            throw new Error('الطلب المرتبط بالمحادثة غير موجود');
        }
        
        const allowedStatuses = [ORDER_STATUSES.ACTIVE, ORDER_STATUSES.DELIVERED];
        
        if (!allowedStatuses.includes(order.status)) {
            throw new Error('لا يمكن إرسال رسائل في هذه المرحلة من الطلب');
        }
        
        // ============================================================
        // STEP 5: Create message
        // Constitution: Messages are immutable
        // ============================================================
        const message = await Message.create({
            chatId: chat._id,
            senderId,
            content: trimmedContent,
            isSystemMessage: false
        });
        
        // ============================================================
        // STEP 6: Update chat timestamp
        // ============================================================
        chat.updatedAt = new Date();
        await chat.save();
        
        console.log(`💬 Message sent in chat ${chatId} by ${senderId}`);
        
        return message;
    }
    
    // ============================================================
    // GET USER'S CHATS
    // ============================================================
    
    /**
     * Get all chats for a user (as buyer or seller).
     * 
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @param {number} options.limit - Max chats to return (default: 50)
     * @returns {Promise<Array>} Array of chats
     */
    async getChatsForUser(userId, { limit = 50 } = {}) {
        if (!userId) {
            throw new Error('معرّف المستخدم مطلوب');
        }
        
        const chats = await Chat.find({
            $or: [
                { buyerId: userId },
                { sellerId: userId }
            ]
        })
        .sort({ updatedAt: -1 })  // Most recent first
        .limit(Math.min(limit, 100));  // Cap at 100
        
        return chats;
    }
    
    // ============================================================
    // CHECK CHAT ACCESS (UTILITY)
    // ============================================================
    
    /**
     * Check if a user has access to a chat.
     * Returns true/false without throwing.
     * 
     * @param {string} chatId - Chat ID
     * @param {string} userId - User ID
     * @returns {Promise<boolean>} True if user has access
     */
    async hasAccess(chatId, userId) {
        try {
            await this.getChatById(chatId, userId);
            return true;
        } catch {
            return false;
        }
    }
    
    // ============================================================
    // CHECK IF CHAT CAN RECEIVE MESSAGES (UTILITY)
    // ============================================================
    
    /**
     * Check if a chat can receive new messages.
     * 
     * @param {string} chatId - Chat ID
     * @returns {Promise<boolean>} True if messages can be sent
     */
    async canSendMessages(chatId) {
        try {
            const chat = await Chat.findById(chatId);
            
            if (!chat || chat.isReadOnly) {
                return false;
            }
            
            const order = await OrderService.getOrderById(chat.orderId);
            
            if (!order) {
                return false;
            }
            
            const allowedStatuses = [ORDER_STATUSES.ACTIVE, ORDER_STATUSES.DELIVERED];
            return allowedStatuses.includes(order.status);
            
        } catch {
            return false;
        }
    }
}

// Export singleton instance
module.exports = new ChatService();
