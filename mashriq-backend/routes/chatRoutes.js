const express = require('express');
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/:orderId', authMiddleware, chatController.sendMessage);
router.get('/:orderId', authMiddleware, chatController.getChat);

module.exports = router;
