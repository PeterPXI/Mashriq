const express = require('express');
const disputeController = require('../controllers/disputeController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/:orderId', authMiddleware, disputeController.openDispute);
router.put('/:id/resolve', authMiddleware, disputeController.resolveDispute);

module.exports = router;
