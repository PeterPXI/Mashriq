/* ========================================
   Mashriq (مشرق) - Dispute Model
   ========================================
   
   PURPOSE:
   Represents a conflict opened by a buyer on a DELIVERED order.
   Tracks the dispute lifecycle, evidence, and resolution.
   A dispute FREEZES the order's auto-complete timer and
   requires platform intervention.
   
   CONSTITUTION RULES:
   - Disputes can ONLY be opened in DELIVERED state
   - A dispute FREEZES the order (no auto-complete while disputed)
   - Resolution outcomes:
     - BUYER_WINS: Order is cancelled, funds refunded
     - SELLER_WINS: Order is completed, funds released
     - SPLIT: Platform decides allocation
   
   IMMUTABLE FIELDS (after creation):
   - id (primary identifier)
   - orderId (dispute is tied to one order forever)
   - openedById (cannot change who opened)
   - reason (original reason preserved)
   - description (original description preserved)
   - createdAt (audit trail)
   
   WRITE PERMISSIONS:
   - DisputeService: All fields
   - AdminService: resolution, resolutionNotes, resolvedById, resolvedAt, status
   
   READ PERMISSIONS:
   - DisputeService: All fields
   - OrderService: id, status, resolution (to handle state changes)
   - TrustService: orderId, resolution (to update trust metrics)
   - ChatService: id, orderId (to provide evidence from chat)
   
   CRITICAL INVARIANTS:
   1. A dispute can ONLY be opened on an order in DELIVERED status
   2. Only the BUYER can open a dispute (openedById must be order's buyerId)
   3. Each order can have AT MOST ONE dispute
   4. Once status is RESOLVED, no further modifications allowed
   5. If resolution is BUYER_WINS → Order becomes CANCELLED
   6. If resolution is SELLER_WINS → Order becomes COMPLETED
   7. resolvedAt must be after createdAt
   
   ======================================== */

const mongoose = require('mongoose');

// ============================================================
// DISPUTE STATUSES
// Defines the lifecycle states of a dispute.
// ============================================================
const DISPUTE_STATUSES = {
    OPEN: 'open',                 // Dispute opened, awaiting review
    UNDER_REVIEW: 'under_review', // Admin is reviewing the case
    RESOLVED: 'resolved'          // Dispute has been resolved
};

// ============================================================
// DISPUTE RESOLUTIONS
// Possible outcomes when a dispute is resolved.
// ============================================================
const DISPUTE_RESOLUTIONS = {
    BUYER_WINS: 'buyer_wins',     // Buyer wins → Order cancelled, refund issued
    SELLER_WINS: 'seller_wins',   // Seller wins → Order completed, funds released
    SPLIT: 'split'                // Platform decides partial resolution
};

// ============================================================
// DISPUTE REASONS
// Categories for why a dispute is opened.
// ============================================================
const DISPUTE_REASONS = {
    NOT_AS_DESCRIBED: 'not_as_described',     // Delivery doesn't match service description
    INCOMPLETE_DELIVERY: 'incomplete_delivery', // Missing parts of the deliverable
    POOR_QUALITY: 'poor_quality',             // Quality below expectations
    LATE_DELIVERY: 'late_delivery',           // Delivered after deadline
    NO_RESPONSE: 'no_response',               // Seller not responding
    OTHER: 'other'                            // Other reason
};

