const User = require('../models/User');
const jwtUtils = require('../utils/jwtUtils');
const hashUtils = require('../utils/hashUtils');

exports.register = async (req, res) => {
  const { username, email, password, role } = req.body;
  const hashedPassword = await hashUtils.hashPassword(password);
  const user = new User({ username, email, password: hashedPassword, role });
  await user.save();
  res.status(201).json({ message: 'User registered' });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await hashUtils.comparePassword(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwtUtils.generateToken({ id: user._id, role: user.role });
  res.json({ token });
};
