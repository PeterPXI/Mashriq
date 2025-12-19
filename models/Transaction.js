/* ========================================
   Mashriq (مشرق) - Transaction Model
   ========================================
   
   PURPOSE:
   An IMMUTABLE audit log of all financial movements on the platform.
   Every escrow hold, release, refund, and withdrawal creates a Transaction record.
   This model satisfies the constitution requirement that
   "escrow records must be auditable and immutable."
   
   CONSTITUTION RULES:
   - Transactions are APPEND-ONLY (no updates, no deletes)
   - Every Wallet balance change MUST have a corresponding Transaction
   - Records provide complete audit trail for all money movements
   
   IMMUTABLE FIELDS:
   - ALL FIELDS ARE IMMUTABLE
   - Transactions are NEVER modified or deleted
   
   WRITE PERMISSIONS:
   - EscrowService: Create only (ESCROW_HOLD, ESCROW_RELEASE, ESCROW_REFUND, PLATFORM_FEE)
   - WithdrawalService: Create only (WITHDRAWAL)
   - DepositService: Create only (DEPOSIT)
   
   NO UPDATES OR DELETES ALLOWED BY ANY SERVICE.
   
   READ PERMISSIONS:
   - EscrowService: All fields
   - WalletService: All fields
   - AdminService: All fields
   - AuditService: All fields
   
   CRITICAL INVARIANTS:
   1. Transactions are APPEND-ONLY (no updates, no deletes)
   2. Every Wallet balance change MUST have a corresponding Transaction
   3. balanceAfter must equal previous balance ± amount (based on direction)
   4. Related orderId must exist and match the transaction context
   5. createdAt cannot be backdated
   
   ======================================== */

const mongoose = require('mongoose');

// ============================================================
// TRANSACTION TYPES
// Defines all possible transaction types in the system.
// ============================================================
const TRANSACTION_TYPES = {
    ESCROW_HOLD: 'escrow_hold',         // Buyer funds held for order
    ESCROW_RELEASE: 'escrow_release',   // Funds released to seller on completion
    ESCROW_REFUND: 'escrow_refund',     // Funds refunded to buyer on cancellation
    PLATFORM_FEE: 'platform_fee',       // Commission deducted from seller payout
    WITHDRAWAL: 'withdrawal',           // Funds withdrawn from available balance
    DEPOSIT: 'deposit'                  // Funds added to wallet (if applicable)
};

// ============================================================
// TRANSACTION DIRECTIONS
// Every transaction is either money in (credit) or money out (debit).
// ============================================================
const TRANSACTION_DIRECTIONS = {
    CREDIT: 'credit',   // Money coming IN to wallet
    DEBIT: 'debit'      // Money going OUT of wallet
};

// ============================================================
// TRANSACTION SCHEMA
// ============================================================
const transactionSchema = new mongoose.Schema({
    
    // ============================================================
    // REFERENCES
    // ============================================================
    
    /**
     * Reference to the affected Wallet.
     * Every transaction affects exactly one wallet.
     * IMMUTABLE.
     */
    walletId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet',
        required: [true, 'المعاملة يجب أن تكون مرتبطة بمحفظة'],
        immutable: true
    },
    
    /**
     * Reference to the related Order.
     * NULL for deposits and withdrawals.
     * Required for escrow transactions.
     * IMMUTABLE.
     */
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null,
        immutable: true
    },
    
    // ============================================================
    // TRANSACTION DETAILS
    // ============================================================
    
    /**
     * Type of transaction.
     * Determines the nature of the financial movement.
     * IMMUTABLE.
     */
    type: {
        type: String,
        required: [true, 'نوع المعاملة مطلوب'],
        enum: {
            values: Object.values(TRANSACTION_TYPES),
            message: 'نوع المعاملة غير صالح'
        },
        immutable: true
    },
    
    /**
     * Transaction amount.
     * ALWAYS POSITIVE - direction indicates credit/debit.
     * IMMUTABLE.
     */
    amount: {
        type: Number,
        required: [true, 'مبلغ المعاملة مطلوب'],
        min: [0, 'المبلغ لا يمكن أن يكون سالباً'],
        immutable: true
    },
    
    /**
     * Direction of money flow.
     * CREDIT = money coming into wallet
     * DEBIT = money going out of wallet
     * IMMUTABLE.
     */
    direction: {
        type: String,
        required: [true, 'اتجاه المعاملة مطلوب'],
        enum: {
            values: Object.values(TRANSACTION_DIRECTIONS),
            message: 'اتجاه المعاملة غير صالح'
        },
        immutable: true
    },
    
    /**
     * Wallet balance AFTER this transaction.
     * Used for verification and audit trail.
     * IMMUTABLE.
     */
    balanceAfter: {
        type: Number,
        required: [true, 'الرصيد بعد المعاملة مطلوب'],
        immutable: true
    },
    
    /**
     * Human-readable description of the transaction.
     * For display in transaction history.
     * IMMUTABLE.
     */
    description: {
        type: String,
        default: '',
        maxlength: [500, 'الوصف يجب أن يكون أقل من 500 حرف'],
        immutable: true
    },
    
    // ============================================================
    // TIMESTAMP
    // ============================================================
    
    /**
     * Transaction timestamp.
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

// Wallet's transaction history (most common query)
transactionSchema.index({ walletId: 1, createdAt: -1 });

// Order's related transactions
transactionSchema.index({ orderId: 1 });

// Transaction type filtering
transactionSchema.index({ type: 1 });

// Chronological audit trail
transactionSchema.index({ createdAt: -1 });

// ============================================================
// VIRTUALS
// Computed properties from relationships.
// ============================================================

/**
 * Virtual: Related wallet.
 * Populated from Wallet model when needed.
 */
transactionSchema.virtual('wallet', {
    ref: 'Wallet',
    localField: 'walletId',
    foreignField: '_id',
    justOne: true
});

/**
 * Virtual: Related order.
 * Populated from Order model when needed.
 */
transactionSchema.virtual('order', {
    ref: 'Order',
    localField: 'orderId',
    foreignField: '_id',
    justOne: true
});

// ============================================================
// CRITICAL INVARIANTS (Documented for reference)
// These are NOT enforced by the model - they are enforced by SERVICES.
// ============================================================
/*
 * 1. Transactions are APPEND-ONLY (no updates, no deletes)
 * 2. Every Wallet balance change MUST have a corresponding Transaction
 * 3. balanceAfter must equal previous balance ± amount (based on direction)
 * 4. Related orderId must exist and match the transaction context
 * 5. createdAt cannot be backdated
 * 6. amount is always positive; direction indicates credit/debit
 */

// ============================================================
// EXPORT
// ============================================================

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
module.exports.TRANSACTION_TYPES = TRANSACTION_TYPES;
module.exports.TRANSACTION_DIRECTIONS = TRANSACTION_DIRECTIONS;
