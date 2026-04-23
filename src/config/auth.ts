import dotenv from 'dotenv';

dotenv.config();

interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenSecret: string;
  refreshTokenExpiresIn: string;
  bcryptRounds: number;
  passwordMinLength: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
}

const authConfig: AuthConfig = {
  jwtSecret: process.env['JWT_SECRET'] || 'your-super-secret-jwt-key-change-this-in-production',
  jwtExpiresIn: process.env['JWT_EXPIRES_IN'] || '7d',
  refreshTokenSecret: process.env['REFRESH_TOKEN_SECRET'] || 'your-super-secret-refresh-token-key-change-this-in-production',
  refreshTokenExpiresIn: process.env['REFRESH_TOKEN_EXPIRES_IN'] || '30d',
  bcryptRounds: parseInt(process.env['BCRYPT_ROUNDS'] || '12', 10),
  passwordMinLength: parseInt(process.env['PASSWORD_MIN_LENGTH'] || '8', 10),
  rateLimitWindowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10), // 15 minutes
  rateLimitMax: parseInt(process.env['RATE_LIMIT_MAX'] || '100', 10), // 100 requests per window
};

export default authConfig;
