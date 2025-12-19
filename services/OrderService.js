/* ========================================
   Mashriq (مشرق) - Order Service
   ========================================
   
   PURPOSE:
   The CORE business logic layer for order management.
   OrderService is the ONLY authority over order state transitions.
   Controllers must NEVER change order.status directly.
   
   CONSTITUTION RULES ENFORCED:
   - Orders follow strict state machine: ACTIVE → DELIVERED → COMPLETED / CANCELLED
   - Service data is SNAPSHOTTED at order creation
   - Buyer cannot purchase their own service
   - Seller order limits are enforced via TrustService
   - Escrow is held on creation, released on completion, refunded on cancellation
   - Chat is created with every order
   - Auto-complete after delivery (buyer inactivity)
   - Auto-cancel on seller inactivity
   
   STATE MACHINE:
   ┌────────┐    ┌───────────┐    ┌───────────┐
   │ ACTIVE │───▶│ DELIVERED │───▶│ COMPLETED │
   └────────┘    └───────────┘    └───────────┘
        │              │
        ▼              ▼ (via dispute)
   ┌───────────┐
   │ CANCELLED │
   └───────────┘
   
   ALLOWED TRANSITIONS:
   - ACTIVE → DELIVERED (seller delivers)
   - ACTIVE → CANCELLED (seller/buyer/system/admin)
   - DELIVERED → COMPLETED (buyer accepts, auto-complete, dispute: seller wins)
   - DELIVERED → CANCELLED (dispute: buyer wins)
   
   WRITE PERMISSIONS:
   - This service is the ONLY writer to Order.status
   - Calls EscrowService for financial operations
   - Calls ChatService to create chat
   - Reads from TrustService for order limit validation
   
   ======================================== */

// Models
const Order = require('../models/Order');
const { ORDER_STATUSES, ESCROW_STATUSES, CANCELLED_BY } = require('../models/Order');
const Service = require('../models/Service');
const User = require('../models/User');
const Chat = require('../models/Chat');

// Configuration
const PLATFORM_FEE_PERCENT = 20; // 20% platform commission
const AUTO_COMPLETE_HOURS = 72;  // 3 days after delivery
const AUTO_CANCEL_HOURS = 168;   // 7 days of seller inactivity

/**
 * OrderService
 * 
 * The single authority for order business logic.
 * All order state changes MUST go through this service.
 */
class OrderService {
    
    // ============================================================
    // ORDER CREATION
    // ============================================================
    
