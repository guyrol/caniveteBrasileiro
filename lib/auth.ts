import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'canivete_brasileiro_super_secret_dev_key_12345';

export function signToken(payload: { userId: string; username: string; role: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; username: string; role: string };
  } catch (e) {
    return null;
  }
}
