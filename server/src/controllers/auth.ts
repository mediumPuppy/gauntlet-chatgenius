import { Request, Response } from 'express';
import { AuthService } from '../services/auth';
import { CreateUserDTO, LoginDTO } from '../models/user';

export class AuthController {
  static async signup(req: Request, res: Response): Promise<void> {
    try {
      const userData: CreateUserDTO = req.body;

      // Validate required fields
      if (!userData.email || !userData.password || !userData.username) {
        res.status(400).json({ error: 'All fields are required' });
        return;
      }

      // Check if user already exists
      const existingUser = await AuthService.findUserByEmail(userData.email);
      if (existingUser) {
        res.status(400).json({ error: 'Email already registered' });
        return;
      }

      // Create new user
      const user = await AuthService.createUser(userData);
      const token = AuthService.generateToken(user);

      res.status(201).json({ user, token });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ error: 'Error creating user' });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const credentials: LoginDTO = req.body;

      // Validate required fields
      if (!credentials.email || !credentials.password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      // Attempt login
      const result = await AuthService.login(credentials);
      if (!result) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Error during login' });
    }
  }
} 