// ============================================================
// DISPUTE SCHEMA
// ============================================================
const disputeSchema = new mongoose.Schema({
    
    // ============================================================
    // REFERENCES
    // ============================================================
    
    /**
     * Reference to the disputed Order.
     * IMMUTABLE - dispute is tied to one order forever.
     * UNIQUE - each order can have at most one dispute.
     */
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: [true, 'النزاع يجب أن يكون مرتبطاً بطلب'],
        unique: true,
        immutable: true
    },
    
    /**
     * Reference to the User who opened the dispute.
     * MUST be the order's buyer.
     * IMMUTABLE - cannot change who opened.
     */
    openedById: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'النزاع يجب أن يكون مفتوحاً من مستخدم'],
        immutable: true
    },
    
    // ============================================================
    // DISPUTE DETAILS
    // ============================================================
    
    /**
     * Reason category for the dispute.
     * IMMUTABLE - original reason preserved.
     */
    reason: {
        type: String,
        required: [true, 'سبب النزاع مطلوب'],
        enum: {
            values: Object.values(DISPUTE_REASONS),
            message: 'سبب النزاع غير صالح'
        },
        immutable: true
    },
    
    /**
     * Detailed description from buyer.
     * Explains the issue in the buyer's words.
     * IMMUTABLE - original description preserved.
     */
    description: {
        type: String,
        required: [true, 'وصف النزاع مطلوب'],
        maxlength: [2000, 'الوصف يجب أن يكون أقل من 2000 حرف'],
        immutable: true
    },
    
    // ============================================================
    // STATUS & RESOLUTION
    // ============================================================
    
    /**
     * Current dispute state.
     * OPEN → UNDER_REVIEW → RESOLVED
     */
    status: {
        type: String,
        required: true,
        enum: {
            values: Object.values(DISPUTE_STATUSES),
            message: 'حالة النزاع غير صالحة'
        },
        default: DISPUTE_STATUSES.OPEN
    },
    
    /**
     * Resolution outcome.
     * NULL while dispute is open or under review.
     * Set when dispute is resolved.
     */
    resolution: {
        type: String,
        enum: {
            values: [...Object.values(DISPUTE_RESOLUTIONS), null],
            message: 'نتيجة النزاع غير صالحة'
        },
        default: null
    },
    
    /**
     * Admin notes on the resolution.
     * Explains the reasoning behind the decision.
     */
    resolutionNotes: {
        type: String,
        default: '',
        maxlength: [2000, 'ملاحظات القرار يجب أن تكون أقل من 2000 حرف']
    },
    
    /**
     * Reference to the admin User who resolved the dispute.
     * NULL while dispute is open or under review.
     */
    resolvedById: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    
    // ============================================================
    // TIMESTAMPS
    // ============================================================
    
    /**
     * Dispute creation timestamp.
     * IMMUTABLE - set once at creation.
     */
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },
    
    /**
     * Last update timestamp.
     * Updated on any status change or modification.
     */
    updatedAt: {
        type: Date,
        default: Date.now
    },
    
    /**
     * Resolution timestamp.
     * NULL while dispute is open.
     * Set when dispute is resolved.
     * MUST be after createdAt.
     */
    resolvedAt: {
        type: Date,
        default: null
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

// Order lookup (most common - check if order has dispute)
disputeSchema.index({ orderId: 1 }, { unique: true });

// User's disputes
disputeSchema.index({ openedById: 1 });

// Status filtering (admin dashboard)
disputeSchema.index({ status: 1 });

// Chronological listing
disputeSchema.index({ createdAt: -1 });

// Open disputes (admin priority queue)
disputeSchema.index({ status: 1, createdAt: 1 });

// ============================================================
// VIRTUALS
// Computed properties from relationships.
// ============================================================

/**
 * Virtual: Related order.
 * Populated from Order model when needed.
 */
disputeSchema.virtual('order', {
    ref: 'Order',
    localField: 'orderId',
    foreignField: '_id',
    justOne: true
});

/**
 * Virtual: User who opened the dispute.
 * Populated from User model when needed.
 */
disputeSchema.virtual('openedBy', {
    ref: 'User',
    localField: 'openedById',
    foreignField: '_id',
    justOne: true
});

/**
 * Virtual: Admin who resolved the dispute.
 * Populated from User model when needed.
 */
disputeSchema.virtual('resolvedBy', {
    ref: 'User',
    localField: 'resolvedById',
    foreignField: '_id',
    justOne: true
});

// ============================================================
// CRITICAL INVARIANTS (Documented for reference)
// These are NOT enforced by the model - they are enforced by SERVICES.
// ============================================================
/*
 * 1. A dispute can ONLY be opened on an order in DELIVERED status
 * 2. Only the BUYER can open a dispute (openedById must be order's buyerId)
 * 3. Each order can have AT MOST ONE dispute
 * 4. Once status is RESOLVED, no further modifications allowed (except by audit)
 * 5. If resolution is BUYER_WINS → Order becomes CANCELLED
 * 6. If resolution is SELLER_WINS → Order becomes COMPLETED
 * 7. resolvedAt must be after createdAt
 */

// ============================================================
// EXPORT
// ============================================================

const Dispute = mongoose.model('Dispute', disputeSchema);

module.exports = Dispute;
module.exports.DISPUTE_STATUSES = DISPUTE_STATUSES;
module.exports.DISPUTE_RESOLUTIONS = DISPUTE_RESOLUTIONS;
module.exports.DISPUTE_REASONS = DISPUTE_REASONS;
