const disputeService = require('../services/disputeService');

exports.openDispute = async (req, res) => {
  const dispute = await disputeService.openDispute(req.params.orderId, req.user.id, req.body.reason);
  res.status(201).json(dispute);
};

exports.resolveDispute = async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can resolve disputes' });
  const dispute = await disputeService.resolveDispute(req.params.id, req.body.resolution);
  res.json(dispute);
};
