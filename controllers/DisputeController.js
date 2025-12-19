/* ========================================
   Mashriq (مشرق) - Dispute Controller
   ========================================
   
   PURPOSE:
   HTTP interface layer for dispute operations.
   Handles authentication, validation, and permission enforcement.
   Delegates ALL business logic to DisputeService.
   
   ARCHITECTURE:
   Controller → Service → Model
   
   RULES:
   - NO direct model access
   - NO business logic
   - NO state transitions
   - ONLY call DisputeService methods
   
   ======================================== */

const DisputeService = require('../services/DisputeService');
const OrderService = require('../services/OrderService');
const { DISPUTE_STATUSES, DISPUTE_RESOLUTIONS, DISPUTE_REASONS } = require('../models/Dispute');
const { USER_ROLES } = require('../models/User');

/**
 * DisputeController
 * 
 * HTTP interface for dispute operations.
 * All methods are async Express route handlers.
 */
class DisputeController {
    
    // ============================================================
    // OPEN DISPUTE
    // POST /api/disputes
    // Permission: Buyer only (on their own order)
    // ============================================================
    
    /**
     * Open a new dispute on an order.
     * 
     * @route POST /api/disputes
     * @body orderId - ID of the order to dispute
     * @body reason - Dispute reason category
     * @body description - Detailed description
     * @access Private (Buyer)
     */
    async openDispute(req, res) {
        try {
            const { orderId, reason, description } = req.body;
            
            // Validate required fields
            if (!orderId) {
                return res.status(400).json({
                    success: false,
                    message: 'رقم الطلب مطلوب'
                });
            }
            
            if (!reason) {
                return res.status(400).json({
                    success: false,
                    message: 'سبب النزاع مطلوب'
                });
            }
            
            if (!description) {
                return res.status(400).json({
                    success: false,
                    message: 'وصف النزاع مطلوب'
                });
            }
            
            // Validate orderId format
            if (typeof orderId !== 'string' || orderId.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: 'معرّف الطلب غير صالح'
                });
            }
            
            // Validate reason is valid
            if (!Object.values(DISPUTE_REASONS).includes(reason)) {
                return res.status(400).json({
                    success: false,
                    message: 'سبب النزاع غير صالح'
                });
            }
            
            // Call DisputeService - it validates buyer ownership and order state
            const dispute = await DisputeService.openDispute(
                orderId,
                req.user._id,
                reason,
                description
            );
            
