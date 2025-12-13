const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please add a product title'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Please add a description']
    },
    price: {
        type: Number,
        required: [true, 'Please add a price']
    },
    category: {
        type: String,
        required: [true, 'Please select a category'],
        enum: ['programming', 'design', 'art', 'crafts', 'education', 'other']
    },
    image: {
        type: String,
        default: 'https://via.placeholder.com/600x400?text=صورة+المنتج'
    },
    sellerId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    sellerName: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        default: 0
    },
    reviews: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'sold'],
        default: 'active'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Product', productSchema);
