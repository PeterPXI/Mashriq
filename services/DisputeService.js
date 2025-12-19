/* ========================================
   Mashriq (مشرق) - Dispute Service
   ========================================
   
   PURPOSE:
   Handles the dispute lifecycle for orders in conflict.
   Disputes are opened by buyers on DELIVERED orders
   and resolved by platform admins.
   
   CONSTITUTION RULES ENFORCED:
   - Disputes can ONLY be opened in DELIVERED state
   - A dispute FREEZES the order (no auto-complete while disputed)
   - Only the BUYER can open a dispute
   - Each order can have AT MOST ONE dispute
   - Resolution outcomes:
     - BUYER_WINS: Order is cancelled, funds refunded
     - SELLER_WINS: Order is completed, funds released
     - SPLIT: Platform decides allocation (placeholder)
   
   DISPUTE LIFECYCLE:
   
   ┌─────────┐    ┌──────────────┐    ┌──────────┐
   │  OPEN   │───▶│ UNDER_REVIEW │───▶│ RESOLVED │
   └─────────┘    └──────────────┘    └──────────┘
        │                                   │
        │         (admin reviews)           │
        │                                   ▼
        └────────────────────────────▶ Order State
                                       Changes
   
   RESOLUTION OUTCOMES:
   - BUYER_WINS → Order CANCELLED (refund via OrderService)
   - SELLER_WINS → Order COMPLETED (release via OrderService)
   - SPLIT → Partial allocation (future implementation)
   
   INTEGRATIONS:
   - OrderService: For all order state changes
   - TrustService: To record dispute outcomes
   - Chat: Dispute chat serves as evidence (read via ChatService)
   
   SECURITY:
   - Validate order ownership before opening
   - Validate order status before opening
   - Admin-only resolution
   - No direct money handling
   
   WRITE PERMISSIONS:
   - Dispute: All fields
   - Order: autoCompleteAt (via OrderService)
   
   ======================================== */

// Models
const Dispute = require('../models/Dispute');
const { DISPUTE_STATUSES, DISPUTE_RESOLUTIONS, DISPUTE_REASONS } = require('../models/Dispute');
const Order = require('../models/Order');
const { ORDER_STATUSES } = require('../models/Order');
const User = require('../models/User');

// Services
const OrderService = require('./OrderService');
const TrustService = require('./TrustService');

/**
 * DisputeService
 * 
 * Handles dispute lifecycle for order conflicts.
 * Disputes freeze order auto-complete and require admin intervention.
 */
class DisputeService {
    
    // ============================================================
    // OPEN DISPUTE
    // Called when buyer initiates a dispute
    // ============================================================
    
    /**
     * Open a new dispute on an order.
     * 
     * Business Rules Enforced:
     * 1. Order must be in DELIVERED status
     * 2. Only the buyer can open a dispute
     * 3. Order can have at most one dispute
     * 4. Dispute freezes order auto-complete timer
     * 
     * @param {string} orderId - ID of the order to dispute
     * @param {string} buyerId - ID of the buyer opening dispute
     * @param {string} reason - Dispute reason category
     * @param {string} description - Detailed description from buyer
     * @returns {Promise<Object>} Created dispute
     * @throws {Error} If any validation fails
     */
    async openDispute(orderId, buyerId, reason, description) {
        // ============================================================
        // STEP 1: Validate inputs
        // ============================================================
        if (!orderId) {
            throw new Error('رقم الطلب مطلوب');
        }
        
        if (!buyerId) {
            throw new Error('معرف المشتري مطلوب');
        }
        
        if (!reason) {
            throw new Error('سبب النزاع مطلوب');
        }
        
        if (!description || description.trim().length < 10) {
            throw new Error('وصف النزاع يجب أن يكون 10 أحرف على الأقل');
        }
        
        // Validate reason is valid
        if (!Object.values(DISPUTE_REASONS).includes(reason)) {
            throw new Error('سبب النزاع غير صالح');
        }
        
        // ============================================================
        // STEP 2: Get and validate order
        // ============================================================
        const order = await Order.findById(orderId);
        
        if (!order) {
            throw new Error('الطلب غير موجود');
        }
        
        // ============================================================
        // STEP 3: Validate order is in DELIVERED status
        // Constitution: Disputes can ONLY be opened in DELIVERED state
        // ============================================================
        if (order.status !== ORDER_STATUSES.DELIVERED) {
            throw new Error('لا يمكن فتح نزاع إلا على طلب في حالة التسليم');
        }
        
        // ============================================================
        // STEP 4: Validate buyer ownership
        // Constitution: Only the BUYER can open a dispute
        // ============================================================
        if (order.buyerId.toString() !== buyerId.toString()) {
            throw new Error('فقط المشتري يمكنه فتح نزاع على هذا الطلب');
        }
        
        // ============================================================
        // STEP 5: Check for existing dispute
        // Constitution: Each order can have AT MOST ONE dispute
        // ============================================================
        const existingDispute = await Dispute.findOne({ orderId });
        
        if (existingDispute) {
            throw new Error('يوجد نزاع مفتوح بالفعل على هذا الطلب');
        }
        
        // ============================================================
        // STEP 6: Create the dispute
        // ============================================================
        const dispute = await Dispute.create({
            orderId: order._id,
            openedById: buyerId,
            reason,
            description: description.trim(),
            status: DISPUTE_STATUSES.OPEN
        });
        
        // ============================================================
        // STEP 7: Freeze order auto-complete timer
        // Constitution: A dispute FREEZES the order
        // ============================================================
        order.autoCompleteAt = null;
        await order.save();
        
        console.log(`⚠️ Dispute opened: ${dispute._id} for order ${orderId}`);
        
        return dispute;
    }
    