    /**
     * Create a new order.
     * 
     * Business Rules Enforced:
     * 1. Service must exist and be active
     * 2. Buyer cannot purchase their own service
     * 3. Seller must not exceed order limit (via TrustService)
     * 4. Service data is snapshotted
     * 5. Escrow is held (via EscrowService)
     * 6. Chat is created for the order
     * 
     * @param {Object} params - Order creation parameters
     * @param {string} params.buyerId - ID of the buyer
     * @param {string} params.serviceId - ID of the service to purchase
     * @param {Array} params.selectedExtraIds - IDs of selected extras (optional)
     * @returns {Promise<Object>} Created order
     * @throws {Error} If any validation fails
     */
    async createOrder({ buyerId, serviceId, selectedExtraIds = [] }) {
        // ============================================================
        // STEP 1: Validate service exists and is active
        // ============================================================
        const service = await Service.findById(serviceId);
        
        if (!service) {
            throw new Error('الخدمة غير موجودة');
        }
        
        if (!service.isActive) {
            throw new Error('هذه الخدمة غير متاحة حالياً');
        }
        
        if (service.isPaused) {
            throw new Error('هذه الخدمة متوقفة مؤقتاً');
        }
        
        // ============================================================
        // STEP 2: Validate buyer is not the seller (no self-purchase)
        // Constitution: buyerId cannot equal sellerId
        // ============================================================
        if (service.sellerId.toString() === buyerId.toString()) {
            throw new Error('لا يمكنك شراء خدمتك الخاصة');
        }
        
        // ============================================================
        // STEP 3: Validate buyer exists and is active
        // ============================================================
        const buyer = await User.findById(buyerId);
        
        if (!buyer) {
            throw new Error('المشتري غير موجود');
        }
        
        if (!buyer.isActive) {
            throw new Error('حساب المشتري غير مفعل');
        }
        
        // ============================================================
        // STEP 4: Validate seller exists and is active
        // ============================================================
        const seller = await User.findById(service.sellerId);
        
        if (!seller) {
            throw new Error('البائع غير موجود');
        }
        
        if (!seller.isActive) {
            throw new Error('حساب البائع غير مفعل');
        }
        
        // ============================================================
        // STEP 5: Check seller order limit (via TrustService)
        // Constitution: Order limits are dynamic and threshold-based
        // ============================================================
        const sellerOrderLimit = await this._getSellerOrderLimit(seller);
        const activeOrdersCount = await Order.countDocuments({
            sellerId: service.sellerId,
            status: { $in: [ORDER_STATUSES.ACTIVE, ORDER_STATUSES.DELIVERED] }
        });
        
        if (activeOrdersCount >= sellerOrderLimit) {
            throw new Error('البائع وصل للحد الأقصى من الطلبات النشطة');
        }
        
        // ============================================================
        // STEP 6: Validate and snapshot selected extras
        // Constitution: Service data is SNAPSHOTTED at order creation
        // ============================================================
        const selectedExtras = [];
        let extrasTotal = 0;
        let extrasDays = 0;
        
        for (const extraId of selectedExtraIds) {
            const extra = service.extras.find(e => e._id.toString() === extraId.toString());
            
            if (!extra) {
                throw new Error(`الإضافة غير موجودة: ${extraId}`);
            }
            
            selectedExtras.push({
                extraId: extra._id,
                name: extra.name,
                price: extra.price,
                additionalDays: extra.additionalDays || 0
            });
            
            extrasTotal += extra.price;
            extrasDays += extra.additionalDays || 0;
        }
        
        // ============================================================
        // STEP 7: Calculate totals
        // Constitution: totalPrice = basePrice + sum of extras prices
        // ============================================================
        const totalPrice = service.basePrice + extrasTotal;
        const totalDeliveryDays = service.deliveryDays + extrasDays;
        
        // ============================================================
        // STEP 8: Calculate escrow and fees
        // Constitution: Platform takes a fixed commission
        // ============================================================
        const escrowAmount = totalPrice;
        const platformFee = Math.round(totalPrice * (PLATFORM_FEE_PERCENT / 100));
        const sellerPayout = escrowAmount - platformFee;
        
        // ============================================================
        // STEP 9: Calculate deadline
        // Constitution: Deadline for seller delivery
        // ============================================================
        const now = new Date();
        const deadlineAt = new Date(now.getTime() + (totalDeliveryDays * 24 * 60 * 60 * 1000));
        
        // ============================================================
        // STEP 10: Create the order with snapshotted data
        // ============================================================
        const order = await Order.create({
            buyerId,
            sellerId: service.sellerId,
            serviceId: service._id,
            
            // Snapshot fields (immutable)
            snapshotTitle: service.title,
            snapshotDescription: service.description,
            snapshotBasePrice: service.basePrice,
            snapshotDeliveryDays: service.deliveryDays,
            selectedExtras,
            
            // Computed totals (immutable)
            totalPrice,
            totalDeliveryDays,
            
            // Initial state
            status: ORDER_STATUSES.ACTIVE,
            
            // Escrow fields (immutable)
            escrowStatus: ESCROW_STATUSES.HELD,
            escrowAmount,
            platformFee,
            sellerPayout,
            
            // Timestamps
            deadlineAt
        });
        
        // ============================================================
        // STEP 11: Create chat for the order
        // Constitution: Chat is ALWAYS tied to an order
        // ============================================================
        await Chat.create({
            orderId: order._id,
            buyerId,
            sellerId: service.sellerId,
            isReadOnly: false
        });
        
        // ============================================================
        // STEP 12: Update service statistics
        // ============================================================
        await Service.findByIdAndUpdate(serviceId, {
            $inc: { totalOrders: 1 }
        });
        
        // ============================================================
        // STEP 13: Hold escrow (via EscrowService)
        // Constitution: Buyer pays the platform, platform holds funds
        // NOTE: EscrowService.holdFunds() should be called here
        // For now, we just mark escrowStatus as HELD (done above)
        // ============================================================
        // await EscrowService.holdFunds(order._id, buyerId, escrowAmount);
        
        console.log(`📦 Order created: ${order._id} | ${service.title} | $${totalPrice}`);
        
        return order;
    }
    
    // ============================================================
    // STATE TRANSITIONS
    // ============================================================
    
