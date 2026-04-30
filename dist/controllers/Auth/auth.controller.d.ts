import { Request, Response } from 'express';
interface AuthRequest extends Request {
    user?: any;
    token?: string;
}
export declare class AuthController {
    /**
     * User registration
     */
    register(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * User login
     */
    login(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Refresh access token
     */
    refreshToken(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Logout (revoke refresh token)
     */
    logout(req: AuthRequest, res: Response): Promise<void>;
    /**
     * Logout from all devices
     */
    logoutAll(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get current user profile
     */
    getProfile(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Update user profile
     */
    updateProfile(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Change password
     */
    changePassword(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Request password reset
     */
    requestPasswordReset(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Reset password with token
     */
    resetPassword(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Verify email (placeholder)
     */
    verifyEmail(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Verify Google ID token for sign-in (dual verification: email + Google ID)
     */
    verifyGoogleToken(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Link Google account directly (requires authentication)
     * This is the direct linking method - user must already be logged in
     */
    linkGoogleAccountDirect(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Send email-only verification for Google account linking
     */
    sendEmailOnlyGoogleLinkingVerification(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Verify email code and link Google account
     */
    verifyEmailCodeAndLinkGoogle(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Resend email-only verification code for Google account linking
     */
    resendEmailOnlyGoogleLinkingVerification(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare const authController: AuthController;
export {};
//# sourceMappingURL=auth.controller.d.ts.map