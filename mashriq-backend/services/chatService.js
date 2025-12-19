const Order = require('../models/Order');

// Assume a simple in-memory or DB chat model (not defined, but logic here)
class ChatService {
  async sendMessage(orderId, senderId, message) {
    const order = await Order.findById(orderId);
    if (!order || ['COMPLETED', 'CANCELLED'].includes(order.status)) throw new Error('Chat is read-only after closure');
    // Save message to chat collection (pseudo: implement Chat model if needed)
    return { orderId, senderId, message, timestamp: new Date() };
  }

  async getChat(orderId) {
    // Retrieve messages (visible forever)
    return []; // Pseudo: return messages
  }
}

module.exports = new ChatService();
