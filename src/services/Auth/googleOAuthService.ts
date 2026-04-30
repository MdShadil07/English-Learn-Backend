import { google } from "googleapis";
import { OAuth2Client } from 'google-auth-library';
import { googleOAuthConfig, validateGoogleOAuthConfig } from '../../config/googleOAuth.js';
import { User, RefreshToken } from '../../models/index.js';
import { generateTokens } from '../../middleware/auth/auth.js';
import subscriptionService from '../Subscription/subscriptionService.js';
import { queueEmail } from '../Email/emailQueueService.js';

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

class GoogleOAuthService {
  private oauth2Client: OAuth2Client;

  constructor() {
    validateGoogleOAuthConfig();
    
    this.oauth2Client = new google.auth.OAuth2(
      googleOAuthConfig.clientId,
      googleOAuthConfig.clientSecret,
      googleOAuthConfig.redirectUri
    );
  }

  /**
   * Get Google OAuth authorization URL
   */
  getAuthUrl(state?: string): string {
    const scopes = googleOAuthConfig.scope;
    
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state || '',
      prompt: 'consent',
    });
  }

  /**
   * Exchange authorization code for tokens and get user info
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleAuthResult> {
    try {
      // Exchange code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Get user info
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      return await this.handleGoogleAuth(userInfo.data as GoogleUserInfo);
    } catch (error) {
      console.error('Google OAuth token exchange error:', error);
      return {
        success: false,
        message: 'Failed to authenticate with Google',
      };
    }
  }

  /**
   * Verify Google ID token (for client-side authentication)
   */
  async verifyIdToken(token: string): Promise<GoogleAuthResult> {
    try {
      // Check if this is an access token or ID token
      if (token.startsWith('ya29.') || token.startsWith('ya30.')) {
        // This is an access token, get user info from Google API
        const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${token}`);
        if (!response.ok) {
          throw new Error('Failed to fetch user info with access token');
        }
        
        const userInfo: any = await response.json();
        
        const googleUserInfo: GoogleUserInfo = {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          given_name: userInfo.given_name,
          family_name: userInfo.family_name,
          picture: userInfo.picture,
          verified_email: userInfo.verified_email || false,
        };

        return await this.handleGoogleAuth(googleUserInfo);
      } else {
        // This is an ID token, verify it directly
        const ticket = await this.oauth2Client.verifyIdToken({
          idToken: token,
          audience: googleOAuthConfig.clientId,
        });

        const payload = ticket.getPayload();
        if (!payload) {
          throw new Error('Invalid token payload');
        }

        const userInfo: GoogleUserInfo = {
          id: payload.sub!,
          email: payload.email!,
          name: payload.name!,
          given_name: payload.given_name!,
          family_name: payload.family_name!,
          picture: payload.picture!,
          verified_email: payload.email_verified || false,
        };

        return await this.handleGoogleAuth(userInfo);
      }
    } catch (error) {
      console.error('Google token verification error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to verify Google token',
      };
    }
  }

  /**
   * Link Google account to existing user (after manual login verification)
   */
  async linkGoogleAccount(userId: string, googleToken: string): Promise<GoogleAuthResult> {
    try {
      // Verify the Google token first
      const tokenResult = await this.verifyIdToken(googleToken);
      if (!tokenResult.success) {
        return tokenResult;
      }

      // Get Google user info
      let googleUserInfo: GoogleUserInfo;
      
      if (googleToken.startsWith('ya29.') || googleToken.startsWith('ya30.')) {
        // Access token
        const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${googleToken}`);
        if (!response.ok) {
          throw new Error('Failed to fetch user info with access token');
        }
        const userInfo: any = await response.json();
        googleUserInfo = {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          given_name: userInfo.given_name,
          family_name: userInfo.family_name,
          picture: userInfo.picture,
          verified_email: userInfo.verified_email || false,
        };
      } else {
        // ID token
        const ticket = await this.oauth2Client.verifyIdToken({
          idToken: googleToken,
          audience: googleOAuthConfig.clientId,
        });
        const payload = ticket.getPayload();
        if (!payload) {
          throw new Error('Invalid token payload');
        }
        googleUserInfo = {
          id: payload.sub!,
          email: payload.email!,
          name: payload.name!,
          given_name: payload.given_name!,
          family_name: payload.family_name!,
          picture: payload.picture!,
          verified_email: payload.email_verified || false,
        };
      }

      // Check if this Google ID is already linked to another account
      const existingGoogleUser = await User.findOne({ 'googleAuth.googleId': googleUserInfo.id });
      if (existingGoogleUser && existingGoogleUser._id.toString() !== userId) {
        return {
          success: false,
          message: 'This Google account is already linked to another account.',
          code: 'GOOGLE_ALREADY_LINKED'
        };
      }

      // Update the user's Google auth info
      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found.',
          code: 'USER_NOT_FOUND'
        };
      }

      user.googleAuth = {
        googleId: googleUserInfo.id,
        accessToken: '',
        refreshToken: '',
        email: googleUserInfo.email,
        profilePicture: googleUserInfo.picture,
        isLinked: true,
        linkedAt: new Date(),
        linkedBy: 'manual',
      };

      await user.save();

      return {
        success: true,
        message: 'Google account linked successfully!',
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            googleAuth: user.googleAuth,
          },
          tokens: {
            accessToken: '',
            refreshToken: ''
          } // No new tokens needed for linking
        }
      };
    } catch (error) {
      console.error('Google account linking error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to link Google account',
      };
    }
  }

  /**
   * Handle Google authentication (login or register)
   */
  private async handleGoogleAuth(userInfo: GoogleUserInfo): Promise<GoogleAuthResult> {
    try {
      // First check if user exists by Google ID (most secure)
      let user = await User.findOne({ 'googleAuth.googleId': userInfo.id });

      if (user) {
        // User exists with this Google ID - check if account is linked
        if (!user.googleAuth?.isLinked) {
          return {
            success: false,
            message: 'Account not linked. Please sign in with email/password first to link your Google account.',
            code: 'ACCOUNT_NOT_LINKED'
          };
        }

        // Update last login
        user.lastLoginAt = new Date();
        await user.save();
      } else {
        // Check if user exists by email (potential account linking scenario)
        const emailUser = await User.findOne({ email: userInfo.email.toLowerCase() });

        if (emailUser) {
          // User exists by email but not linked with Google ID
          if (!emailUser.googleAuth?.isLinked) {
            return {
              success: false,
              message: 'Email account exists but not linked with Google. Please sign in with your email/password first, then link your Google account in settings.',
              code: 'EMAIL_EXISTS_NOT_LINKED'
            };
          } else {
            // Email user exists but has different Google ID - security breach attempt
            return {
              success: false,
              message: 'Security alert: This Google account is already linked to a different account. Please contact support.',
              code: 'GOOGLE_ID_MISMATCH'
            };
          }
        }

        // Create new user (first-time Google sign-up)
        const nameParts = userInfo.name.split(' ');
        user = new User({
          email: userInfo.email.toLowerCase(),
          firstName: userInfo.given_name || nameParts[0] || '',
          lastName: userInfo.family_name || nameParts.slice(1).join(' ') || '',
          googleAuth: {
            googleId: userInfo.id,
            accessToken: '',
            refreshToken: '',
            email: userInfo.email,
            profilePicture: userInfo.picture,
            isLinked: true,
            linkedAt: new Date(),
            linkedBy: 'sso_first_time',
          },
          isEmailVerified: userInfo.verified_email,
          lastLoginAt: new Date(),
        });

        await user.save();

        // Send welcome email for first-time sign-up using queue
        // Only send if welcome email hasn't been sent yet
        if (!user.welcomeEmailSent) {
          try {
            await queueEmail({
              to: user.email,
              subject: 'Welcome to CognitoSpeak! 🎉',
              template: 'welcome',
              data: {
                userName: user.fullName,
                appUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
              },
              priority: 'high', // Welcome emails are high priority
            });
            console.log('✅ Welcome email queued for:', user.email);
            
            // Mark welcome email as sent
            user.welcomeEmailSent = true;
            await user.save();
          } catch (emailError) {
            console.error('❌ Failed to queue welcome email:', emailError);
            // Don't fail the signup if email fails
          }
        }
      }

      // Generate tokens
      const { accessToken, refreshToken: refreshTokenValue } = generateTokens(
        user._id.toString(),
        user.email,
        user.role
      );

      // Save refresh token to database
      await RefreshToken.revokeAllUserTokens(user._id);
      const refreshTokenDoc = new RefreshToken({
        userId: user._id,
        token: refreshTokenValue,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });
      await refreshTokenDoc.save();

      // Get subscription details
      const subDetails = await subscriptionService.getUserSubscription(user._id);

      return {
        success: true,
        message: 'Authentication successful',
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            fullName: user.fullName,
            avatar: user.googleAuth?.profilePicture,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
            tier: subDetails.tier,
            subscriptionStatus: user.subscription.status,
            subscriptionPlan: user.subscription.planCode,
            subscriptionEndDate: user.subscription.expiresAt,
            subscriptionDetails: subDetails,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
          },
          tokens: {
            accessToken,
            refreshToken: refreshTokenValue,
          },
        },
      };
    } catch (error) {
      console.error('Google auth handling error:', error);
      return {
        success: false,
        message: 'Failed to process Google authentication',
      };
    }
  }

  /**
   * Revoke Google access token
   */
  async revokeToken(token: string): Promise<boolean> {
    try {
      await this.oauth2Client.revokeToken(token);
      return true;
    } catch (error) {
      console.error('Google token revocation error:', error);
      return false;
    }
  }
}

export const googleOAuthService = new GoogleOAuthService();
