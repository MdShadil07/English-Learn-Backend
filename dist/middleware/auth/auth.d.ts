import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: any;
    token?: string;
}
interface JWTPayload {
    userId: string;
    email: string;
    role: string;
    type: 'access' | 'refresh';
}
export declare const generateTokens: (userId: string, email: string, role: string) => {
    accessToken: string;
    refreshToken: string;
};
export declare const verifyToken: (token: string, secret: string) => Promise<JWTPayload>;
export declare const authenticate: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const refreshAuthToken: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const optionalAuth: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireTeacherOrAdmin: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireEmailVerification: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export {};
//# sourceMappingURL=auth.d.ts.map