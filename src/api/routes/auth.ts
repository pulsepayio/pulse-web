import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { getConfig } from '../../utils/config';
import { ValidationError } from '../../utils/errors';

const router = Router();
const prisma = new PrismaClient();

// POST /v1/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, business_name } = req.body;

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ValidationError('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const apiKey = `pk_${req.body.mode === 'live' ? 'live' : 'test'}_${crypto.randomBytes(24).toString('hex')}`;
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        businessName: business_name,
        apiKey,
        apiKeyHash,
        livemode: req.body.mode === 'live',
      },
    });

    const config = getConfig();
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );

    res.status(201).json({
      id: user.id,
      email: user.email,
      business_name: user.businessName,
      api_key: apiKey,
      livemode: user.livemode,
      token,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json(error.toJSON());
      return;
    }
    res.status(500).json({ error: { message: 'Registration failed' } });
  }
});

// POST /v1/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: { message: 'Invalid credentials' } });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: { message: 'Invalid credentials' } });
      return;
    }

    const config = getConfig();
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );

    res.json({
      id: user.id,
      email: user.email,
      business_name: user.businessName,
      api_key: user.apiKey,
      livemode: user.livemode,
      token,
    });
  } catch (error) {
    res.status(500).json({ error: { message: 'Login failed' } });
  }
});

export default router;