    /**
     * Mark order as delivered by seller.
     * 
     * Transition: ACTIVE → DELIVERED
     * 
     * @param {string} orderId - Order ID
     * @param {string} sellerId - Seller ID (must match order seller)
     * @returns {Promise<Object>} Updated order
     */
    async markAsDelivered(orderId, sellerId) {
        const order = await this._getOrderOrThrow(orderId);
        
        // Validate seller
        if (order.sellerId.toString() !== sellerId.toString()) {
            throw new Error('أنت لست البائع لهذا الطلب');
        }
        
        // Validate current state
        this._validateTransition(order.status, ORDER_STATUSES.DELIVERED);
        
        // Calculate auto-complete time
        const autoCompleteAt = new Date(Date.now() + (AUTO_COMPLETE_HOURS * 60 * 60 * 1000));
        
        // Update order
        order.status = ORDER_STATUSES.DELIVERED;
        order.deliveredAt = new Date();
        order.autoCompleteAt = autoCompleteAt;
        await order.save();
        
        console.log(`📬 Order delivered: ${orderId} | Auto-complete at: ${autoCompleteAt}`);
        
        return order;
    }
    
    /**
     * Complete order (buyer accepts delivery).
     * 
     * Transition: DELIVERED → COMPLETED
     * 
     * @param {string} orderId - Order ID
     * @param {string} buyerId - Buyer ID (must match order buyer)
     * @returns {Promise<Object>} Updated order
     */
    async completeOrder(orderId, buyerId) {
        const order = await this._getOrderOrThrow(orderId);
        
        // Validate buyer
        if (order.buyerId.toString() !== buyerId.toString()) {
            throw new Error('أنت لست المشتري لهذا الطلب');
        }
        
        // Validate current state
        this._validateTransition(order.status, ORDER_STATUSES.COMPLETED);
        
        // Complete the order
        await this._completeOrder(order, 'buyer_accepted');
        
        return order;
    }
    
    /**
     * Auto-complete order after buyer inactivity.
     * Called by scheduled job.
     * 
     * Transition: DELIVERED → COMPLETED
     * 
     * @param {string} orderId - Order ID
     * @returns {Promise<Object>} Updated order
     */
    async autoCompleteOrder(orderId) {
        const order = await this._getOrderOrThrow(orderId);
        
        // Validate current state
        if (order.status !== ORDER_STATUSES.DELIVERED) {
            throw new Error('الطلب ليس في حالة تسليم');
        }
        
        // Check if auto-complete time has passed
        if (!order.autoCompleteAt || new Date() < order.autoCompleteAt) {
            throw new Error('لم يحن وقت الإكمال التلقائي بعد');
        }
        
        // Complete the order
        await this._completeOrder(order, 'auto_complete');
        
        console.log(`⏰ Order auto-completed: ${orderId}`);
        
        return order;
    }
    
    /**
     * Cancel order.
     * 
     * Transition: ACTIVE → CANCELLED
     * 
     * @param {string} orderId - Order ID
     * @param {string} userId - User ID initiating cancellation
     * @param {string} reason - Cancellation reason
     * @param {string} cancelledBy - Who cancelled (buyer, seller, system, admin)
     * @returns {Promise<Object>} Updated order
     */
    async cancelOrder(orderId, userId, reason, cancelledBy = CANCELLED_BY.BUYER) {
        const order = await this._getOrderOrThrow(orderId);
        
        // Validate user is involved (unless system/admin)
        if (cancelledBy === CANCELLED_BY.BUYER) {
            if (order.buyerId.toString() !== userId.toString()) {
                throw new Error('أنت لست المشتري لهذا الطلب');
            }
        } else if (cancelledBy === CANCELLED_BY.SELLER) {
            if (order.sellerId.toString() !== userId.toString()) {
                throw new Error('أنت لست البائع لهذا الطلب');
            }
        }
        
        // Validate current state - can only cancel from ACTIVE
        // (DELIVERED can only be cancelled via dispute resolution)
        if (order.status !== ORDER_STATUSES.ACTIVE) {
            throw new Error('لا يمكن إلغاء الطلب في هذه المرحلة');
        }
        
        // Cancel the order
        await this._cancelOrder(order, reason, cancelledBy);
        
        return order;
    }
    
    /**
     * Auto-cancel order due to seller inactivity.
     * Called by scheduled job.
     * 
     * Transition: ACTIVE → CANCELLED
     * 
     * @param {string} orderId - Order ID
     * @returns {Promise<Object>} Updated order
     */
    async autoCancelOrder(orderId) {
        const order = await this._getOrderOrThrow(orderId);
        
        // Validate current state
        if (order.status !== ORDER_STATUSES.ACTIVE) {
            throw new Error('الطلب ليس في حالة نشطة');
        }
        
        // Check if deadline has passed
        if (new Date() < order.deadlineAt) {
            throw new Error('لم يحن وقت الإلغاء التلقائي بعد');
        }
        
        // Cancel the order
        await this._cancelOrder(order, 'تجاوز مهلة التسليم - إلغاء تلقائي', CANCELLED_BY.SYSTEM);
        
        console.log(`⏰ Order auto-cancelled: ${orderId}`);
        
        return order;
    }
    
