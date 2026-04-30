export declare class EmailVerificationService {
    /**
     * Generate a 6-digit verification code
     */
    private generateVerificationCode;
    /**
     * Send verification code for Google account linking
     */
    sendGoogleLinkingVerification(userId: string, googleToken: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Verify the code and complete Google account linking
     */
    verifyAndLinkGoogleAccount(code: string): Promise<{
        success: boolean;
        message: string;
        data?: any;
    }>;
    /**
     * Resend verification code
     */
    resendVerificationCode(userId: string, type?: 'link_google'): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Send email-only verification for Google account linking (maximum security)
     */
    sendEmailOnlyGoogleLinkingVerification(userId: string, email: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Verify email code and link Google account (email-only flow)
     */
    verifyEmailCodeAndLinkGoogle(userId: string, email: string, code: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Resend email-only verification code for Google account linking
     */
    resendEmailOnlyGoogleLinkingVerification(userId: string, email: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Clean up expired verification codes
     */
    cleanupExpiredCodes(): void;
}
export declare const emailVerificationService: EmailVerificationService;
//# sourceMappingURL=emailVerificationService.d.ts.map