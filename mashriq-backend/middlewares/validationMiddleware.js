const Joi = require('joi'); // Assume installed

module.exports.validateRegister = (req, res, next) => {
  const schema = Joi.object({ username: Joi.string().required(), email: Joi.string().email().required(), password: Joi.string().min(6).required() });
  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  next();
};
