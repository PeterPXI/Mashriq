/* ========================================
   Mashriq (مشرق) - Service Model
   ========================================
   
   PURPOSE:
   Represents a digital service offering listed by a seller.
   Contains the service details, pricing, and optional extras.
   Service data is SNAPSHOTTED into orders at creation time.
   This model represents the LIVE LISTING (not the order's frozen copy).
   
   CONSTITUTION RULES:
   - Each service has EXACTLY ONE base price
   - Base price MUST be a multiple of 5
   - NO service packages (no basic/standard/premium)
   - Optional extras ONLY (each with price multiple of 5)
   - Prices are NOT negotiable
   - Service data is SNAPSHOT at order creation
   
   IMMUTABLE FIELDS (after creation):
   - id (primary identifier)
   - sellerId (ownership cannot transfer)
   - createdAt (audit trail)
   
   WRITE PERMISSIONS:
   - ServiceService: All fields except id, sellerId, createdAt
   - OrderService: totalOrders, completedOrders (increment only)
   - AdminService: isActive (for moderation)
   
   READ PERMISSIONS:
   - ServiceService: All fields
   - OrderService: All fields (for snapshotting)
   - SearchService: All public fields + visibility weight from TrustService
   
   CRITICAL INVARIANTS:
   1. basePrice must be a POSITIVE MULTIPLE OF 5
   2. Each extra's price must be a POSITIVE MULTIPLE OF 5
   3. A service cannot be deleted if it has orders (soft delete via isActive)
   4. sellerId cannot be changed after creation
   5. deliveryDays must be a positive integer
   
   ======================================== */

const mongoose = require('mongoose');

// ============================================================
// EXTRAS SUB-SCHEMA
// Optional add-ons that buyer can select when ordering.
// Each extra adds to the base price and may extend delivery time.
// ============================================================
const extraSchema = new mongoose.Schema({
    /**
     * Unique identifier for this extra within the service.
     * Used for referencing in orders.
     */
    // _id is automatically created by Mongoose
    
    /**
     * Extra name/description.
     * Describes what this add-on provides.
     */
    name: {
        type: String,
        required: [true, 'اسم الإضافة مطلوب'],
        trim: true,
        maxlength: [100, 'اسم الإضافة يجب أن يكون أقل من 100 حرف']
    },
    
    /**
     * Additional price for this extra.
     * MUST be a positive multiple of 5.
     * Added to base price when selected.
     */
    price: {
        type: Number,
        required: [true, 'سعر الإضافة مطلوب'],
        min: [5, 'سعر الإضافة يجب أن يكون 5 على الأقل']
        // NOTE: Multiple of 5 validation enforced by ServiceService
    },
    
    /**
     * Additional delivery days if this extra is selected.
     * Added to base deliveryDays when calculating total delivery time.
     */
    additionalDays: {
        type: Number,
        default: 0,
        min: [0, 'الأيام الإضافية لا يمكن أن تكون سالبة']
    }
}, { _id: true });

