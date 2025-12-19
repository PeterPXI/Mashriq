/* ========================================
   Mashriq (مشرق) - Trust Service
   ========================================
   
   PURPOSE:
   The INTERNAL quality engine that measures seller reliability.
   Trust metrics affect VISIBILITY and ORDER LIMITS but are
   NEVER exposed to users in any form.
   
   CONSTITUTION RULES ENFORCED:
   - Trust is INTERNAL-ONLY and metric-based
   - NO visible seller levels, badges, or public scores
   - Trust affects service visibility and dynamic order limits
   - Trust logic is NEVER exposed to users
   - Users CANNOT query or influence their trust score
   
   TRUST PHILOSOPHY:
   - Trust is earned through consistent positive behavior
   - Trust is lost through negative outcomes
   - Trust affects opportunity (visibility, order capacity)
   - Trust is opaque to maintain integrity
   
   TRUST SIGNALS:
   - Positive: Completed orders (consistent delivery)
   - Negative: Seller cancellations, auto-cancels, lost disputes
   
   TRUST OUTPUTS:
   - Visibility weight: Influences search ranking (internal only)
   - Order limit: Maximum concurrent active orders
   
   SECURITY RULES:
   1. Trust values are NEVER returned in API responses
   2. Trust values are NEVER logged with identifiable data
   3. Trust formulas are abstracted and not exposed
   4. No user-facing error should contain trust information
   
   WRITE PERMISSIONS:
   - User: trustScore, completedOrdersAsSeller, cancelledOrdersAsSeller,
           disputesLostAsSeller, averageResponseTime, averageDeliveryTime
   
   CALLERS:
   - OrderService: On order complete, cancel
   - DisputeService: On dispute resolution
   - SearchService: For visibility weight (internal)
   
   ======================================== */

// Models
const User = require('../models/User');

/**
 * TrustService
 * 
 * Internal quality engine for seller reliability.
 * All methods are for internal use only.
 * Trust values are NEVER exposed to users.
 */
class TrustService {
    
    // ============================================================
    // TRUST RECORDING METHODS
    // Called by OrderService and DisputeService
    // ============================================================
    
    /**
     * Record a completed order.
     * Positive signal for seller trust.
     * 
     * @param {Object} order - The completed order
     * @returns {Promise<void>}
     */
    async recordOrderCompleted(order) {
        const seller = await User.findById(order.sellerId);
        
        if (!seller) {
            return;  // Silently fail - don't expose trust logic
        }
        
        // Update completion count
        seller.completedOrdersAsSeller = (seller.completedOrdersAsSeller || 0) + 1;
        
        // Update delivery time metrics
        if (order.deliveredAt && order.createdAt) {
            const deliveryTime = this._calculateDeliveryTime(order.createdAt, order.deliveredAt);
            seller.averageDeliveryTime = this._updateAverage(
                seller.averageDeliveryTime,
                seller.completedOrdersAsSeller,
                deliveryTime
            );
        }
        
        // Recalculate trust score
        seller.trustScore = this._calculateTrustScore(seller);
        
        await seller.save();
    }
    
    /**
     * Record a cancelled order.
     * Negative signal if seller-initiated or system auto-cancel.
     * 
     * @param {Object} order - The cancelled order
     * @param {string} cancelledBy - Who cancelled (buyer, seller, system, admin)
     * @returns {Promise<void>}
     */
    async recordOrderCancelled(order, cancelledBy) {
        // Only penalize seller for seller-initiated or system cancellations
        // Buyer cancellations don't affect seller trust
        if (cancelledBy !== 'seller' && cancelledBy !== 'system') {
            return;
        }
        
        const seller = await User.findById(order.sellerId);
        
        if (!seller) {
            return;  // Silently fail
        }
        
        // Update cancellation count
        seller.cancelledOrdersAsSeller = (seller.cancelledOrdersAsSeller || 0) + 1;
        
        // Recalculate trust score
        seller.trustScore = this._calculateTrustScore(seller);
        
        await seller.save();
    }
    
    /**
     * Record dispute resolution outcome.
     * Negative signal if seller lost the dispute.
     * 
     * @param {Object} order - The disputed order
     * @param {string} resolution - Dispute resolution (buyer_wins, seller_wins, split)
     * @returns {Promise<void>}
     */
    async recordDisputeResult(order, resolution) {
        // Only penalize seller if they lost
        if (resolution !== 'buyer_wins') {
            return;
        }
        
        const seller = await User.findById(order.sellerId);
        
        if (!seller) {
            return;  // Silently fail
        }
        
        // Update disputes lost count
        seller.disputesLostAsSeller = (seller.disputesLostAsSeller || 0) + 1;
        
        // Recalculate trust score
        seller.trustScore = this._calculateTrustScore(seller);
        
        await seller.save();
    }
    
    // ============================================================
    // TRUST OUTPUT METHODS
    // Used internally by other services
    // ============================================================
    
    /**
     * Get visibility weight for search ranking.
     * Higher weight = higher in search results.
     * 
     * INTERNAL USE ONLY - never expose to users.
     * 
     * @param {string} sellerId - Seller user ID
     * @returns {Promise<number>} Visibility weight (normalized)
     */
    async getVisibilityWeight(sellerId) {
        const seller = await User.findById(sellerId);
        
        if (!seller) {
            return this._getDefaultWeight();
        }
        
        return this._computeVisibilityWeight(seller);
    }
    