    /**
     * Complete order via dispute resolution (seller wins).
     * Called by DisputeService.
     * 
     * Transition: DELIVERED → COMPLETED
     * 
     * @param {string} orderId - Order ID
     * @returns {Promise<Object>} Updated order
     */
    async completeOrderViaDispute(orderId) {
        const order = await this._getOrderOrThrow(orderId);
        
        // Validate current state
        if (order.status !== ORDER_STATUSES.DELIVERED) {
            throw new Error('الطلب ليس في حالة تسليم');
        }
        
        // Complete the order
        await this._completeOrder(order, 'dispute_seller_wins');
        
        console.log(`⚖️ Order completed via dispute: ${orderId}`);
        
        return order;
    }
    
    /**
     * Cancel order via dispute resolution (buyer wins).
     * Called by DisputeService.
     * 
     * Transition: DELIVERED → CANCELLED
     * 
     * @param {string} orderId - Order ID
     * @returns {Promise<Object>} Updated order
     */
    async cancelOrderViaDispute(orderId) {
        const order = await this._getOrderOrThrow(orderId);
        
        // Validate current state - dispute can cancel DELIVERED orders
        if (order.status !== ORDER_STATUSES.DELIVERED) {
            throw new Error('الطلب ليس في حالة تسليم');
        }
        
        // Cancel the order
        await this._cancelOrder(order, 'تم حل النزاع لصالح المشتري', CANCELLED_BY.ADMIN);
        
        console.log(`⚖️ Order cancelled via dispute: ${orderId}`);
        
        return order;
    }
    
    // ============================================================
    // QUERY METHODS
    // ============================================================
    
    /**
     * Get order by ID.
     * 
     * @param {string} orderId - Order ID
     * @returns {Promise<Object|null>} Order or null
     */
    async getOrderById(orderId) {
        return await Order.findById(orderId);
    }
    
    /**
     * Get orders for a user (buyer or seller).
     * 
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @param {string} options.role - 'buyer', 'seller', or 'all'
     * @param {string} options.status - Filter by status
     * @param {number} options.limit - Max results
     * @returns {Promise<Array>} Orders
     */
    async getOrdersForUser(userId, { role = 'all', status = null, limit = 50 } = {}) {
        const query = {};
        
        if (role === 'buyer') {
            query.buyerId = userId;
        } else if (role === 'seller') {
            query.sellerId = userId;
        } else {
            query.$or = [{ buyerId: userId }, { sellerId: userId }];
        }
        
        if (status) {
            query.status = status;
        }
        
        return await Order.find(query)
            .sort({ createdAt: -1 })
            .limit(limit);
    }
    
    /**
     * Get orders pending auto-complete.
     * For scheduled job.
     * 
     * @returns {Promise<Array>} Orders ready for auto-complete
     */
    async getOrdersPendingAutoComplete() {
        return await Order.find({
            status: ORDER_STATUSES.DELIVERED,
            autoCompleteAt: { $lte: new Date() }
        });
    }
    
    /**
     * Get orders pending auto-cancel.
     * For scheduled job.
     * 
     * @returns {Promise<Array>} Orders ready for auto-cancel
     */
    async getOrdersPendingAutoCancel() {
        return await Order.find({
            status: ORDER_STATUSES.ACTIVE,
            deadlineAt: { $lte: new Date() }
        });
    }
    
    // ============================================================
    // PRIVATE HELPER METHODS
    // ============================================================
    
    /**
     * Get order or throw error if not found.
     * @private
     */
    async _getOrderOrThrow(orderId) {
        const order = await Order.findById(orderId);
        
        if (!order) {
            throw new Error('الطلب غير موجود');
        }
        
        return order;
    }
    