// ============================================================
// SERVICE SCHEMA
// ============================================================
const serviceSchema = new mongoose.Schema({
    
    // ============================================================
    // OWNERSHIP
    // ============================================================
    
    /**
     * Reference to the seller User who owns this service.
     * IMMUTABLE after creation - ownership cannot transfer.
     */
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'الخدمة يجب أن تكون مرتبطة ببائع'],
        immutable: true
    },
    
    // ============================================================
    // BASIC INFORMATION
    // ============================================================
    
    /**
     * Service title (public-facing).
     * Displayed in search results and service page.
     */
    title: {
        type: String,
        required: [true, 'عنوان الخدمة مطلوب'],
        trim: true,
        maxlength: [100, 'العنوان يجب أن يكون أقل من 100 حرف']
    },
    
    /**
     * Detailed service description.
     * Explains what the service includes.
     */
    description: {
        type: String,
        required: [true, 'وصف الخدمة مطلوب'],
        maxlength: [5000, 'الوصف يجب أن يكون أقل من 5000 حرف']
    },
    
    /**
     * Reference to service category.
     * Used for filtering and discovery.
     */
    categoryId: {
        type: String,
        required: [true, 'تصنيف الخدمة مطلوب']
        // NOTE: Could be ObjectId ref if categories are in DB
    },
    
    // ============================================================
    // PRICING
    // Constitution: Single base price, multiple of 5, no packages
    // ============================================================
    
    /**
     * The single base price for this service.
     * MUST be a positive multiple of 5.
     * This is the minimum price for the service.
     */
    basePrice: {
        type: Number,
        required: [true, 'السعر الأساسي مطلوب'],
        min: [5, 'السعر يجب أن يكون 5 على الأقل']
        // NOTE: Multiple of 5 validation enforced by ServiceService
    },
    
    // ============================================================
    // DELIVERY
    // ============================================================
    
    /**
     * Promised delivery time in days.
     * This is the base delivery time before extras.
     */
    deliveryDays: {
        type: Number,
        required: [true, 'مدة التسليم مطلوبة'],
        min: [1, 'مدة التسليم يجب أن تكون يوم واحد على الأقل'],
        max: [90, 'مدة التسليم يجب أن تكون أقل من 90 يوم']
    },
    
    // ============================================================
    // OPTIONAL EXTRAS
    // Constitution: Optional extras only, no packages
    // ============================================================
    
    /**
     * Array of optional extras that buyer can add.
     * Each extra has name, price (multiple of 5), and additionalDays.
     * Extras are selected at order time and added to base price.
     */
    extras: {
        type: [extraSchema],
        default: []
    },
    
    // ============================================================
    // MEDIA
    // ============================================================
    
    /**
     * Array of image URLs for the service.
     * First image is used as thumbnail in listings.
     */
    imageUrls: {
        type: [String],
        default: []
    },
    
    // ============================================================
    // STATUS FLAGS
    // ============================================================
    
    /**
     * Whether service is currently active/listed.
     * Inactive services are hidden from search.
     * Used for soft-delete and moderation.
     */
    isActive: {
        type: Boolean,
        default: true
    },
    
    /**
     * Seller-initiated pause.
     * Service is still active but temporarily hidden.
     * Seller can unpause at any time.
     */
    isPaused: {
        type: Boolean,
        default: false
    },
    
    // ============================================================
    // STATISTICS
    // Updated by OrderService on order creation/completion
    // ============================================================
    
    /**
     * Count of total orders placed for this service.
     * Incremented when an order is created.
     */
    totalOrders: {
        type: Number,
        default: 0,
        min: 0
    },
    
    /**
     * Count of completed orders for this service.
     * Incremented when an order reaches COMPLETED status.
     */
    completedOrders: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // ============================================================
    // TIMESTAMPS
    // ============================================================
    
    /**
     * Service creation timestamp.
     * IMMUTABLE - set once at creation.
     */
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },
    
    /**
     * Last edit timestamp.
     * Updated whenever service is modified.
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
// Optimize database queries for common access patterns.
// ============================================================

// Seller's services lookup
serviceSchema.index({ sellerId: 1 });

// Category filtering
serviceSchema.index({ categoryId: 1 });

// Active services listing (most common query)
serviceSchema.index({ isActive: 1, isPaused: 1 });

// Chronological listing
serviceSchema.index({ createdAt: -1 });

// Popularity sorting
serviceSchema.index({ completedOrders: -1 });

// Text search on title and description
serviceSchema.index({ title: 'text', description: 'text' });

// ============================================================
// VIRTUALS
// Computed properties from relationships.
// ============================================================

/**
 * Virtual: Seller's profile.
 * Populated from User model when needed.
 */
serviceSchema.virtual('seller', {
    ref: 'User',
    localField: 'sellerId',
    foreignField: '_id',
    justOne: true
});

/**
 * Virtual: Orders for this service.
 * Populated from Order model when needed.
 */
serviceSchema.virtual('orders', {
    ref: 'Order',
    localField: '_id',
    foreignField: 'serviceId',
    justOne: false
});

/**
 * Virtual: Reviews for this service.
 * Populated from Review model when needed.
 */
serviceSchema.virtual('reviews', {
    ref: 'Review',
    localField: '_id',
    foreignField: 'serviceId',
    justOne: false
});

// ============================================================
// CRITICAL INVARIANTS (Documented for reference)
// These are NOT enforced by the model - they are enforced by SERVICES.
// ============================================================
/*
 * 1. basePrice must be a POSITIVE MULTIPLE OF 5
 * 2. Each extra's price must be a POSITIVE MULTIPLE OF 5
 * 3. extras is an array; each extra has: name, price, additionalDays
 * 4. A service cannot be deleted if it has any orders (soft delete via isActive)
 * 5. sellerId cannot be changed after creation
 * 6. deliveryDays must be a positive integer
 */

// ============================================================
// EXPORT
// ============================================================

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;
