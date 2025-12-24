import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  // Get token from cookies or Authorization header
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user info to request
    next();
  } catch (error) {
    console.error('token error:', error);
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};