            res.status(201).json({
                success: true,
                message: 'تم فتح النزاع بنجاح. سيتم مراجعته من قبل الإدارة.',
                dispute
            });
            
        } catch (error) {
            console.error('Open dispute error:', error);
            
            // Determine appropriate status code
            const message = error.message;
            let statusCode = 400;
            
            if (message.includes('فقط المشتري')) {
                statusCode = 403;
            } else if (message.includes('غير موجود')) {
                statusCode = 404;
            }
            
            res.status(statusCode).json({
                success: false,
                message: message || 'حدث خطأ في فتح النزاع'
            });
        }
    }
    
    // ============================================================
    // GET DISPUTE BY ID
    // GET /api/disputes/:id
    // Permission: Involved party (buyer/seller) or Admin
    // ============================================================
    
    /**
     * Get a single dispute by ID.
     * 
     * @route GET /api/disputes/:id
     * @access Private (buyer, seller, or admin)
     */
    async getDisputeById(req, res) {
        try {
            const { id } = req.params;
            
            // Validate ID format
            if (!id || id.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: 'معرّف النزاع غير صالح'
                });
            }
            
            // Get dispute from service
            const dispute = await DisputeService.getDisputeById(id);
            
            if (!dispute) {
                return res.status(404).json({
                    success: false,
                    message: 'النزاع غير موجود'
                });
            }
            
            // Get the associated order to check permissions
            const order = await OrderService.getOrderById(dispute.orderId);
            
            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'الطلب المرتبط بالنزاع غير موجود'
                });
            }
            
            // Check permission: must be buyer, seller, or admin
            const userId = req.user._id.toString();
            const isBuyer = order.buyerId.toString() === userId;
            const isSeller = order.sellerId.toString() === userId;
            const isAdmin = req.user.role === USER_ROLES.ADMIN;
            
            if (!isBuyer && !isSeller && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'ليس لديك صلاحية لعرض هذا النزاع'
                });
            }
            
            res.status(200).json({
                success: true,
                dispute,
                userRole: isAdmin ? 'admin' : (isBuyer ? 'buyer' : 'seller')
            });
            
        } catch (error) {
            console.error('Get dispute by ID error:', error);
            
            if (error.kind === 'ObjectId') {
                return res.status(404).json({
                    success: false,
                    message: 'النزاع غير موجود'
                });
            }
            
            res.status(500).json({
                success: false,
                message: 'حدث خطأ في جلب النزاع'
            });
        }
    }
    
    // ============================================================
    // GET DISPUTE BY ORDER ID
    // GET /api/disputes/order/:orderId
    // Permission: Involved party (buyer/seller) or Admin
    // ============================================================
    
    /**
     * Get dispute for a specific order.
     * 
     * @route GET /api/disputes/order/:orderId
     * @access Private (buyer, seller, or admin)
     */
    async getDisputeByOrderId(req, res) {
        try {
            const { orderId } = req.params;
            
            // Validate ID format
            if (!orderId || orderId.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: 'معرّف الطلب غير صالح'
                });
            }
            
            // Get the order first to check permissions
            const order = await OrderService.getOrderById(orderId);
            
            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'الطلب غير موجود'
                });
            }
            
            // Check permission: must be buyer, seller, or admin
            const userId = req.user._id.toString();
            const isBuyer = order.buyerId.toString() === userId;
            const isSeller = order.sellerId.toString() === userId;
            const isAdmin = req.user.role === USER_ROLES.ADMIN;
            
            if (!isBuyer && !isSeller && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'ليس لديك صلاحية لعرض نزاعات هذا الطلب'
                });
            }
            
            // Get dispute from service
            const dispute = await DisputeService.getDisputeByOrderId(orderId);
            
            if (!dispute) {
                return res.status(404).json({
                    success: false,
                    message: 'لا يوجد نزاع على هذا الطلب'
                });
            }
            
            res.status(200).json({
                success: true,
                dispute
            });
            
        } catch (error) {
            console.error('Get dispute by order ID error:', error);
            
            res.status(500).json({
                success: false,
                message: 'حدث خطأ في جلب النزاع'
            });
        }
    }
    
    // ============================================================
    // MOVE TO UNDER REVIEW
    // PUT /api/disputes/:id/review
    // Permission: Admin only
    // ============================================================
    
    /**
     * Move dispute to under review status.
     * 
     * @route PUT /api/disputes/:id/review
     * @access Private (Admin only)
     */
    async moveToUnderReview(req, res) {
        try {
            const { id } = req.params;
            
            // Validate ID format
            if (!id || id.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: 'معرّف النزاع غير صالح'
                });
            }
            
            // Check admin permission (double-check, service also validates)
            if (req.user.role !== USER_ROLES.ADMIN) {
                return res.status(403).json({
                    success: false,
                    message: 'هذا الإجراء متاح للمسؤولين فقط'
                });
            }
            
            // Call DisputeService
            const dispute = await DisputeService.moveToUnderReview(id, req.user._id);
            
            res.status(200).json({
                success: true,
                message: 'تم نقل النزاع إلى قيد المراجعة',
                dispute
            });
            
        } catch (error) {
            console.error('Move to under review error:', error);
            
            const message = error.message;
            let statusCode = 400;
            
            if (message.includes('للمسؤولين فقط')) {
                statusCode = 403;
            } else if (message.includes('غير موجود')) {
                statusCode = 404;
            }
            
            res.status(statusCode).json({
                success: false,
                message: message || 'حدث خطأ في تحديث حالة النزاع'
            });
        }
    }
    
    // ============================================================
    // RESOLVE DISPUTE
    // PUT /api/disputes/:id/resolve
    // Permission: Admin only
    // ============================================================
    
    /**
     * Resolve a dispute with a decision.
     * 
     * @route PUT /api/disputes/:id/resolve
     * @body resolution - Resolution decision (buyer_wins, seller_wins, split)
     * @body notes - Optional admin notes
     * @access Private (Admin only)
     */
    async resolveDispute(req, res) {
        try {
            const { id } = req.params;
            const { resolution, notes } = req.body;
            
            // Validate ID format
            if (!id || id.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: 'معرّف النزاع غير صالح'
                });
            }
            
            // Validate resolution is provided
            if (!resolution) {
                return res.status(400).json({
                    success: false,
                    message: 'نتيجة النزاع مطلوبة'
                });
            }
            
            // Validate resolution value
            if (!Object.values(DISPUTE_RESOLUTIONS).includes(resolution)) {
                return res.status(400).json({
                    success: false,
                    message: 'نتيجة النزاع غير صالحة'
                });
            }
            
            // Check admin permission (double-check, service also validates)
            if (req.user.role !== USER_ROLES.ADMIN) {
                return res.status(403).json({
                    success: false,
                    message: 'هذا الإجراء متاح للمسؤولين فقط'
                });
            }
            
            // Call DisputeService
            const dispute = await DisputeService.resolveDispute(
                id,
                resolution,
                req.user._id,
                notes || ''
            );
            
            // Determine resolution message
            let resolutionMessage;
            if (resolution === DISPUTE_RESOLUTIONS.BUYER_WINS) {
                resolutionMessage = 'تم حل النزاع لصالح المشتري. سيتم استرداد المبلغ.';
            } else if (resolution === DISPUTE_RESOLUTIONS.SELLER_WINS) {
                resolutionMessage = 'تم حل النزاع لصالح البائع. تم إكمال الطلب.';
            } else {
                resolutionMessage = 'تم حل النزاع بالتسوية.';
            }
            
            res.status(200).json({
                success: true,
                message: resolutionMessage,
                dispute
            });
            
        } catch (error) {
            console.error('Resolve dispute error:', error);
            
            const message = error.message;
            let statusCode = 400;
            
            if (message.includes('للمسؤولين فقط')) {
                statusCode = 403;
            } else if (message.includes('غير موجود')) {
                statusCode = 404;
            }
            
            res.status(statusCode).json({
                success: false,
                message: message || 'حدث خطأ في حل النزاع'
            });
        }
    }
    
    // ============================================================
    // GET DISPUTES (ADMIN)
    // GET /api/disputes
    // Permission: Admin only
    // ============================================================
    
    /**
     * Get disputes list (admin view).
     * 
     * @route GET /api/disputes
     * @query status - Filter by dispute status
     * @query limit - Max results (default: 50)
     * @access Private (Admin only)
     */
    async getDisputes(req, res) {
        try {
            // Check admin permission
            if (req.user.role !== USER_ROLES.ADMIN) {
                return res.status(403).json({
                    success: false,
                    message: 'هذا الإجراء متاح للمسؤولين فقط'
                });
            }
            
            const { status, limit } = req.query;
            
            // Validate status if provided
            if (status && !Object.values(DISPUTE_STATUSES).includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'حالة النزاع غير صالحة'
                });
            }
            
            // Validate limit if provided
            const parsedLimit = limit ? parseInt(limit, 10) : 50;
            if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'الحد الأقصى يجب أن يكون بين 1 و 100'
                });
            }
            
            // Call DisputeService
            const disputes = await DisputeService.getDisputesByStatus(status, {
                limit: parsedLimit
            });
            
            res.status(200).json({
                success: true,
                count: disputes.length,
                disputes
            });
            
        } catch (error) {
            console.error('Get disputes error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ في جلب النزاعات'
            });
        }
    }
}

// Export singleton instance
module.exports = new DisputeController();
