import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthController } from '../controllers/auth';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateSignup, validateLogin } from '../middleware/validation';
import { authLimiter } from '../middleware/rate-limit';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/database';

const router = Router();

// Apply rate limiting to all auth routes
router.use(authLimiter);

const handleSignup: RequestHandler = async (req, res, next) => {
  try {
    await AuthController.signup(req, res);
  } catch (error) {
    next(error);
  }
};

const handleLogin: RequestHandler = async (req, res, next) => {
  try {
    await AuthController.login(req, res);
  } catch (error) {
    next(error);
  }
};

const handleMe: RequestHandler = (req, res) => {
  const authReq = req as AuthRequest;
  res.json({ user: authReq.user });
};

// Public routes with validation
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, username } = req.body;
    
    // Validation
    if (!email || !password || !username) {
      res.status(400).json({ error: 'Email, password, and username are required' });
      return;
    }

    // Check if email already exists
    const emailCheck = await pool.query(
      'SELECT 1 FROM users WHERE email = $1',
      [email]
    );

    if (emailCheck.rows.length > 0) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, username)
       VALUES ($1, $2, $3)
       RETURNING id, email, username, created_at`,
      [email, hashedPassword, username]
    );

    // Generate JWT
    const token = jwt.sign(
      { id: result.rows[0].id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      user: result.rows[0],
      token
    });
  } catch (error) {
    console.error('Error in signup:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  console.log('Login request received:', { body: req.body });
  try {
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Remove password_hash from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Login error details:', { 
      error, 
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body 
    });
    res.status(500).json({ error: 'Failed to login' });
  }
});
router.get('/me', authenticateToken, handleMe);

// Add validation endpoint
router.get('/validate', authenticateToken, (req, res) => {
  // If we get here, the token is valid (authenticateToken middleware validated it)
  res.status(200).json({ valid: true });
});

export default router; 