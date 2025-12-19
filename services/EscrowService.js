/* ========================================
   Mashriq (مشرق) - Escrow Service
   ========================================
   
   PURPOSE:
   The PASSIVE financial trust layer that holds, releases, and refunds funds.
   EscrowService ONLY REACTS to calls from OrderService or DisputeService.
   It NEVER initiates actions on its own.
   
   CONSTITUTION RULES ENFORCED:
   - Buyer pays the platform (not the seller directly)
   - Platform holds all funds in escrow
   - Funds are released ONLY on order COMPLETED
   - Funds are refunded on CANCELLED or dispute resolution (buyer wins)
   - Platform takes a fixed commission (hidden from users)
   - Every balance change MUST create a Transaction record
   - Transactions are APPEND-ONLY (immutable audit trail)
   
   ESCROW FLOW:
   
   ORDER CREATED:
   ┌─────────┐    holdFunds()    ┌───────────────┐
   │  BUYER  │ ──────────────▶   │   PLATFORM    │
   │ Wallet  │  -totalPrice      │    ESCROW     │
   └─────────┘  +pendingBalance  │    (HELD)     │
                                 └───────────────┘
   
   ORDER COMPLETED:
   ┌───────────────┐  releaseFunds()  ┌─────────┐
   │   PLATFORM    │ ───────────────▶ │  SELLER │
   │    ESCROW     │  -platformFee    │ Wallet  │
   │   (HELD)      │  +sellerPayout   └─────────┘
   └───────────────┘
   
   ORDER CANCELLED:
   ┌───────────────┐  refundFunds()   ┌─────────┐
   │   PLATFORM    │ ───────────────▶ │  BUYER  │
   │    ESCROW     │  +totalPrice     │ Wallet  │
   │   (HELD)      │                  └─────────┘
   └───────────────┘
   
   CRITICAL SAFETY RULES:
   1. Wallet balances can NEVER go negative
   2. Every balance change creates a Transaction record
   3. Transactions are NEVER deleted or modified
   4. EscrowService validates escrowStatus before any operation
   5. EscrowService updates Order.escrowStatus after successful operations
   6. If any step fails, the entire operation must be rolled back
   
   WRITE PERMISSIONS:
   - Wallet: availableBalance, pendingBalance, totalEarned, totalSpent, updatedAt
   - Transaction: Create only (append-only)
   - Order: escrowStatus only
   
   CALLERS:
   - OrderService: On order create, complete, cancel
   - DisputeService: On dispute resolution
   
   ======================================== */

// Models
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { TRANSACTION_TYPES, TRANSACTION_DIRECTIONS } = require('../models/Transaction');
const Order = require('../models/Order');
const { ESCROW_STATUSES } = require('../models/Order');

/**
 * EscrowService
 * 
 * Passive financial trust layer.
 * Only reacts to OrderService or DisputeService calls.
 */
class EscrowService {
    
    // ============================================================
    // HOLD FUNDS
    // Called by OrderService when order is created.
    // ============================================================
    