    /**
     * Validate state transition is allowed.
     * Constitution: Strict state machine enforcement.
     * @private
     */
    _validateTransition(currentStatus, newStatus) {
        const allowedTransitions = {
            [ORDER_STATUSES.ACTIVE]: [
                ORDER_STATUSES.DELIVERED,
                ORDER_STATUSES.CANCELLED
            ],
            [ORDER_STATUSES.DELIVERED]: [
                ORDER_STATUSES.COMPLETED,
                ORDER_STATUSES.CANCELLED  // Only via dispute
            ],
            [ORDER_STATUSES.COMPLETED]: [],  // Terminal state
            [ORDER_STATUSES.CANCELLED]: []   // Terminal state
        };
        
        const allowed = allowedTransitions[currentStatus] || [];
        
        if (!allowed.includes(newStatus)) {
            throw new Error(`لا يمكن الانتقال من "${currentStatus}" إلى "${newStatus}"`);
        }
    }
    
    /**
     * Internal method to complete an order.
     * Handles escrow release and statistics.
     * @private
     */
    async _completeOrder(order, reason) {
        // Update order state
        order.status = ORDER_STATUSES.COMPLETED;
        order.escrowStatus = ESCROW_STATUSES.RELEASED;
        order.completedAt = new Date();
        order.autoCompleteAt = null;  // Clear auto-complete timer
        await order.save();
        
        // Update service statistics
        await Service.findByIdAndUpdate(order.serviceId, {
            $inc: { completedOrders: 1 }
        });
        
        // Update chat to read-only
        // Constitution: Chat becomes read-only after order closure
        await Chat.findOneAndUpdate(
            { orderId: order._id },
            { isReadOnly: true }
        );
        
        // Release escrow (via EscrowService)
        // Constitution: Funds are released ONLY on COMPLETED
        // NOTE: EscrowService.releaseFunds() should be called here
        // await EscrowService.releaseFunds(order._id, order.sellerId, order.sellerPayout);
        
        // Update seller trust metrics (via TrustService)
        // Constitution: Order outcomes update seller trust
        // NOTE: TrustService.recordOrderCompleted() should be called here
        // await TrustService.recordOrderCompleted(order.sellerId);
        
        console.log(`✅ Order completed: ${order._id} | Reason: ${reason}`);
    }
    
    /**
     * Internal method to cancel an order.
     * Handles escrow refund and statistics.
     * @private
     */
    async _cancelOrder(order, reason, cancelledBy) {
        // Update order state
        order.status = ORDER_STATUSES.CANCELLED;
        order.escrowStatus = ESCROW_STATUSES.REFUNDED;
        order.cancelReason = reason;
        order.cancelledBy = cancelledBy;
        order.cancelledAt = new Date();
        order.autoCompleteAt = null;  // Clear any auto-complete timer
        await order.save();
        
        // Update chat to read-only
        // Constitution: Chat becomes read-only after order closure
        await Chat.findOneAndUpdate(
            { orderId: order._id },
            { isReadOnly: true }
        );
        
        // Refund escrow (via EscrowService)
        // Constitution: Funds are refunded on CANCELLED
        // NOTE: EscrowService.refundFunds() should be called here
        // await EscrowService.refundFunds(order._id, order.buyerId, order.escrowAmount);
        
        // Update seller trust metrics if cancelled by system/buyer
        // Constitution: Cancellations affect trust negatively
        if (cancelledBy === CANCELLED_BY.SYSTEM || cancelledBy === CANCELLED_BY.SELLER) {
            // NOTE: TrustService.recordOrderCancelled() should be called here
            // await TrustService.recordOrderCancelled(order.sellerId);
        }
        
        console.log(`❌ Order cancelled: ${order._id} | By: ${cancelledBy} | Reason: ${reason}`);
    }
    
    /**
     * Get seller order limit from trust metrics.
     * Constitution: Order limits are dynamic and threshold-based.
     * @private
     */
    async _getSellerOrderLimit(seller) {
        // If admin override exists, use it
        if (seller.orderLimitOverride !== null) {
            return seller.orderLimitOverride;
        }
        
        // Default limit for new sellers
        const baseLimit = 5;
        
        // Increase limit based on completed orders
        // This is a simplified version - TrustService should handle this
        const completedOrders = seller.completedOrdersAsSeller || 0;
        
        let limit = baseLimit;
        if (completedOrders >= 50) limit = 20;
        else if (completedOrders >= 25) limit = 15;
        else if (completedOrders >= 10) limit = 10;
        else if (completedOrders >= 5) limit = 7;
        
        // Reduce limit if trust score is low
        const trustScore = seller.trustScore || 0;
        if (trustScore < 0) {
            limit = Math.max(1, limit - 3);
        }
        
        return limit;
    }
}

// Export singleton instance
module.exports = new OrderService();
