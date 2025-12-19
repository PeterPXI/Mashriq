/* ========================================
   Mashriq (مشرق) - Order Controller
   ========================================
   
   PURPOSE:
   HTTP interface layer for order operations.
   Handles authentication, validation, and permission enforcement.
   Delegates ALL business logic to OrderService.
   
   ARCHITECTURE:
   Controller → Service → Model
   
   RULES:
   - NO direct model access
   - NO business logic
   - NO state transitions
   - ONLY call OrderService methods
   
   ======================================== */

const OrderService = require('../services/OrderService');
const { ORDER_STATUSES, CANCELLED_BY } = require('../models/Order');
const { USER_ROLES } = require('../models/User');

/**
 * OrderController
 * 
 * HTTP interface for order operations.
 * All methods are async Express route handlers.
 */
class OrderController {
    
    // ============================================================
    // CREATE ORDER
    // POST /api/orders
    // Permission: Authenticated buyer
    // ============================================================
    
    /**
     * Create a new order.
     * 
     * @route POST /api/orders
     * @access Private (Buyer)
     */
    async createOrder(req, res) {
        try {
            const { serviceId, selectedExtraIds } = req.body;
            
            // Validate required fields
            if (!serviceId) {
                return res.status(400).json({
                    success: false,
                    message: 'يجب تحديد الخدمة المطلوبة'
                });
            }
            
            // Validate serviceId format (basic check)
            if (typeof serviceId !== 'string' || serviceId.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: 'معرّف الخدمة غير صالح'
                });
            }
            
            // Validate selectedExtraIds if provided
            if (selectedExtraIds !== undefined) {
                if (!Array.isArray(selectedExtraIds)) {
                    return res.status(400).json({
                        success: false,
                        message: 'الإضافات المحددة يجب أن تكون قائمة'
                    });
                }
                
                // Validate each extra ID format
                for (const extraId of selectedExtraIds) {
                    if (typeof extraId !== 'string' || extraId.length !== 24) {
                        return res.status(400).json({
                            success: false,
                            message: 'معرّف إضافة غير صالح'
                        });
                    }
                }
            }
            
            // Call OrderService - it handles all business logic
            const order = await OrderService.createOrder({
                buyerId: req.user._id,
                serviceId,
                selectedExtraIds: selectedExtraIds || []
            });
            