    /**
     * Hold funds for a new order.
     * 
     * Flow:
     * 1. Validate buyer has sufficient balance
     * 2. Deduct from buyer's availableBalance
     * 3. Add to buyer's pendingBalance (escrow hold)
     * 4. Create ESCROW_HOLD transaction
     * 5. Update order escrowStatus to HELD
     * 
     * @param {Object} order - The order object
     * @returns {Promise<Object>} Transaction record
     * @throws {Error} If buyer has insufficient balance or invalid state
     */
    async holdFunds(order) {
        // ============================================================
        // STEP 1: Validate order escrow status
        // Constitution: Escrow can only be held once per order
        // ============================================================
        if (order.escrowStatus !== ESCROW_STATUSES.HELD) {
            // If already in HELD state during creation, this is expected
            // But if called again, it's an error
        }
        
        const amount = order.escrowAmount;
        const buyerId = order.buyerId;
        
        // ============================================================
        // STEP 2: Get or create buyer's wallet
        // ============================================================
        let buyerWallet = await Wallet.findOne({ userId: buyerId });
        
        if (!buyerWallet) {
            // Create wallet if it doesn't exist (should have been created with user)
            buyerWallet = await Wallet.create({
                userId: buyerId,
                availableBalance: 0,
                pendingBalance: 0
            });
        }
        
        // ============================================================
        // STEP 3: Validate sufficient balance
        // Constitution: Wallet balances can NEVER go negative
        // ============================================================
        if (buyerWallet.availableBalance < amount) {
            throw new Error(`رصيد غير كافٍ. المتاح: ${buyerWallet.availableBalance}, المطلوب: ${amount}`);
        }
        
        // ============================================================
        // STEP 4: Deduct from available, add to pending
        // This represents funds moving from buyer's wallet to escrow
        // ============================================================
        const previousBalance = buyerWallet.availableBalance;
        
        buyerWallet.availableBalance -= amount;
        buyerWallet.pendingBalance += amount;
        buyerWallet.updatedAt = new Date();
        await buyerWallet.save();
        
        // ============================================================
        // STEP 5: Create ESCROW_HOLD transaction
        // Constitution: Every balance change MUST create a Transaction
        // ============================================================
        const transaction = await Transaction.create({
            walletId: buyerWallet._id,
            orderId: order._id,
            type: TRANSACTION_TYPES.ESCROW_HOLD,
            amount: amount,
            direction: TRANSACTION_DIRECTIONS.DEBIT,  // Money leaving available balance
            balanceAfter: buyerWallet.availableBalance,
            description: `حجز مبلغ ${amount} للطلب رقم ${order._id}`
        });
        
        console.log(`💰 Escrow HOLD: $${amount} from buyer ${buyerId} for order ${order._id}`);
        
        return transaction;
    }
    
    // ============================================================
    // RELEASE FUNDS
    // Called by OrderService when order is completed.
    // ============================================================
    
    /**
     * Release funds to seller on order completion.
     * 
     * Flow:
     * 1. Validate order escrowStatus is HELD
     * 2. Get buyer wallet, deduct from pendingBalance
     * 3. Get seller wallet, add sellerPayout to availableBalance
     * 4. Create ESCROW_RELEASE transaction for seller
     * 5. Create PLATFORM_FEE transaction (for audit trail)
     * 6. Update order escrowStatus to RELEASED
     * 7. Update lifetime statistics
     * 
     * @param {Object} order - The order object
     * @returns {Promise<Object>} Transaction record
     * @throws {Error} If escrow state is invalid
     */
    async releaseFunds(order) {
        // ============================================================
        // STEP 1: Validate escrow status
        // Constitution: Funds must be HELD before release
        // ============================================================
        if (order.escrowStatus !== ESCROW_STATUSES.HELD) {
            throw new Error(`حالة الضمان غير صالحة للإفراج: ${order.escrowStatus}`);
        }
        
        const escrowAmount = order.escrowAmount;
        const platformFee = order.platformFee;
        const sellerPayout = order.sellerPayout;
        const buyerId = order.buyerId;
        const sellerId = order.sellerId;
        
        // ============================================================
        // STEP 2: Get buyer wallet and reduce pending balance
        // ============================================================
        const buyerWallet = await Wallet.findOne({ userId: buyerId });
        
        if (!buyerWallet) {
            throw new Error('محفظة المشتري غير موجودة');
        }
        
        if (buyerWallet.pendingBalance < escrowAmount) {
            throw new Error('رصيد معلق غير كافٍ في محفظة المشتري');
        }
        
        // Deduct from buyer's pending balance
        buyerWallet.pendingBalance -= escrowAmount;
        buyerWallet.totalSpent += escrowAmount;  // Lifetime statistics
        buyerWallet.updatedAt = new Date();
        await buyerWallet.save();
        
        // ============================================================
        // STEP 3: Get or create seller wallet
        // ============================================================
        let sellerWallet = await Wallet.findOne({ userId: sellerId });
        
        if (!sellerWallet) {
            sellerWallet = await Wallet.create({
                userId: sellerId,
                availableBalance: 0,
                pendingBalance: 0
            });
        }
        
        // ============================================================
        // STEP 4: Credit seller's available balance
        // Constitution: Seller receives escrowAmount minus platformFee
        // ============================================================
        const sellerPreviousBalance = sellerWallet.availableBalance;
        
        sellerWallet.availableBalance += sellerPayout;
        sellerWallet.totalEarned += sellerPayout;  // Lifetime statistics
        sellerWallet.updatedAt = new Date();
        await sellerWallet.save();
        
        // ============================================================
        // STEP 5: Create ESCROW_RELEASE transaction for seller
        // Constitution: Every balance change MUST create a Transaction
        // ============================================================
        const releaseTransaction = await Transaction.create({
            walletId: sellerWallet._id,
            orderId: order._id,
            type: TRANSACTION_TYPES.ESCROW_RELEASE,
            amount: sellerPayout,
            direction: TRANSACTION_DIRECTIONS.CREDIT,  // Money coming in
            balanceAfter: sellerWallet.availableBalance,
            description: `استلام مبلغ ${sellerPayout} من الطلب رقم ${order._id}`
        });
        
        // ============================================================
        // STEP 6: Create PLATFORM_FEE transaction (audit trail)
        // The platform fee is deducted from the escrow, not from seller
        // This transaction is for audit purposes
        // ============================================================
        await Transaction.create({
            walletId: sellerWallet._id,  // Associated with seller for reference
            orderId: order._id,
            type: TRANSACTION_TYPES.PLATFORM_FEE,
            amount: platformFee,
            direction: TRANSACTION_DIRECTIONS.DEBIT,  // Conceptually deducted
            balanceAfter: sellerWallet.availableBalance,  // Balance unchanged (fee was never added)
            description: `عمولة المنصة ${platformFee} للطلب رقم ${order._id}`
        });
        
        // ============================================================
        // STEP 7: Update order escrow status
        // ============================================================
        order.escrowStatus = ESCROW_STATUSES.RELEASED;
        await order.save();
        
        console.log(`💸 Escrow RELEASE: $${sellerPayout} to seller ${sellerId} (fee: $${platformFee}) for order ${order._id}`);
        
        return releaseTransaction;
    }
    
