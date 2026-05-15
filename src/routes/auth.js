import { Router } from 'express';

const router = Router();

// POST /auth/login — username/password login (implemented by Authentication API WO)
router.post('/login', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// GET /auth/cognito/login — initiates Cognito OAuth2 redirect (implemented by Authentication API WO)
router.get('/cognito/login', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// GET /auth/cognito/callback — receives Cognito authorization code (implemented by Authentication API WO)
router.get('/cognito/callback', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

export default router;
