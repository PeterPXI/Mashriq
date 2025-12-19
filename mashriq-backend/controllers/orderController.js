const orderService = require('../services/orderService');
const trustService = require('../services/trustService');
const Service = require('../models/Service');

exports.createOrder = async (req, res) => {
  const service = await Service.findById(req.body.serviceId);
  if (!(await trustService.canSellerAcceptOrder(service.seller))) return res.status(400).json({ error: 'Seller order limit reached' });
  const order = await orderService.createOrder(req.user.id, service, req.body.selectedExtras || []);
  res.status(201).json(order);
};

exports.deliverOrder = async (req, res) => {
  const order = await orderService.deliverOrder(req.params.id, req.body.delivery);
  res.json(order);
};

exports.approveOrder = async (req, res) => {
  const order = await orderService.approveOrder(req.params.id);
  await trustService.updateTrustScore(order.seller);
  res.json(order);
};