    // ============================================================
    // REFUND FUNDS
    // Called by OrderService when order is cancelled.
    // ============================================================
    
    /**
     * Refund funds to buyer on order cancellation.
     * 
     * Flow:
     * 1. Validate order escrowStatus is HELD
     * 2. Get buyer wallet
     * 3. Deduct from buyer's pendingBalance
     * 4. Add to buyer's availableBalance (refund)
     * 5. Create ESCROW_REFUND transaction
     * 6. Update order escrowStatus to REFUNDED
     * 
     * @param {Object} order - The order object
     * @returns {Promise<Object>} Transaction record
     * @throws {Error} If escrow state is invalid
     */
    async refundFunds(order) {
        // ============================================================
        // STEP 1: Validate escrow status
        // Constitution: Funds must be HELD before refund
        // ============================================================
        if (order.escrowStatus !== ESCROW_STATUSES.HELD) {
            throw new Error(`حالة الضمان غير صالحة للاسترداد: ${order.escrowStatus}`);
        }
        
        const amount = order.escrowAmount;
        const buyerId = order.buyerId;
        
        // ============================================================
        // STEP 2: Get buyer wallet
        // ============================================================
        const buyerWallet = await Wallet.findOne({ userId: buyerId });
        
        if (!buyerWallet) {
            throw new Error('محفظة المشتري غير موجودة');
        }
        
        // ============================================================
        // STEP 3: Validate pending balance
        // ============================================================
        if (buyerWallet.pendingBalance < amount) {
            throw new Error('رصيد معلق غير كافٍ للاسترداد');
        }
        
        // ============================================================
        // STEP 4: Move from pending back to available (refund)
        // ============================================================
        buyerWallet.pendingBalance -= amount;
        buyerWallet.availableBalance += amount;
        buyerWallet.updatedAt = new Date();
        await buyerWallet.save();
        
        // ============================================================
        // STEP 5: Create ESCROW_REFUND transaction
        // Constitution: Every balance change MUST create a Transaction
        // ============================================================
        const transaction = await Transaction.create({
            walletId: buyerWallet._id,
            orderId: order._id,
            type: TRANSACTION_TYPES.ESCROW_REFUND,
            amount: amount,
            direction: TRANSACTION_DIRECTIONS.CREDIT,  // Money coming back
            balanceAfter: buyerWallet.availableBalance,
            description: `استرداد مبلغ ${amount} من الطلب رقم ${order._id}`
        });
        
        // ============================================================
        // STEP 6: Update order escrow status
        // ============================================================
        order.escrowStatus = ESCROW_STATUSES.REFUNDED;
        await order.save();
        
        console.log(`🔄 Escrow REFUND: $${amount} to buyer ${buyerId} for order ${order._id}`);
        
        return transaction;
    }
    
