/* ========================================
   Mashriq (مشرق) - Order Model
   ========================================
   
   PURPOSE:
   The CORE TRANSACTIONAL ENTITY of the platform.
   Represents a purchase of a service by a buyer from a seller.
   Contains a SNAPSHOT of the service at creation time and
   tracks the ORDER STATE MACHINE.
   Orders are IMMUTABLE after creation (except for state transitions and timestamps).
   
   CONSTITUTION RULES:
   - Orders follow a STRICT state machine:
     ACTIVE → DELIVERED → COMPLETED
     OR → CANCELLED
   - Orders are immutable after creation (except state and timestamps)
   - Disputes can ONLY be opened in DELIVERED state
   - Buyer inactivity after delivery → AUTO-COMPLETE
   - Seller inactivity → AUTO-CANCEL + REFUND
   - Service data is SNAPSHOTTED at order creation
   
   ORDER STATE MACHINE:
   ┌────────┐    ┌───────────┐    ┌───────────┐
   │ ACTIVE │───▶│ DELIVERED │───▶│ COMPLETED │
   └────────┘    └───────────┘    └───────────┘
        │              │
        ▼              ▼
   ┌───────────┐  (dispute)
   │ CANCELLED │◀──────────
   └───────────┘
   
   IMMUTABLE FIELDS (after creation):
   - id, buyerId, sellerId, serviceId
   - All snapshot fields
   - selectedExtras
   - totalPrice, totalDeliveryDays
   - escrowAmount, platformFee, sellerPayout
   - createdAt
   
   WRITE PERMISSIONS:
   - OrderService: status, timestamps, cancelReason, cancelledBy
   - EscrowService: escrowStatus only
   - DisputeService: status (via OrderService call)
   
   READ PERMISSIONS:
   - OrderService: All fields
   - EscrowService: escrow-related fields
   - DisputeService: All fields
   - ChatService: id, status (to check read-only state)
   - TrustService: status, sellerId, buyerId, timestamps
   - ReviewService: id, status, buyerId, sellerId
   
   CRITICAL INVARIANTS:
   1. status can only transition according to the state machine
   2. Once status is COMPLETED or CANCELLED, no further transitions allowed
   3. escrowStatus must match status:
      - ACTIVE or DELIVERED → HELD
      - COMPLETED → RELEASED
      - CANCELLED → REFUNDED
   4. totalPrice = snapshotBasePrice + sum of selectedExtras[].price
   5. sellerPayout = escrowAmount - platformFee
   6. buyerId cannot equal sellerId (no self-orders)
   7. All snapshot fields are copied from Service at creation and never change
   8. autoCompleteAt is set when status becomes DELIVERED
   
   ======================================== */

const mongoose = require('mongoose');

// ============================================================
// ORDER STATUSES
// Strict state machine as defined in constitution.
// ============================================================
const ORDER_STATUSES = {
    ACTIVE: 'active',         // Order placed, seller is working
    DELIVERED: 'delivered',   // Seller marked as delivered, awaiting buyer action
    COMPLETED: 'completed',   // Buyer accepted OR auto-complete, seller gets paid
    CANCELLED: 'cancelled'    // Order cancelled, buyer gets refund
};

// ============================================================
// ESCROW STATUSES
// Tracks the state of funds in escrow.
// ============================================================
const ESCROW_STATUSES = {
    HELD: 'held',           // Funds held by platform
    RELEASED: 'released',   // Funds released to seller
    REFUNDED: 'refunded'    // Funds refunded to buyer
};

// ============================================================
// CANCELLATION ACTORS
// Who initiated the cancellation.
// ============================================================
const CANCELLED_BY = {
    BUYER: 'buyer',
    SELLER: 'seller',
    SYSTEM: 'system',   // Auto-cancel due to inactivity
    ADMIN: 'admin'
};

// ============================================================
// SELECTED EXTRAS SUB-SCHEMA
// Snapshot copy of extras selected by buyer at order time.
// ============================================================
const selectedExtraSchema = new mongoose.Schema({
    /**
     * Original extra ID (for reference to service).
     * IMMUTABLE.
     */
    extraId: {
        type: mongoose.Schema.Types.ObjectId,
        immutable: true
    },
    
    /**
     * Extra name at order time.
     * IMMUTABLE - snapshot.
     */
    name: {
        type: String,
        required: true,
        immutable: true
    },
    
    /**
     * Extra price at order time.
     * IMMUTABLE - snapshot.
     */
    price: {
        type: Number,
        required: true,
        immutable: true
    },
    
    /**
     * Additional days at order time.
     * IMMUTABLE - snapshot.
     */
    additionalDays: {
        type: Number,
        default: 0,
        immutable: true
    }
}, { _id: false });

