const express = require('express');
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/', authMiddleware, orderController.createOrder);
router.put('/:id/deliver', authMiddleware, orderController.deliverOrder);
router.put('/:id/approve', authMiddleware, orderController.approveOrder);

module.exports = router;
