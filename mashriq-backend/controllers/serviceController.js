const Service = require('../models/Service');

exports.createService = async (req, res) => {
  if (req.user.role !== 'seller') return res.status(403).json({ error: 'Only sellers can create services' });
  const service = new Service({ ...req.body, seller: req.user.id });
  await service.save();
  res.status(201).json(service);
};

exports.updateService = async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (service.seller.toString() !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
  Object.assign(service, req.body);
  await service.save();
  res.json(service);
};
