import dotenv from 'dotenv';
dotenv.config();
const authConfig = {
    jwtSecret: (() => {
        if (!process.env['JWT_SECRET']) {
            throw new Error('FATAL ERROR: JWT_SECRET environment variable is not defined.');
        }
        return process.env['JWT_SECRET'];
    })(),
    jwtExpiresIn: process.env['JWT_EXPIRES_IN'] || '7d',
    refreshTokenSecret: (() => {
        if (!process.env['REFRESH_TOKEN_SECRET']) {
            throw new Error('FATAL ERROR: REFRESH_TOKEN_SECRET environment variable is not defined.');
        }
        return process.env['REFRESH_TOKEN_SECRET'];
    })(),
    refreshTokenExpiresIn: process.env['REFRESH_TOKEN_EXPIRES_IN'] || '30d',
    bcryptRounds: parseInt(process.env['BCRYPT_ROUNDS'] || '12', 10),
    passwordMinLength: parseInt(process.env['PASSWORD_MIN_LENGTH'] || '8', 10),
    rateLimitWindowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10), // 15 minutes
    rateLimitMax: parseInt(process.env['RATE_LIMIT_MAX'] || '1000', 10), // Increased API limit for 100k users
};
export default authConfig;
//# sourceMappingURL=auth.js.map