            res.status(201).json({
                success: true,
                message: 'تم إنشاء الطلب بنجاح! 🎉',
                order
            });
            
        } catch (error) {
            console.error('Create order error:', error);
            
            // Return service-level errors as 400 (validation/business rule failures)
            res.status(400).json({
                success: false,
                message: error.message || 'حدث خطأ في إنشاء الطلب'
            });
        }
    }
    
    // ============================================================
    // GET ORDERS
    // GET /api/orders
    // Permission: Authenticated user (buyer or seller)
    // ============================================================
    
    /**
     * Get orders for the authenticated user.
     * 
     * @route GET /api/orders
     * @query role - 'buyer', 'seller', or 'all' (default: 'all')
     * @query status - Filter by order status
     * @query limit - Max results (default: 50)
     * @access Private
     */
    async getOrders(req, res) {
        try {
            const { role, status, limit } = req.query;
            
            // Validate role if provided
            const validRoles = ['buyer', 'seller', 'all'];
            if (role && !validRoles.includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: 'الدور المحدد غير صالح'
                });
            }
            
            // Validate status if provided
            if (status && !Object.values(ORDER_STATUSES).includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'حالة الطلب غير صالحة'
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
            
            // Call OrderService
            const orders = await OrderService.getOrdersForUser(req.user._id, {
                role: role || 'all',
                status: status || null,
                limit: parsedLimit
            });
            
            res.status(200).json({
                success: true,
                orders
            });
            
        } catch (error) {
            console.error('Get orders error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ في جلب الطلبات'
            });
        }
    }
    
    // ============================================================
    // GET ORDER BY ID
    // GET /api/orders/:id
    // Permission: Involved party (buyer/seller) or Admin
    // ============================================================
    
    /**
     * Get a single order by ID.
     * 
     * @route GET /api/orders/:id
     * @access Private (buyer, seller, or admin)
     */
    async getOrderById(req, res) {
        try {
            const { id } = req.params;
            
            // Validate ID format
            if (!id || id.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: 'معرّف الطلب غير صالح'
                });
            }
            
            // Get order from service
            const order = await OrderService.getOrderById(id);
            
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
                    message: 'ليس لديك صلاحية لعرض هذا الطلب'
                });
            }
            
            res.status(200).json({
                success: true,
                order,
                userRole: isBuyer ? 'buyer' : (isSeller ? 'seller' : 'admin')
            });
            
        } catch (error) {
            console.error('Get order by ID error:', error);
            
            // Handle invalid ObjectId
            if (error.kind === 'ObjectId') {
                return res.status(404).json({
                    success: false,
                    message: 'الطلب غير موجود'
                });
            }
            
            res.status(500).json({
                success: false,
                message: 'حدث خطأ في جلب الطلب'
            });
        }
    }
    
    // ============================================================
    // DELIVER ORDER
    // PUT /api/orders/:id/deliver
    // Permission: Seller only
    // ============================================================
    
    /**
     * Mark order as delivered.
     * 
     * @route PUT /api/orders/:id/deliver
     * @access Private (Seller only)
     */
    async deliverOrder(req, res) {
        try {
            const { id } = req.params;
            
            // Validate ID format
            if (!id || id.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: 'معرّف الطلب غير صالح'
                });
            }
            
            // Call OrderService - it validates seller ownership
            const order = await OrderService.markAsDelivered(id, req.user._id);
            
            res.status(200).json({
                success: true,
                message: 'تم تسليم الطلب! في انتظار موافقة المشتري ✨',
                order
            });
            
        } catch (error) {
            console.error('Deliver order error:', error);
            
            // Determine appropriate status code
            const statusCode = error.message.includes('لست البائع') ? 403 : 400;
            
            res.status(statusCode).json({
                success: false,
                message: error.message || 'حدث خطأ في تسليم الطلب'
            });
        }
    }
    
    // ============================================================
    // COMPLETE ORDER
    // PUT /api/orders/:id/complete
    // Permission: Buyer only
    // ============================================================
    
    /**
     * Complete order (buyer accepts delivery).
     * 
     * @route PUT /api/orders/:id/complete
     * @access Private (Buyer only)
     */
    async completeOrder(req, res) {
        try {
            const { id } = req.params;
            
            // Validate ID format
            if (!id || id.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: 'معرّف الطلب غير صالح'
                });
            }
            
            // Call OrderService - it validates buyer ownership
            const order = await OrderService.completeOrder(id, req.user._id);
            
            res.status(200).json({
                success: true,
                message: 'تم إكمال الطلب بنجاح! شكراً لك 🎉',
                order
            });
            
        } catch (error) {
            console.error('Complete order error:', error);
            
            // Determine appropriate status code
            const statusCode = error.message.includes('لست المشتري') ? 403 : 400;
            
            res.status(statusCode).json({
                success: false,
                message: error.message || 'حدث خطأ في إكمال الطلب'
            });
        }
    }
    
    // ============================================================
    // CANCEL ORDER
    // PUT /api/orders/:id/cancel
    // Permission: Buyer or Seller (from ACTIVE state only)
    // ============================================================
    
    /**
     * Cancel order.
     * 
     * @route PUT /api/orders/:id/cancel
     * @body reason - Optional cancellation reason
     * @access Private (Buyer or Seller)
     */
    async cancelOrder(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            
            // Validate ID format
            if (!id || id.length !== 24) {
                return res.status(400).json({
                    success: false,
                    message: 'معرّف الطلب غير صالح'
                });
            }
            
            // Get order first to determine who is cancelling
            const order = await OrderService.getOrderById(id);
            
            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'الطلب غير موجود'
                });
            }
            
            // Determine cancelledBy based on user role
            const userId = req.user._id.toString();
            const isBuyer = order.buyerId.toString() === userId;
            const isSeller = order.sellerId.toString() === userId;
            const isAdmin = req.user.role === USER_ROLES.ADMIN;
            
            // Must be involved party or admin
            if (!isBuyer && !isSeller && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'ليس لديك صلاحية لإلغاء هذا الطلب'
                });
            }
            
            // Determine cancelledBy value
            let cancelledBy;
            if (isAdmin) {
                cancelledBy = CANCELLED_BY.ADMIN;
            } else if (isBuyer) {
                cancelledBy = CANCELLED_BY.BUYER;
            } else {
                cancelledBy = CANCELLED_BY.SELLER;
            }
            
            // Call OrderService
            const updatedOrder = await OrderService.cancelOrder(
                id,
                req.user._id,
                reason || 'تم إلغاء الطلب',
                cancelledBy
            );
            
            res.status(200).json({
                success: true,
                message: 'تم إلغاء الطلب',
                order: updatedOrder
            });
            
        } catch (error) {
            console.error('Cancel order error:', error);
            
            res.status(400).json({
                success: false,
                message: error.message || 'حدث خطأ في إلغاء الطلب'
            });
        }
    }
    
    // ============================================================
    // ADMIN: GET ALL ORDERS
    // GET /api/admin/orders
    // Permission: Admin only
    // ============================================================
    
    /**
     * Get all orders (admin view).
     * 
     * NOTE: This endpoint is NOT YET IMPLEMENTED.
     * Requires OrderService.getAllOrders() method to be added.
     * Controllers MUST NOT access models directly.
     * 
     * @route GET /api/admin/orders
     * @access Private (Admin only)
     */
    async getAllOrders(req, res) {
        // Check admin permission first
        if (req.user.role !== USER_ROLES.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'هذا الإجراء متاح للمسؤولين فقط'
            });
        }
        
        // NOT IMPLEMENTED - requires OrderService extension
        // Constitution: Controllers MUST NOT access models directly
        return res.status(501).json({
            success: false,
            message: 'هذه الخدمة غير متاحة حالياً'
        });
    }
}

// Export singleton instance
module.exports = new OrderController();