    // ============================================================
    // MOVE TO UNDER REVIEW
    // Called when admin starts reviewing the dispute
    // ============================================================
    
    /**
     * Move dispute to under review status.
     * Admin-only action.
     * 
     * @param {string} disputeId - Dispute ID
     * @param {string} adminId - ID of the admin user
     * @returns {Promise<Object>} Updated dispute
     * @throws {Error} If validation fails or already reviewed
     */
    async moveToUnderReview(disputeId, adminId) {
        // ============================================================
        // STEP 1: Validate admin
        // ============================================================
        await this._validateAdmin(adminId);
        
        // ============================================================
        // STEP 2: Get dispute
        // ============================================================
        const dispute = await Dispute.findById(disputeId);
        
        if (!dispute) {
            throw new Error('النزاع غير موجود');
        }
        
        // ============================================================
        // STEP 3: Validate current status
        // ============================================================
        if (dispute.status !== DISPUTE_STATUSES.OPEN) {
            throw new Error('هذا النزاع ليس في حالة مفتوحة');
        }
        
        // ============================================================
        // STEP 4: Update status
        // ============================================================
        dispute.status = DISPUTE_STATUSES.UNDER_REVIEW;
        dispute.updatedAt = new Date();
        await dispute.save();
        
        console.log(`🔍 Dispute under review: ${disputeId} by admin ${adminId}`);
        
        return dispute;
    }
    
    // ============================================================
    // RESOLVE DISPUTE
    // Called when admin makes a resolution decision
    // ============================================================
    