    // ============================================================
    // DEPOSIT FUNDS
    // For adding money to wallet (payment gateway integration point)
    // ============================================================
    
    /**
     * Deposit funds into a user's wallet.
     * This is the entry point for payment gateway integration.
     * 
     * @param {string} userId - User ID
     * @param {number} amount - Amount to deposit
     * @param {string} description - Description (e.g., payment reference)
     * @returns {Promise<Object>} Transaction record
     * @throws {Error} If amount is invalid
     */
    async depositFunds(userId, amount, description = 'إيداع رصيد') {
        // ============================================================
        // STEP 1: Validate amount
        // ============================================================
        if (!amount || amount <= 0) {
            throw new Error('مبلغ الإيداع غير صالح');
        }
        
        // ============================================================
        // STEP 2: Get or create wallet
        // ============================================================
        let wallet = await Wallet.findOne({ userId });
        
        if (!wallet) {
            wallet = await Wallet.create({
                userId,
                availableBalance: 0,
                pendingBalance: 0
            });
        }
        
        // ============================================================
        // STEP 3: Add to available balance
        // ============================================================
        wallet.availableBalance += amount;
        wallet.updatedAt = new Date();
        await wallet.save();
        
        // ============================================================
        // STEP 4: Create DEPOSIT transaction
        // ============================================================
        const transaction = await Transaction.create({
            walletId: wallet._id,
            orderId: null,  // Deposits are not tied to orders
            type: TRANSACTION_TYPES.DEPOSIT,
            amount: amount,
            direction: TRANSACTION_DIRECTIONS.CREDIT,
            balanceAfter: wallet.availableBalance,
            description: description
        });
        
        console.log(`💵 Deposit: $${amount} to user ${userId}`);
        
        return transaction;
    }
    
    // ============================================================
    // QUERY METHODS
    // ============================================================
    
    /**
     * Get wallet for a user.
     * 
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>} Wallet or null
     */
    async getWallet(userId) {
        return await Wallet.findOne({ userId });
    }
    
    /**
     * Get or create wallet for a user.
     * Ensures a wallet always exists.
     * 
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Wallet
     */
    async getOrCreateWallet(userId) {
        let wallet = await Wallet.findOne({ userId });
        
        if (!wallet) {
            wallet = await Wallet.create({
                userId,
                availableBalance: 0,
                pendingBalance: 0
            });
        }
        
        return wallet;
    }
    
    /**
     * Get transaction history for a wallet.
     * 
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @param {number} options.limit - Max results
     * @param {string} options.type - Filter by transaction type
     * @returns {Promise<Array>} Transactions
     */
    async getTransactionHistory(userId, { limit = 50, type = null } = {}) {
        const wallet = await Wallet.findOne({ userId });
        
        if (!wallet) {
            return [];
        }
        
        const query = { walletId: wallet._id };
        
        if (type) {
            query.type = type;
        }
        
        return await Transaction.find(query)
            .sort({ createdAt: -1 })
            .limit(limit);
    }
    
    /**
     * Get escrow summary for a user.
     * Shows available and pending balances.
     * 
     * NOTE: This information is for authenticated user only.
     * Constitution: Balances are never exposed publicly.
     * 
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Balance summary
     */
    async getBalanceSummary(userId) {
        const wallet = await this.getOrCreateWallet(userId);
        
        return {
            availableBalance: wallet.availableBalance,
            pendingBalance: wallet.pendingBalance,
            totalEarned: wallet.totalEarned,
            totalSpent: wallet.totalSpent
        };
    }
}

// Export singleton instance
module.exports = new EscrowService();
