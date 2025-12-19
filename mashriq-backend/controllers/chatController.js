const chatService = require('../services/chatService');

exports.sendMessage = async (req, res) => {
  const message = await chatService.sendMessage(req.params.orderId, req.user.id, req.body.message);
  res.status(201).json(message);
};

exports.getChat = async (req, res) => {
  const chat = await chatService.getChat(req.params.orderId);
  res.json(chat);
};
