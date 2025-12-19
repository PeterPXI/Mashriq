/* ========================================
   Mashriq (مشرق) - User Model
   ========================================
   
   PURPOSE:
   Represents a single human identity on the platform.
   A user can act as a BUYER, SELLER, or BOTH depending on context.
   Contains authentication data, profile data, and INTERNAL trust metrics.
   
   CONSTITUTION RULES:
   - Trust metrics are INTERNAL ONLY and NEVER exposed via API
   - A user is NOT deleted if they have orders (soft delete via isActive)
   - Role is contextual per action, not a fixed permanent label
   - Wallet is a SEPARATE model (not embedded here)
   
   WRITE PERMISSIONS:
   - UserService: All profile fields, authentication fields
   - TrustService: All trust-related fields ONLY
   - AuthService: passwordHash, isEmailVerified, lastActiveAt
   - AdminService: isActive, orderLimitOverride
   
   READ PERMISSIONS:
   - UserService: All fields
   - TrustService: All trust fields
   - OrderService: id, username, isActive
   - ServiceService: id, username, bio, avatarUrl
   - ANY PUBLIC API: NEVER trust fields
   
   ======================================== */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ============================================================
// USER ROLES
// Defines the possible roles a user can have on the platform.
// Role is contextual - a user can be buyer in one order, seller in another.
// ============================================================
const USER_ROLES = {
    BUYER: 'buyer',    // Default role for new users
    SELLER: 'seller',  // Activated when user enables seller mode
    ADMIN: 'admin'     // Platform administrator (set manually)
};

