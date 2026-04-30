import crypto from 'crypto';
import { User } from '../models/index.js';
import { sendEmail } from '../utils/emailService.js';

interface EmailVerificationData {
  userId: string;
  email: string;
  googleToken?: string;
  type: 'link_google' | 'verify_email';
  expiresAt: Date;
}

// In-memory storage for verification codes (in production, use Redis or database)
const verificationCodes = new Map<string, EmailVerificationData>();

export class EmailVerificationService {
  /**
   * Generate a 6-digit verification code
   */
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send verification code for Google account linking
   */
  async sendGoogleLinkingVerification(userId: string, googleToken: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Generate verification code
      const code = this.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store verification data
      const verificationData: EmailVerificationData = {
        userId,
        email: user.email,
        googleToken,
        type: 'link_google',
        expiresAt
      };
      verificationCodes.set(code, verificationData);

      // Send verification email
      await sendEmail({
        to: user.email,
        subject: 'Verify Google Account Linking - English Learning Platform',
        template: 'google-linking-verification',
        data: {
          userName: user.firstName || user.email,
          verificationCode: code,
          expiresAt: expiresAt.toLocaleTimeString()
        }
      });

      return { 
        success: true, 
        message: 'Verification code sent to your email. Please check your inbox.' 
      };
    } catch (error) {
      console.error('Error sending Google linking verification:', error);
      return { 
        success: false, 
        message: 'Failed to send verification code. Please try again.' 
      };
    }
  }

  /**
   * Verify the code and complete Google account linking
   */
  async verifyAndLinkGoogleAccount(code: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const verificationData = verificationCodes.get(code);
      
      if (!verificationData) {
        return { success: false, message: 'Invalid or expired verification code' };
      }

      if (verificationData.expiresAt < new Date()) {
        verificationCodes.delete(code);
        return { success: false, message: 'Verification code has expired' };
      }

      if (verificationData.type !== 'link_google') {
        return { success: false, message: 'Invalid verification type' };
      }

      // Get user
      const user = await User.findById(verificationData.userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Import Google OAuth service
      const { googleOAuthService } = await import('./Auth/googleOAuthService.js');
      
      // Verify Google token and link account
      const result = await googleOAuthService.linkGoogleAccount(
        verificationData.userId, 
        verificationData.googleToken!
      );

      if (!result.success) {
        return { success: false, message: result.message };
      }

      // Clean up verification code
      verificationCodes.delete(code);

      return {
        success: true,
        message: 'Google account linked successfully!',
        data: result.data
      };
    } catch (error) {
      console.error('Error verifying Google linking:', error);
      return { 
        success: false, 
        message: 'Failed to verify and link Google account. Please try again.' 
      };
    }
  }

  /**
   * Resend verification code
   */
  async resendVerificationCode(userId: string, type: 'link_google' = 'link_google'): Promise<{ success: boolean; message: string }> {
    try {
      // Find existing verification code for this user and type
      let existingCode: string | null = null;
      for (const [code, data] of verificationCodes.entries()) {
        if (data.userId === userId && data.type === type && data.expiresAt > new Date()) {
          existingCode = code;
          break;
        }
      }

      if (existingCode) {
        const verificationData = verificationCodes.get(existingCode)!;
        
        // Resend the same code
        const user = await User.findById(userId);
        if (!user) {
          return { success: false, message: 'User not found' };
        }

        await sendEmail({
          to: user.email,
          subject: 'Resend: Verify Google Account Linking - English Learning Platform',
          template: 'google-linking-verification',
          data: {
            userName: user.firstName || user.email,
            verificationCode: existingCode,
            expiresAt: verificationData.expiresAt.toLocaleTimeString()
          }
        });

        return { 
          success: true, 
          message: 'Verification code resent to your email.' 
        };
      } else {
        return { success: false, message: 'No active verification request found. Please start the linking process again.' };
      }
    } catch (error) {
      console.error('Error resending verification code:', error);
      return { 
        success: false, 
        message: 'Failed to resend verification code. Please try again.' 
      };
    }
  }

  /**
   * Send email-only verification for Google account linking (maximum security)
   */
  async sendEmailOnlyGoogleLinkingVerification(userId: string, email: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Verify the email matches the user's email
      if (user.email !== email) {
        return { success: false, message: 'Email does not match your account email' };
      }

      // Generate verification code
      const code = this.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store verification data (no Google token needed for email-only flow)
      const verificationData: EmailVerificationData = {
        userId,
        email: user.email,
        type: 'link_google',
        expiresAt
      };
      verificationCodes.set(code, verificationData);

      // Send verification email
      await sendEmail({
        to: user.email,
        subject: 'Verify Google Account Linking - English Learning Platform',
        template: 'google-linking-verification',
        data: {
          userName: user.firstName || user.email,
          verificationCode: code,
          expiresAt: expiresAt.toLocaleTimeString()
        }
      });

      return { 
        success: true, 
        message: 'Verification code sent to your email.' 
      };
    } catch (error) {
      console.error('Error sending email-only Google linking verification:', error);
      return { 
        success: false, 
        message: 'Failed to send verification code. Please try again.' 
      };
    }
  }

  /**
   * Verify email code and link Google account (email-only flow)
   */
  async verifyEmailCodeAndLinkGoogle(userId: string, email: string, code: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Verify the email matches the user's email
      if (user.email !== email) {
        return { success: false, message: 'Email does not match your account email' };
      }

      // Check verification code
      const verificationData = verificationCodes.get(code);
      if (!verificationData) {
        return { success: false, message: 'Invalid or expired verification code' };
      }

      // Check if code has expired
      if (verificationData.expiresAt < new Date()) {
        verificationCodes.delete(code);
        return { success: false, message: 'Verification code has expired' };
      }

      // Verify user ID matches
      if (verificationData.userId !== userId) {
        return { success: false, message: 'Invalid verification code' };
      }

      // Verify email matches
      if (verificationData.email !== email) {
        return { success: false, message: 'Email does not match verification request' };
      }

      // Link Google account (create a placeholder Google auth entry)
      // Use email as a temporary googleId until actual Google sign-in
      const tempGoogleId = `email_${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      console.log('🔗 Linking Google account for user:', userId);
      console.log('📧 Email:', email);
      console.log('🆔 Temporary Google ID:', tempGoogleId);
      
      const updateResult = await User.findByIdAndUpdate(userId, {
        $set: {
          'googleAuth': {
            googleId: tempGoogleId,
            isLinked: true,
            linkedAt: new Date(),
            linkedBy: 'email_verification',
            email: email,
            profilePicture: null
          }
        }
      }, { new: true });
      
      console.log('✅ Google account linked successfully');
      console.log('📊 Updated user googleAuth:', updateResult?.googleAuth);

      // Clean up verification code
      verificationCodes.delete(code);

      return { 
        success: true, 
        message: 'Google account linked successfully!' 
      };
    } catch (error) {
      console.error('Error verifying email code and linking Google account:', error);
      return { 
        success: false, 
        message: 'Failed to link Google account. Please try again.' 
      };
    }
  }

  /**
   * Resend email-only verification code for Google account linking
   */
  async resendEmailOnlyGoogleLinkingVerification(userId: string, email: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Verify the email matches the user's email
      if (user.email !== email) {
        return { success: false, message: 'Email does not match your account email' };
      }

      // Find existing verification code for this user
      let existingCode = null;
      let verificationData = null;
      
      for (const [code, data] of verificationCodes.entries()) {
        if (data.userId === userId && data.email === email && data.type === 'link_google') {
          existingCode = code;
          verificationData = data;
          break;
        }
      }

      if (existingCode && verificationData) {
        // Update expiration time
        verificationData.expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        verificationCodes.set(existingCode, verificationData);

        // Resend email with existing code
        await sendEmail({
          to: user.email,
          subject: 'Resend: Verify Google Account Linking - English Learning Platform',
          template: 'google-linking-verification',
          data: {
            userName: user.firstName || user.email,
            verificationCode: existingCode,
            expiresAt: verificationData.expiresAt.toLocaleTimeString()
          }
        });

        return { 
          success: true, 
          message: 'Verification code resent to your email.' 
        };
      } else {
        return { success: false, message: 'No active verification request found. Please start the linking process again.' };
      }
    } catch (error) {
      console.error('Error resending email-only verification code:', error);
      return { 
        success: false, 
        message: 'Failed to resend verification code. Please try again.' 
      };
    }
  }

  /**
   * Clean up expired verification codes
   */
  cleanupExpiredCodes(): void {
    const now = new Date();
    for (const [code, data] of verificationCodes.entries()) {
      if (data.expiresAt < now) {
        verificationCodes.delete(code);
      }
    }
  }
}

// Auto-cleanup expired codes every 5 minutes
setInterval(() => {
  const service = new EmailVerificationService();
  service.cleanupExpiredCodes();
}, 5 * 60 * 1000);

export const emailVerificationService = new EmailVerificationService();
