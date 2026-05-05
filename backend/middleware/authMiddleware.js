import jwt from 'jsonwebtoken';

export const requireAuth = (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.id;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

export const verifyToken = (token) => {
  if (!token) throw new Error('No token provided');
  return jwt.verify(token, process.env.JWT_SECRET);
};