    /**
     * Get maximum concurrent order limit for seller.
     * Based on trust metrics and performance history.
     * 
     * INTERNAL USE ONLY - never expose to users.
     * 
     * @param {string} sellerId - Seller user ID
     * @returns {Promise<number>} Maximum concurrent active orders
     */
    async getOrderLimit(sellerId) {
        const seller = await User.findById(sellerId);
        
        if (!seller) {
            return this._getDefaultLimit();
        }
        
        // Admin override takes precedence
        if (seller.orderLimitOverride !== null && seller.orderLimitOverride !== undefined) {
            return seller.orderLimitOverride;
        }
        
        return this._computeOrderLimit(seller);
    }
    
    /**
     * Check if seller can accept more orders.
     * 
     * @param {string} sellerId - Seller user ID
     * @param {number} currentActiveOrders - Current active order count
     * @returns {Promise<boolean>} Whether seller can accept more orders
     */
    async canAcceptOrder(sellerId, currentActiveOrders) {
        const limit = await this.getOrderLimit(sellerId);
        return currentActiveOrders < limit;
    }
    
    // ============================================================
    // PRIVATE CALCULATION METHODS
    // Trust formulas are abstracted intentionally
    // ============================================================
    
    /**
     * Calculate trust score based on seller metrics.
     * Formula is intentionally not exposed.
     * @private
     */
    _calculateTrustScore(seller) {
        // Gather metrics
        const completed = seller.completedOrdersAsSeller || 0;
        const cancelled = seller.cancelledOrdersAsSeller || 0;
        const disputesLost = seller.disputesLostAsSeller || 0;
        
        // Base calculation (details abstracted)
        let score = 0;
        
        // Positive contributions
        score += this._positiveContribution(completed);
        
        // Negative contributions
        score -= this._negativeContribution(cancelled, 'cancel');
        score -= this._negativeContribution(disputesLost, 'dispute');
        
        // Normalize to reasonable range
        return this._normalizeScore(score);
    }
    
    /**
     * Positive contribution to trust.
     * @private
     */
    _positiveContribution(completedCount) {
        // Abstracted calculation
        if (completedCount <= 0) return 0;
        return Math.log(completedCount + 1) * 10;
    }
    
    /**
     * Negative contribution to trust.
     * @private
     */
    _negativeContribution(count, type) {
        if (count <= 0) return 0;
        
        // Different weights for different negative signals
        const weights = {
            cancel: 5,
            dispute: 15
        };
        
        const weight = weights[type] || 5;
        return count * weight;
    }
    
    /**
     * Normalize score to a bounded range.
     * @private
     */
    _normalizeScore(rawScore) {
        // Clamp to reasonable range
        return Math.max(-100, Math.min(100, rawScore));
    }
    
    /**
     * Compute visibility weight from seller metrics.
     * @private
     */
    _computeVisibilityWeight(seller) {
        const trustScore = seller.trustScore || 0;
        const completed = seller.completedOrdersAsSeller || 0;
        
        // Base weight
        let weight = 1.0;
        
        // Adjust based on trust (abstracted thresholds)
        if (trustScore > 0) {
            weight += Math.min(trustScore / 100, 0.5);
        } else if (trustScore < 0) {
            weight += Math.max(trustScore / 100, -0.5);
        }
        
        // Experience factor
        if (completed > 0) {
            weight += Math.min(Math.log(completed + 1) / 10, 0.3);
        }
        
        // Clamp to valid range
        return Math.max(0.1, Math.min(2.0, weight));
    }
    
    /**
     * Compute order limit from seller metrics.
     * @private
     */
    _computeOrderLimit(seller) {
        const trustScore = seller.trustScore || 0;
        const completed = seller.completedOrdersAsSeller || 0;
        
        // Start with base limit
        let limit = this._getDefaultLimit();
        
        // Increase based on experience (abstracted thresholds)
        if (completed >= 50) {
            limit += 15;
        } else if (completed >= 25) {
            limit += 10;
        } else if (completed >= 10) {
            limit += 5;
        } else if (completed >= 5) {
            limit += 2;
        }
        
        // Adjust based on trust
        if (trustScore < 0) {
            limit = Math.max(1, limit - Math.abs(Math.floor(trustScore / 20)));
        }
        
        return limit;
    }
    
    /**
     * Default visibility weight for new sellers.
     * @private
     */
    _getDefaultWeight() {
        return 1.0;
    }
    
    /**
     * Default order limit for new sellers.
     * @private
     */
    _getDefaultLimit() {
        return 5;
    }
    
    /**
     * Calculate delivery time in hours.
     * @private
     */
    _calculateDeliveryTime(createdAt, deliveredAt) {
        const diff = new Date(deliveredAt) - new Date(createdAt);
        return diff / (1000 * 60 * 60);  // Convert to hours
    }
    
    /**
     * Update running average.
     * @private
     */
    _updateAverage(currentAverage, count, newValue) {
        if (!currentAverage || count <= 1) {
            return newValue;
        }
        
        // Incremental average calculation
        return currentAverage + (newValue - currentAverage) / count;
    }
}

// Export singleton instance
module.exports = new TrustService();
