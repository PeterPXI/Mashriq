/* ========================================
   Mashriq (مشرق) - Chat Model
   ========================================
   
   PURPOSE:
   Represents the communication channel for an order.
   Every order has EXACTLY ONE chat (1:1 relationship).
   Chat is created when the order is created and becomes
   READ-ONLY when the order is closed (COMPLETED or CANCELLED).
   
   CONSTITUTION RULES:
   - Chat is ALWAYS tied to an order
   - Exactly one chat per order
   - Chat is NEVER deleted (audit trail)
   - Chat becomes read-only after order closure
   - No communication is allowed before an order exists
   - No "inquiry" or "pre-order" messaging
   
   IMMUTABLE FIELDS (after creation):
   - id (primary identifier)
   - orderId (chat is tied to one order forever)
   - buyerId (parties cannot change)
   - sellerId (parties cannot change)
   - createdAt (audit trail)
   
   WRITE PERMISSIONS:
   - ChatService: isReadOnly, updatedAt
   - OrderService: Create only (when creating order)
   
   READ PERMISSIONS:
   - ChatService: All fields
   - DisputeService: All fields (chat is evidence)
   - OrderService: id, isReadOnly
   
   CRITICAL INVARIANTS:
   1. Every order has EXACTLY ONE chat
   2. Chat is created AT THE SAME TIME as the order
   3. isReadOnly becomes true when order status is COMPLETED or CANCELLED
   4. Once isReadOnly is true, no new messages can be added
   5. Chat is NEVER deleted
   6. Only buyer and seller can participate in the chat
   
   ======================================== */

const mongoose = require('mongoose');

// ============================================================
// CHAT SCHEMA
// ============================================================
const chatSchema = new mongoose.Schema({
    
    // ============================================================
    // REFERENCES
    // ============================================================
    
    /**
     * Reference to the associated Order.
     * IMMUTABLE - chat is tied to one order forever.
     * UNIQUE - each order has exactly one chat.
     */
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: [true, 'المحادثة يجب أن تكون مرتبطة بطلب'],
        unique: true,
        immutable: true
    },
    
    /**
     * Reference to the buyer User.
     * Copied from order for quick access.
     * IMMUTABLE - parties cannot change.
     */
    buyerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'المشتري مطلوب'],
        immutable: true
    },
    
    /**
     * Reference to the seller User.
     * Copied from order for quick access.
     * IMMUTABLE - parties cannot change.
     */
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'البائع مطلوب'],
        immutable: true
    },
    
    // ============================================================
    // STATUS
    // ============================================================
    
    /**
     * Whether chat accepts new messages.
     * FALSE while order is active.
     * TRUE after order is COMPLETED or CANCELLED.
     * Once true, no new messages can be added.
     */
    isReadOnly: {
        type: Boolean,
        default: false
    },
    
    // ============================================================
    // TIMESTAMPS
    // ============================================================
    
    /**
     * Chat creation timestamp.
     * IMMUTABLE - set once at creation.
     * Should match order creation time.
     */
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },
    
    /**
     * Last message timestamp.
     * Updated when a new message is added.
     */
    updatedAt: {
        type: Date,
        default: Date.now
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

// Order lookup (most common - get chat for order)
chatSchema.index({ orderId: 1 }, { unique: true });

// User's chats as buyer
chatSchema.index({ buyerId: 1 });

// User's chats as seller
chatSchema.index({ sellerId: 1 });

// Active chats (non-read-only)
chatSchema.index({ isReadOnly: 1 });

// Recent activity
chatSchema.index({ updatedAt: -1 });

// ============================================================
// VIRTUALS
// Computed properties from relationships.
// ============================================================

/**
 * Virtual: Related order.
 * Populated from Order model when needed.
 */
chatSchema.virtual('order', {
    ref: 'Order',
    localField: 'orderId',
    foreignField: '_id',
    justOne: true
});

/**
 * Virtual: Buyer's profile.
 * Populated from User model when needed.
 */
chatSchema.virtual('buyer', {
    ref: 'User',
    localField: 'buyerId',
    foreignField: '_id',
    justOne: true
});

/**
 * Virtual: Seller's profile.
 * Populated from User model when needed.
 */
chatSchema.virtual('seller', {
    ref: 'User',
    localField: 'sellerId',
    foreignField: '_id',
    justOne: true
});

/**
 * Virtual: Messages in this chat.
 * Populated from Message model when needed.
 */
chatSchema.virtual('messages', {
    ref: 'Message',
    localField: '_id',
    foreignField: 'chatId',
    justOne: false
});

// ============================================================
// CRITICAL INVARIANTS (Documented for reference)
// These are NOT enforced by the model - they are enforced by SERVICES.
// ============================================================
/*
 * 1. Every order has EXACTLY ONE chat
 * 2. Chat is created AT THE SAME TIME as the order
 * 3. isReadOnly becomes true when order status is COMPLETED or CANCELLED
 * 4. Once isReadOnly is true, no new messages can be added
 * 5. Chat is NEVER deleted
 * 6. Only buyer and seller can participate in the chat
 */

// ============================================================
// EXPORT
// ============================================================

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;
