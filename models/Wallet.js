/* ========================================
   Mashriq (مشرق) - Wallet Model
   ========================================
   
   PURPOSE:
   Represents a user's financial account on the platform.
   Tracks available balance (withdrawable funds) and pending balance
   (funds held in escrow for active orders).
   Every user has EXACTLY ONE wallet (1:1 relationship).
   
   CONSTITUTION RULES:
   - Buyer pays the platform (not the seller directly)
   - Platform holds all funds in escrow
   - Funds are released ONLY on order COMPLETED
   - Funds are refunded on CANCELLED or dispute resolution
   - Platform takes a fixed commission (hidden from users)
   
   IMMUTABLE FIELDS (after creation):
   - id (primary identifier)
   - userId (wallet belongs to one user forever)
   - createdAt (audit trail)
   
   WRITE PERMISSIONS:
   - EscrowService: All balance fields
   - WithdrawalService: availableBalance (deduct on withdrawal)
   
   READ PERMISSIONS:
   - EscrowService: All fields
   - WalletService: All fields
   - OrderService: pendingBalance (to validate buyer can pay)
   
   CRITICAL INVARIANTS:
   1. availableBalance can NEVER be negative
   2. pendingBalance can NEVER be negative
   3. Only EscrowService can modify balances (except withdrawals)
   4. Every balance change MUST have a corresponding Transaction record
   5. userId is UNIQUE (one wallet per user)
   6. Wallet is created automatically when User is created
   
   ======================================== */

const mongoose = require('mongoose');

// ============================================================
// WALLET SCHEMA
// ============================================================
const walletSchema = new mongoose.Schema({
    
    // ============================================================
    // OWNERSHIP
    // ============================================================
    
    /**
     * Reference to the owning User.
     * IMMUTABLE - wallet belongs to one user forever.
     * UNIQUE - each user has exactly one wallet.
     */
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'المحفظة يجب أن تكون مرتبطة بمستخدم'],
        unique: true,
        immutable: true
    },
    
    // ============================================================
    // BALANCE FIELDS
    // ============================================================
    
    /**
     * Funds available for withdrawal.
     * This is money the user (as seller) has earned from completed orders.
     * Can NEVER be negative.
     */
    availableBalance: {
        type: Number,
        default: 0,
        min: [0, 'الرصيد المتاح لا يمكن أن يكون سالباً']
    },
    
    /**
     * Funds held in escrow.
     * For buyers: money locked in active orders (not yet completed).
     * For sellers: pending payouts awaiting completion.
     * Can NEVER be negative.
     */
    pendingBalance: {
        type: Number,
        default: 0,
        min: [0, 'الرصيد المعلق لا يمكن أن يكون سالباً']
    },
    
    // ============================================================
    // LIFETIME STATISTICS
    // For analytics and user dashboards.
    // ============================================================
    
    /**
     * Lifetime earnings as seller.
     * Total money received from completed orders (after commission).
     * Only increases, never decreases.
     */
    totalEarned: {
        type: Number,
        default: 0,
        min: [0, 'إجمالي الأرباح لا يمكن أن يكون سالباً']
    },
    
    /**
     * Lifetime spending as buyer.
     * Total money spent on completed orders.
     * Only increases, never decreases.
     */
    totalSpent: {
        type: Number,
        default: 0,
        min: [0, 'إجمالي الإنفاق لا يمكن أن يكون سالباً']
    },
    
    // ============================================================
    // TIMESTAMPS
    // ============================================================
    
    /**
     * Wallet creation timestamp.
     * IMMUTABLE - set once at creation.
     * Should match user creation time.
     */
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },
    
    /**
     * Last balance update timestamp.
     * Updated on any balance modification.
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
// Optimize database queries.
// ============================================================

// Unique user lookup (primary access pattern)
walletSchema.index({ userId: 1 }, { unique: true });

// ============================================================
// VIRTUALS
// Computed properties from relationships.
// ============================================================

/**
 * Virtual: Owner's profile.
 * Populated from User model when needed.
 */
walletSchema.virtual('user', {
    ref: 'User',
    localField: 'userId',
    foreignField: '_id',
    justOne: true
});

/**
 * Virtual: Transaction history.
 * Populated from Transaction model when needed.
 */
walletSchema.virtual('transactions', {
    ref: 'Transaction',
    localField: '_id',
    foreignField: 'walletId',
    justOne: false
});

// ============================================================
// CRITICAL INVARIANTS (Documented for reference)
// These are NOT enforced by the model - they are enforced by SERVICES.
// ============================================================
/*
 * 1. availableBalance can NEVER be negative
 * 2. pendingBalance can NEVER be negative
 * 3. Only EscrowService can modify balances (except withdrawals)
 * 4. Every balance change MUST have a corresponding Transaction record
 * 5. userId is UNIQUE (one wallet per user)
 * 6. Wallet is created automatically when User is created
 */

// ============================================================
// EXPORT
// ============================================================

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;
