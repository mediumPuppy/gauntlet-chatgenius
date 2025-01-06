import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { User, UserWithPassword, CreateUserDTO, LoginDTO } from '../models/user';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  static async comparePasswords(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateToken(user: User): string {
    return jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  static async createUser(userData: CreateUserDTO): Promise<User> {
    const { email, username, password } = userData;
    const password_hash = await this.hashPassword(password);

    const result = await pool.query(
      `INSERT INTO users (email, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, username, created_at`,
      [email, username, password_hash]
    );

    return result.rows[0];
  }

  static async findUserByEmail(email: string): Promise<UserWithPassword | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    return result.rows[0] || null;
  }

  static async login(credentials: LoginDTO): Promise<{ user: User; token: string } | null> {
    const user = await this.findUserByEmail(credentials.email);
    if (!user) return null;

    const isValidPassword = await this.comparePasswords(credentials.password, user.password_hash);
    if (!isValidPassword) return null;

    // Create a new object without the password_hash
    const { password_hash, ...userWithoutPassword } = user;
    const token = this.generateToken(userWithoutPassword);

    return { user: userWithoutPassword, token };
  }
} 