/* ========================================
   Mashriq (مشرق) - Message Model
   ========================================
   
   PURPOSE:
   Represents a single message within a Chat.
   Messages are IMMUTABLE and form the communication history
   between buyer and seller. Messages serve as evidence in disputes.
   
   CONSTITUTION RULES:
   - Messages are IMMUTABLE (cannot be edited or deleted)
   - Messages form the audit trail of buyer-seller communication
   - Messages are used as evidence in disputes
   - System messages track order events (delivery, etc.)
   
   IMMUTABLE FIELDS:
   - ALL FIELDS ARE IMMUTABLE
   - Messages cannot be edited or deleted
   
   WRITE PERMISSIONS:
   - ChatService: Create only
   - OrderService: Create only (for system messages like delivery notifications)
   
   NO UPDATES OR DELETES ALLOWED BY ANY SERVICE.
   
   READ PERMISSIONS:
   - ChatService: All fields
   - DisputeService: All fields (messages are evidence)
   
   CRITICAL INVARIANTS:
   1. Messages can ONLY be added to a chat where isReadOnly is FALSE
   2. senderId must be either chat's buyerId or sellerId (or null for system messages)
   3. Messages are NEVER deleted
   4. content cannot be empty unless attachments exist
   5. createdAt cannot be backdated
   6. System messages have isSystemMessage = true and senderId = null
   
   ======================================== */

const mongoose = require('mongoose');

// ============================================================
// MESSAGE SCHEMA
// ============================================================
const messageSchema = new mongoose.Schema({
    
    // ============================================================
    // REFERENCES
    // ============================================================
    
    /**
     * Reference to the parent Chat.
     * IMMUTABLE.
     */
    chatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat',
        required: [true, 'الرسالة يجب أن تكون في محادثة'],
        immutable: true
    },
    
    /**
     * Reference to the User who sent the message.
     * MUST be either chat's buyerId or sellerId.
     * NULL for system messages.
     * IMMUTABLE.
     */
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        immutable: true
    },
    
    // ============================================================
    // MESSAGE CONTENT
    // ============================================================
    
    /**
     * Message text content.
     * Cannot be empty unless attachments exist.
     * IMMUTABLE.
     */
    content: {
        type: String,
        default: '',
        maxlength: [5000, 'الرسالة يجب أن تكون أقل من 5000 حرف'],
        immutable: true
    },
    
    /**
     * Array of attachment URLs.
     * Can be images, files, deliverables.
     * IMMUTABLE.
     */
    attachmentUrls: {
        type: [String],
        default: [],
        immutable: true
    },
    
    // ============================================================
    // MESSAGE TYPE
    // ============================================================
    
    /**
     * Whether this is a system-generated message.
     * System messages have senderId = null.
     * Examples: "Seller delivered the order", "Buyer requested revision"
     * IMMUTABLE.
     */
    isSystemMessage: {
        type: Boolean,
        default: false,
        immutable: true
    },
    
    // ============================================================
    // TIMESTAMP
    // ============================================================
    
    /**
     * Message creation timestamp.
     * IMMUTABLE - cannot be backdated.
     * Set automatically at creation.
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

// Chat's message history (most common query)
messageSchema.index({ chatId: 1, createdAt: 1 });

// Messages from a specific sender
messageSchema.index({ senderId: 1 });

// System messages filter
messageSchema.index({ isSystemMessage: 1 });

// Recent messages
messageSchema.index({ createdAt: -1 });

// ============================================================
// VIRTUALS
// Computed properties from relationships.
// ============================================================

/**
 * Virtual: Parent chat.
 * Populated from Chat model when needed.
 */
messageSchema.virtual('chat', {
    ref: 'Chat',
    localField: 'chatId',
    foreignField: '_id',
    justOne: true
});

/**
 * Virtual: Sender's profile.
 * Populated from User model when needed.
 * NULL for system messages.
 */
messageSchema.virtual('sender', {
    ref: 'User',
    localField: 'senderId',
    foreignField: '_id',
    justOne: true
});

// ============================================================
// CRITICAL INVARIANTS (Documented for reference)
// These are NOT enforced by the model - they are enforced by SERVICES.
// ============================================================
/*
 * 1. Messages can ONLY be added to a chat where isReadOnly is FALSE
 * 2. senderId must be either chat's buyerId or sellerId (or null for system messages)
 * 3. Messages are NEVER deleted
 * 4. content cannot be empty unless attachmentUrls is not empty
 * 5. createdAt cannot be backdated
 * 6. System messages have isSystemMessage = true and senderId = null
 */

// ============================================================
// EXPORT
// ============================================================

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
