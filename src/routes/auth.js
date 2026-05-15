import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { sign } from '../services/jwt.js';
import {
  buildAuthorizationUrl,
  exchangeCode,
  validateIdToken,
  provisionUser,
} from '../services/cognito.js';
import { getReadDb, getWriteDb } from '../db/pool.js';

const router = Router();

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

// ---------------------------------------------------------------------------
// POST /auth/login — username/password authentication
// ---------------------------------------------------------------------------
router.post('/login', loginRateLimit, async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const db = getReadDb();
  const user = db.prepare(
    'SELECT id, email, role, password_hash FROM users WHERE email = ?'
  ).get(email.toLowerCase().trim());

  if (!user || !user.password_hash) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = sign({ id: user.id, email: user.email, role: user.role }, 'password');
  return res.status(200).json({ token });
});

// ---------------------------------------------------------------------------
// GET /auth/cognito/login — initiate Cognito OAuth2 redirect
// ---------------------------------------------------------------------------
router.get('/cognito/login', (_req, res) => {
  try {
    const url = buildAuthorizationUrl();
    return res.redirect(url);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /auth/cognito/callback — receive authorization code, issue AuthToken
// ---------------------------------------------------------------------------
router.get('/cognito/callback', async (req, res) => {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    return res.status(500).json({ error: 'FRONTEND_URL is not configured' });
  }

  try {
    const tokens = await exchangeCode(code);
    const claims = await validateIdToken(tokens.id_token);
    const user = provisionUser(claims, getWriteDb());
    const token = sign({ id: user.id, email: user.email, role: user.role }, 'cognito');

    return res.redirect(`${frontendUrl}/auth/callback#token=${encodeURIComponent(token)}`);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[cognito/callback]', err);
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
});

export default router;
