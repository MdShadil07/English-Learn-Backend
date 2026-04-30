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
declare const authConfig: AuthConfig;
export default authConfig;
//# sourceMappingURL=auth.d.ts.map