// ============================================================
// ORDER SCHEMA
// ============================================================
const orderSchema = new mongoose.Schema({
    
    // ============================================================
    // PARTIES
    // ============================================================
    
    /**
     * Reference to the buyer User.
     * IMMUTABLE - parties cannot change.
     */
    buyerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'الطلب يجب أن يكون مرتبطاً بمشتري'],
        immutable: true
    },
    
    /**
     * Reference to the seller User.
     * IMMUTABLE - parties cannot change.
     */
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'الطلب يجب أن يكون مرتبطاً ببائع'],
        immutable: true
    },
    
    /**
     * Reference to the original Service (for linking).
     * IMMUTABLE.
     */
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: [true, 'الطلب يجب أن يكون مرتبطاً بخدمة'],
        immutable: true
    },
    
    // ============================================================
    // SERVICE SNAPSHOT
    // Frozen copy of service data at order creation time.
    // Constitution: Service data is SNAPSHOTTED at order creation.
    // ============================================================
    
    /**
     * Service title at order time.
     * IMMUTABLE - snapshot.
     */
    snapshotTitle: {
        type: String,
        required: true,
        immutable: true
    },
    
    /**
     * Service description at order time.
     * IMMUTABLE - snapshot.
     */
    snapshotDescription: {
        type: String,
        required: true,
        immutable: true
    },
    
    /**
     * Base price at order time.
     * IMMUTABLE - snapshot.
     */
    snapshotBasePrice: {
        type: Number,
        required: true,
        immutable: true
    },
    
    /**
     * Promised delivery days at order time.
     * IMMUTABLE - snapshot.
     */
    snapshotDeliveryDays: {
        type: Number,
        required: true,
        immutable: true
    },
    
    /**
     * Array of extras selected by buyer.
     * Each is a snapshot copy of the extra at order time.
     * IMMUTABLE.
     */
    selectedExtras: {
        type: [selectedExtraSchema],
        default: [],
        immutable: true
    },
    
    // ============================================================
    // COMPUTED TOTALS
    // Calculated at creation and frozen.
    // ============================================================
    
    /**
     * Total price = snapshotBasePrice + sum of selectedExtras[].price
     * IMMUTABLE - frozen at creation.
     */
    totalPrice: {
        type: Number,
        required: true,
        immutable: true
    },
    
    /**
     * Total delivery days = snapshotDeliveryDays + sum of selectedExtras[].additionalDays
     * IMMUTABLE - frozen at creation.
     */
    totalDeliveryDays: {
        type: Number,
        required: true,
        immutable: true
    },
    
    // ============================================================
    // ORDER STATE
    // ============================================================
    
    /**
     * Current order state.
     * ACTIVE → DELIVERED → COMPLETED or → CANCELLED
     */
    status: {
        type: String,
        required: true,
        enum: {
            values: Object.values(ORDER_STATUSES),
            message: 'حالة الطلب غير صالحة'
        },
        default: ORDER_STATUSES.ACTIVE
    },
    
    /**
     * Reason for cancellation (if cancelled).
     */
    cancelReason: {
        type: String,
        default: null,
        maxlength: [1000, 'سبب الإلغاء يجب أن يكون أقل من 1000 حرف']
    },
    
    /**
     * Who cancelled the order.
     * BUYER, SELLER, SYSTEM, or ADMIN.
     */
    cancelledBy: {
        type: String,
        enum: {
            values: [...Object.values(CANCELLED_BY), null],
            message: 'مُلغي الطلب غير صالح'
        },
        default: null
    },
    
    // ============================================================
    // ESCROW FIELDS
    // Financial state tracking.
    // ============================================================
    
    /**
     * Current escrow state.
     * Must match order status.
     */
    escrowStatus: {
        type: String,
        required: true,
        enum: {
            values: Object.values(ESCROW_STATUSES),
            message: 'حالة الضمان غير صالحة'
        },
        default: ESCROW_STATUSES.HELD
    },
    
    /**
     * Amount held in escrow (= totalPrice).
     * IMMUTABLE - frozen at creation.
     */
    escrowAmount: {
        type: Number,
        required: true,
        immutable: true
    },
    
    /**
     * Platform commission amount.
     * IMMUTABLE - calculated at creation.
     */
    platformFee: {
        type: Number,
        required: true,
        immutable: true
    },
    
    /**
     * Amount to be paid to seller (escrowAmount - platformFee).
     * IMMUTABLE - calculated at creation.
     */
    sellerPayout: {
        type: Number,
        required: true,
        immutable: true
    },
    
    // ============================================================
    // TIMESTAMPS
    // ============================================================
    
    /**
     * Order creation timestamp.
     * IMMUTABLE - set once at creation.
     */
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },
    
    /**
     * When seller marked as delivered.
     * Set when status becomes DELIVERED.
     */
    deliveredAt: {
        type: Date,
        default: null
    },
    
    /**
     * When order was completed.
     * Set when status becomes COMPLETED.
     */
    completedAt: {
        type: Date,
        default: null
    },
    
    /**
     * When order was cancelled.
     * Set when status becomes CANCELLED.
     */
    cancelledAt: {
        type: Date,
        default: null
    },
    
    /**
     * Calculated deadline.
     * createdAt + totalDeliveryDays.
     * Used for seller inactivity tracking.
     */
    deadlineAt: {
        type: Date,
        required: true,
        immutable: true
    },
    
    /**
     * When auto-complete will trigger.
     * Set when status becomes DELIVERED.
     * Cleared if dispute is opened.
     */
    autoCompleteAt: {
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

// Buyer's orders
orderSchema.index({ buyerId: 1, createdAt: -1 });

// Seller's orders
orderSchema.index({ sellerId: 1, createdAt: -1 });

// Service's orders
orderSchema.index({ serviceId: 1 });

// Order status (for filtering)
orderSchema.index({ status: 1 });

// Active orders (for auto-cancel/auto-complete jobs)
orderSchema.index({ status: 1, deadlineAt: 1 });

// Pending auto-complete
orderSchema.index({ status: 1, autoCompleteAt: 1 });

// Chronological listing
orderSchema.index({ createdAt: -1 });

// ============================================================
// VIRTUALS
// Computed properties from relationships.
// ============================================================

/**
 * Virtual: Buyer's profile.
 * Populated from User model when needed.
 */
orderSchema.virtual('buyer', {
    ref: 'User',
    localField: 'buyerId',
    foreignField: '_id',
    justOne: true
});

/**
 * Virtual: Seller's profile.
 * Populated from User model when needed.
 */
orderSchema.virtual('seller', {
    ref: 'User',
    localField: 'sellerId',
    foreignField: '_id',
    justOne: true
});

/**
 * Virtual: Original service (for reference).
 * Populated from Service model when needed.
 */
orderSchema.virtual('service', {
    ref: 'Service',
    localField: 'serviceId',
    foreignField: '_id',
    justOne: true
});

/**
 * Virtual: Chat for this order.
 * Populated from Chat model when needed.
 */
orderSchema.virtual('chat', {
    ref: 'Chat',
    localField: '_id',
    foreignField: 'orderId',
    justOne: true
});

/**
 * Virtual: Dispute for this order (if any).
 * Populated from Dispute model when needed.
 */
orderSchema.virtual('dispute', {
    ref: 'Dispute',
    localField: '_id',
    foreignField: 'orderId',
    justOne: true
});

/**
 * Virtual: Review for this order (if any).
 * Populated from Review model when needed.
 */
orderSchema.virtual('review', {
    ref: 'Review',
    localField: '_id',
    foreignField: 'orderId',
    justOne: true
});

// ============================================================
// CRITICAL INVARIANTS (Documented for reference)
// These are NOT enforced by the model - they are enforced by SERVICES.
// ============================================================
/*
 * 1. status can only transition according to the state machine:
 *    - ACTIVE → DELIVERED (seller action)
 *    - ACTIVE → CANCELLED (inactivity, mutual, admin)
 *    - DELIVERED → COMPLETED (buyer accepts, auto-complete)
 *    - DELIVERED → CANCELLED (dispute resolution: buyer wins)
 * 2. Once status is COMPLETED or CANCELLED, no further transitions allowed
 * 3. escrowStatus must match status:
 *    - ACTIVE or DELIVERED → HELD
 *    - COMPLETED → RELEASED
 *    - CANCELLED → REFUNDED
 * 4. totalPrice = snapshotBasePrice + sum of selectedExtras[].price
 * 5. sellerPayout = escrowAmount - platformFee
 * 6. buyerId cannot equal sellerId (no self-orders)
 * 7. All snapshot fields are copied from Service at creation and never change
 * 8. autoCompleteAt is set when status becomes DELIVERED
 */

// ============================================================
// EXPORT
// ============================================================

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
module.exports.ORDER_STATUSES = ORDER_STATUSES;
module.exports.ESCROW_STATUSES = ESCROW_STATUSES;
module.exports.CANCELLED_BY = CANCELLED_BY;