// ============================================================
// USER SCHEMA
// ============================================================
const userSchema = new mongoose.Schema({
    
    // ============================================================
    // AUTHENTICATION FIELDS
    // Used for login, identity verification, and account security.
    // ============================================================
    
    /**
     * User's email address.
     * IMMUTABLE after creation (change requires verification flow).
     * Used as primary login identifier.
     */
    email: {
        type: String,
        required: [true, 'البريد الإلكتروني مطلوب'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [
            /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
            'يرجى إدخال بريد إلكتروني صالح'
        ]
    },
    
    /**
     * Hashed password.
     * NEVER stored in plain text.
     * Hashing is performed in pre-save hook.
     */
    passwordHash: {
        type: String,
        required: [true, 'كلمة المرور مطلوبة']
    },
    
    /**
     * Whether email has been verified.
     * Affects account capabilities.
     */
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    
    // ============================================================
    // PROFILE FIELDS
    // Public-facing user information.
    // ============================================================
    
    /**
     * Unique display name (public-facing).
     * IMMUTABLE after creation for identity consistency.
     */
    username: {
        type: String,
        required: [true, 'اسم المستخدم مطلوب'],
        unique: true,
        lowercase: true,
        trim: true,
        minlength: [3, 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل'],
        maxlength: [30, 'اسم المستخدم يجب أن يكون أقل من 30 حرف']
    },
    
    /**
     * User's display name (legal/display name).
     * Can be updated.
     */
    fullName: {
        type: String,
        required: [true, 'الاسم الكامل مطلوب'],
        trim: true,
        maxlength: [100, 'الاسم يجب أن يكون أقل من 100 حرف']
    },
    
    /**
     * User's profile description/bio.
     * Visible on profile and seller pages.
     */
    bio: {
        type: String,
        default: '',
        maxlength: [500, 'الوصف يجب أن يكون أقل من 500 حرف']
    },
    
    /**
     * URL to user's profile image.
     * Can be null (uses default avatar).
     */
    avatarUrl: {
        type: String,
        default: null
    },
    
    // ============================================================
    // ROLE & STATUS FIELDS
    // Account state and permissions.
    // ============================================================
    
    /**
     * Current user role.
     * BUYER by default, SELLER when activated.
     * Role is contextual - determines available actions.
     */
    role: {
        type: String,
        enum: Object.values(USER_ROLES),
        default: USER_ROLES.BUYER
    },
    
    /**
     * Whether account is active.
     * Inactive accounts cannot login or perform actions.
     * Used for soft-delete and account suspension.
     */
    isActive: {
        type: Boolean,
        default: true
    },
    
    // ============================================================
    // INTERNAL TRUST METRICS
    // NEVER exposed via any public API.
    // Updated ONLY by TrustService.
    // Affects visibility and order limits internally.
    // ============================================================
    
    /**
     * Computed trust score.
     * INTERNAL metric used for visibility and limits.
     * NEVER shown to users.
     */
    trustScore: {
        type: Number,
        default: 0,
        min: 0
    },
    
    /**
     * Count of orders completed successfully as seller.
     * Positive trust signal.
     */
    completedOrdersAsSeller: {
        type: Number,
        default: 0,
        min: 0
    },
    
    /**
     * Count of orders cancelled by seller.
     * Negative trust signal.
     */
    cancelledOrdersAsSeller: {
        type: Number,
        default: 0,
        min: 0
    },
    
    /**
     * Count of disputes lost as seller.
     * Negative trust signal.
     */
    disputesLostAsSeller: {
        type: Number,
        default: 0,
        min: 0
    },
    
    /**
     * Average time to first response in orders (in hours).
     * Affects ranking in search results.
     */
    averageResponseTime: {
        type: Number,
        default: null
    },
    
    /**
     * Average delivery time vs. promised (ratio).
     * < 1.0 = faster than promised (good)
     * > 1.0 = slower than promised (bad)
     */
    averageDeliveryTime: {
        type: Number,
        default: null
    },
    
    /**
     * Admin override for order limit.
     * If null, computed limit is used.
     * Allows manual adjustment for special cases.
     */
    orderLimitOverride: {
        type: Number,
        default: null,
        min: 0
    },
    
    // ============================================================
    // TIMESTAMPS
    // Audit trail and activity tracking.
    // ============================================================
    
    /**
     * Account creation timestamp.
     * IMMUTABLE - set once at creation.
     */
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },
    
    /**
     * Last profile update timestamp.
     * Updated on any profile change.
     */
    updatedAt: {
        type: Date,
        default: Date.now
    },
    
    /**
     * Last activity timestamp.
     * Updated on login and significant actions.
     */
    lastActiveAt: {
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

// Unique email index (primary login identifier)
userSchema.index({ email: 1 }, { unique: true });

// Unique username index (public identifier)
userSchema.index({ username: 1 }, { unique: true });

// Role index (for filtering by role)
userSchema.index({ role: 1 });

// Active status index (for filtering active users)
userSchema.index({ isActive: 1 });

// Trust score index (for sorting by trust - internal use only)
userSchema.index({ trustScore: -1 });

// ============================================================
// VIRTUALS
// Computed properties from relationships.
// ============================================================

/**
 * Virtual: Services owned by this user (as seller).
 * Populated from Service model.
 */
userSchema.virtual('services', {
    ref: 'Service',
    localField: '_id',
    foreignField: 'sellerId',
    justOne: false
});

/**
 * Virtual: Orders where user is the buyer.
 * Populated from Order model.
 */
userSchema.virtual('ordersAsBuyer', {
    ref: 'Order',
    localField: '_id',
    foreignField: 'buyerId',
    justOne: false
});

/**
 * Virtual: Orders where user is the seller.
 * Populated from Order model.
 */
userSchema.virtual('ordersAsSeller', {
    ref: 'Order',
    localField: '_id',
    foreignField: 'sellerId',
    justOne: false
});

/**
 * Virtual: User's wallet.
 * Populated from Wallet model.
 */
userSchema.virtual('wallet', {
    ref: 'Wallet',
    localField: '_id',
    foreignField: 'userId',
    justOne: true
});

// ============================================================
// PRE-SAVE HOOKS
// Automatic operations before saving.
// NOTE: Password hashing is the ONLY logic allowed here.
//       All business logic must be in services.
// ============================================================

/**
 * Pre-save hook: Hash password if modified.
 * Updates the updatedAt timestamp.
 */
userSchema.pre('save', async function(next) {
    // Always update the updatedAt timestamp
    this.updatedAt = Date.now();
    
    // Only hash password if it has been modified
    // The field is named passwordHash but we accept raw password for convenience
    if (!this.isModified('passwordHash')) {
        return next();
    }
    
    // Hash the password with bcrypt
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
});

// ============================================================
// INSTANCE METHODS
// These are UTILITY methods only (no business logic).
// Business logic must be in services.
// ============================================================

/**
 * Compare entered password with stored hash.
 * UTILITY METHOD - no business logic.
 * 
 * @param {string} enteredPassword - Plain text password to verify
 * @returns {Promise<boolean>} - True if password matches
 */
userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.passwordHash);
};

// ============================================================
// STATIC METHODS
// Class-level utility methods.
// NOTE: These should NOT contain business logic.
//       Business logic must be in services.
// ============================================================

/**
 * Find user by email.
 * UTILITY METHOD for common lookup.
 * 
 * @param {string} email - Email to search
 * @returns {Promise<User|null>}
 */
userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

/**
 * Find user by username.
 * UTILITY METHOD for common lookup.
 * 
 * @param {string} username - Username to search
 * @returns {Promise<User|null>}
 */
userSchema.statics.findByUsername = function(username) {
    return this.findOne({ username: username.toLowerCase() });
};

// ============================================================
// CRITICAL INVARIANTS (Documented for reference)
// These are NOT enforced by the model - they are enforced by SERVICES.
// ============================================================
/*
 * 1. email must be unique across all users
 * 2. username must be unique across all users
 * 3. Trust fields are NEVER included in any public API response
 * 4. orderLimitOverride can only be set by AdminService
 * 5. A user cannot be deleted if they have any orders (soft delete via isActive)
 * 6. passwordHash is NEVER returned in any API response
 */

// ============================================================
// EXPORT
// ============================================================

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.USER_ROLES = USER_ROLES;
