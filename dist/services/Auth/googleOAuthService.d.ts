export interface GoogleUserInfo {
    id: string;
    email: string;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    verified_email: boolean;
}
export interface GoogleAuthResult {
    success: boolean;
    message: string;
    code?: string;
    data?: {
        user: any;
        tokens: {
            accessToken: string;
            refreshToken: string;
        };
    };
}
declare class GoogleOAuthService {
    private oauth2Client;
    constructor();
    /**
     * Get Google OAuth authorization URL
     */
    getAuthUrl(state?: string): string;
    /**
     * Exchange authorization code for tokens and get user info
     */
    exchangeCodeForTokens(code: string): Promise<GoogleAuthResult>;
    /**
     * Verify Google ID token (for client-side authentication)
     */
    verifyIdToken(token: string): Promise<GoogleAuthResult>;
    /**
     * Link Google account to existing user (after manual login verification)
     */
    linkGoogleAccount(userId: string, googleToken: string): Promise<GoogleAuthResult>;
    /**
     * Handle Google authentication (login or register)
     */
    private handleGoogleAuth;
    /**
     * Revoke Google access token
     */
    revokeToken(token: string): Promise<boolean>;
}
export declare const googleOAuthService: GoogleOAuthService;
export {};
//# sourceMappingURL=googleOAuthService.d.ts.map