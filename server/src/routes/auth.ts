import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthController } from '../controllers/auth';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateSignup, validateLogin } from '../middleware/validation';
import { authLimiter } from '../middleware/rate-limit';

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
router.post('/signup', validateSignup, handleSignup);
router.post('/login', validateLogin, handleLogin);
router.get('/me', authenticateToken, handleMe);

// Add validation endpoint
router.get('/validate', authenticateToken, (req, res) => {
  // If we get here, the token is valid (authenticateToken middleware validated it)
  res.status(200).json({ valid: true });
});

export default router; 