    /**
     * Resolve a dispute with a decision.
     * Admin-only action.
     * 
     * Resolution Effects:
     * - BUYER_WINS: Order cancelled, buyer refunded
     * - SELLER_WINS: Order completed, seller paid
     * - SPLIT: Partial allocation (placeholder)
     * 
     * @param {string} disputeId - Dispute ID
     * @param {string} resolution - Resolution decision
     * @param {string} adminId - ID of the admin user
     * @param {string} notes - Admin notes on the decision
     * @returns {Promise<Object>} Updated dispute
     * @throws {Error} If validation fails
     */
    async resolveDispute(disputeId, resolution, adminId, notes = '') {
        // ============================================================
        // STEP 1: Validate admin
        // ============================================================
        await this._validateAdmin(adminId);
        
        // ============================================================
        // STEP 2: Validate resolution value
        // ============================================================
        if (!Object.values(DISPUTE_RESOLUTIONS).includes(resolution)) {
            throw new Error('نتيجة النزاع غير صالحة');
        }
        
        // ============================================================
        // STEP 3: Get dispute
        // ============================================================
        const dispute = await Dispute.findById(disputeId);
        
        if (!dispute) {
            throw new Error('النزاع غير موجود');
        }
        
        // ============================================================
        // STEP 4: Validate current status
        // Constitution: Only open or under_review can be resolved
        // ============================================================
        if (dispute.status === DISPUTE_STATUSES.RESOLVED) {
            throw new Error('هذا النزاع تم حله بالفعل');
        }
        
        // ============================================================
        // STEP 5: Get the order
        // ============================================================
        const order = await Order.findById(dispute.orderId);
        
        if (!order) {
            throw new Error('الطلب المرتبط بالنزاع غير موجود');
        }
        
        // ============================================================
        // STEP 6: Apply resolution via OrderService
        // Constitution: DisputeService does NOT move money directly
        // ============================================================
        if (resolution === DISPUTE_RESOLUTIONS.BUYER_WINS) {
            // Buyer wins → Order cancelled → Funds refunded
            await OrderService.cancelOrderViaDispute(order._id);
        } else if (resolution === DISPUTE_RESOLUTIONS.SELLER_WINS) {
            // Seller wins → Order completed → Funds released
            await OrderService.completeOrderViaDispute(order._id);
        } else if (resolution === DISPUTE_RESOLUTIONS.SPLIT) {
            // Split resolution - placeholder for partial allocation
            // In production, this would involve:
            // - Calculating split percentages
            // - Partial refund to buyer
            // - Partial payment to seller
            // For now, complete the order (seller gets paid)
            await OrderService.completeOrderViaDispute(order._id);
            console.log(`📊 Split resolution for order ${order._id} - defaulting to completion`);
        }
        
        // ============================================================
        // STEP 7: Record dispute outcome for trust
        // Call TrustService to update seller metrics if applicable
        // ============================================================
        await TrustService.recordDisputeResult(order, resolution);
        
        // ============================================================
        // STEP 8: Update dispute record
        // ============================================================
        dispute.status = DISPUTE_STATUSES.RESOLVED;
        dispute.resolution = resolution;
        dispute.resolutionNotes = notes;
        dispute.resolvedById = adminId;
        dispute.resolvedAt = new Date();
        dispute.updatedAt = new Date();
        await dispute.save();
        
        console.log(`⚖️ Dispute resolved: ${disputeId} | Resolution: ${resolution} | By: ${adminId}`);
        
        return dispute;
    }
    
    // ============================================================
    // QUERY METHODS
    // ============================================================
    
    /**
     * Get dispute by ID.
     * 
     * @param {string} disputeId - Dispute ID
     * @returns {Promise<Object|null>} Dispute or null
     */
    async getDisputeById(disputeId) {
        return await Dispute.findById(disputeId);
    }
    
    /**
     * Get dispute for an order.
     * 
     * @param {string} orderId - Order ID
     * @returns {Promise<Object|null>} Dispute or null
     */
    async getDisputeByOrderId(orderId) {
        return await Dispute.findOne({ orderId });
    }
    
    /**
     * Get disputes by status.
     * For admin dashboard.
     * 
     * @param {string} status - Dispute status filter
     * @param {Object} options - Query options
     * @param {number} options.limit - Max results
     * @returns {Promise<Array>} Disputes
     */
    async getDisputesByStatus(status, { limit = 50 } = {}) {
        const query = {};
        
        if (status) {
            query.status = status;
        }
        
        return await Dispute.find(query)
            .sort({ createdAt: 1 })  // Oldest first (priority queue)
            .limit(limit);
    }
    
    /**
     * Get open disputes count.
     * For admin dashboard metrics.
     * 
     * @returns {Promise<number>} Count of open disputes
     */
    async getOpenDisputesCount() {
        return await Dispute.countDocuments({
            status: { $in: [DISPUTE_STATUSES.OPEN, DISPUTE_STATUSES.UNDER_REVIEW] }
        });
    }
    
    /**
     * Check if order has an active dispute.
     * 
     * @param {string} orderId - Order ID
     * @returns {Promise<boolean>} True if order has active dispute
     */
    async hasActiveDispute(orderId) {
        const dispute = await Dispute.findOne({
            orderId,
            status: { $in: [DISPUTE_STATUSES.OPEN, DISPUTE_STATUSES.UNDER_REVIEW] }
        });
        
        return !!dispute;
    }
    
    // ============================================================
    // PRIVATE HELPER METHODS
    // ============================================================
    
    /**
     * Validate user is an admin.
     * @private
     */
    async _validateAdmin(userId) {
        const user = await User.findById(userId);
        
        if (!user) {
            throw new Error('المستخدم غير موجود');
        }
        
        if (user.role !== 'admin') {
            throw new Error('هذا الإجراء متاح للمسؤولين فقط');
        }
        
        return user;
    }
}

// Export singleton instance
module.exports = new DisputeService();

// Export constants for reference
module.exports.DISPUTE_STATUSES = DISPUTE_STATUSES;
module.exports.DISPUTE_RESOLUTIONS = DISPUTE_RESOLUTIONS;
module.exports.DISPUTE_REASONS = DISPUTE_REASONS;
