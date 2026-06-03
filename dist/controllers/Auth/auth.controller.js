import crypto from 'crypto';
import { User, RefreshToken, UserProfile } from '../../models/index.js';
import { generateTokens } from '../../middleware/auth/auth.js';
import { redisCache, CACHE_TTL } from '../../config/redis.js';
import subscriptionService from '../../services/Subscription/subscriptionService.js';
import { googleOAuthService } from '../../services/index.js';
import { emailVerificationService } from '../../services/emailVerificationService.js';
import { queueEmail } from '../../services/Email/emailQueueService.js';
export class AuthController {
    /**
     * User registration
     */
    async register(req, res) {
        try {
            let { email, password, firstName, lastName, fullName, username, role = 'student' } = req.body;
            if (!email || typeof email !== 'string') {
                return res.status(400).json({ success: false, message: 'Invalid or missing email', field: 'email' });
            }
            if (!password || typeof password !== 'string') {
                return res.status(400).json({ success: false, message: 'Invalid or missing password', field: 'password' });
            }
            if (username && typeof username !== 'string') {
                return res.status(400).json({ success: false, message: 'Invalid username format', field: 'username' });
            }
            // If fullName is provided, split it into first and last names
            if (fullName && !firstName) {
                const nameParts = fullName.trim().split(' ');
                firstName = nameParts[0] || '';
                lastName = nameParts.slice(1).join(' ') || undefined;
            }
            // Validate required fields
            if (!firstName || firstName.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'First name is required',
                    field: 'firstName',
                });
            }
            // Check if user already exists
            const existingUser = await User.findOne({
                $or: [
                    { email: email.toLowerCase() },
                    ...(username ? [{ username: username.toLowerCase() }] : [])
                ]
            });
            if (existingUser) {
                if (existingUser.email === email.toLowerCase()) {
                    return res.status(409).json({
                        success: false,
                        message: 'User with this email already exists',
                        field: 'email',
                    });
                }
                if (username && existingUser.username === username.toLowerCase()) {
                    return res.status(409).json({
                        success: false,
                        message: 'Username is already taken',
                        field: 'username',
                    });
                }
            }
            // Create new user
            const user = new User({
                email: email.toLowerCase(),
                password,
                firstName: firstName.trim(),
                lastName: lastName ? lastName.trim() : undefined,
                username: username ? username.toLowerCase().trim() : undefined,
                role,
            });
            await user.save();
            // Send welcome email for new user registration
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
                        priority: 'high'
                    });
                    console.log('✅ Welcome email queued for:', user.email);
                    // Mark welcome email as sent
                    user.welcomeEmailSent = true;
                    await user.save();
                }
                catch (emailError) {
                    console.error('❌ Failed to queue welcome email:', emailError);
                    // Don't fail the registration if email fails
                }
            }
            // Generate tokens
            const { accessToken, refreshToken: refreshTokenValue } = generateTokens(user._id.toString(), user.email, user.role);
            // Save refresh token to database
            const refreshTokenDoc = new RefreshToken({
                userId: user._id,
                token: refreshTokenValue,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            });
            await refreshTokenDoc.save();
            // Get subscription details (default free)
            const subDetails = await subscriptionService.getUserSubscription(user._id);
            // Return success response
            return res.status(201).json({
                success: true,
                message: 'Account created successfully',
                data: {
                    user: {
                        id: user._id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        username: user.username,
                        fullName: user.fullName,
                        role: user.role,
                        isVerified: user.isVerified,
                        verificationStatus: user.verificationStatus,
                        tier: subDetails.tier,
                        subscriptionStatus: user.subscription.status,
                        subscriptionPlan: user.subscription.planCode,
                        subscriptionEndDate: user.subscription.expiresAt,
                        subscriptionDetails: subDetails,
                        createdAt: user.createdAt,
                    },
                    tokens: {
                        accessToken,
                        refreshToken: refreshTokenValue,
                    },
                },
            });
        }
        catch (error) {
            console.error('Registration error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create account',
            });
        }
    }
    /**
     * User login
     */
    async login(req, res) {
        try {
            const { email, password } = req.body;
            if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email or password format',
                });
            }
            // Find user by email
            const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password',
                });
            }
            // Check account status
            if (user.accountStatus && user.accountStatus !== 'active') {
                return res.status(401).json({
                    success: false,
                    message: `Account is ${user.accountStatus}`,
                    code: `ACCOUNT_${user.accountStatus.toUpperCase()}`,
                    reason: user.statusReason
                });
            }
            // Debug: ensure password was selected
            if (!user.password || typeof user.password !== 'string') {
                console.warn('Login: password field not present on fetched user (was +password applied?). userId=', user._id ? user._id.toString() : '(unknown)');
            }
            // Verify password
            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password',
                });
            }
            // Generate tokens
            const { accessToken, refreshToken: refreshTokenValue } = generateTokens(user._id.toString(), user.email, user.role);
            // Save refresh token to database (replace existing ones)
            await RefreshToken.revokeAllUserTokens(user._id);
            const refreshTokenDoc = new RefreshToken({
                userId: user._id,
                token: refreshTokenValue,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            });
            await refreshTokenDoc.save();
            // Check subscription status
            const subDetails = await subscriptionService.getUserSubscription(user._id);
            // If expired but user record says active, update it
            if (subDetails.isExpired && user.subscription.status === 'active') {
                user.subscription.status = 'expired';
                await user.save();
            }
            // Return success response
            return res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user: {
                        id: user._id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        username: user.username,
                        fullName: user.fullName,
                        role: user.role,
                        isVerified: user.isVerified,
                        verificationStatus: user.verificationStatus,
                        tier: subDetails.tier,
                        subscriptionStatus: user.subscription.status,
                        subscriptionPlan: user.subscription.planCode,
                        subscriptionEndDate: user.subscription.expiresAt,
                        subscriptionDetails: subDetails,
                        createdAt: user.createdAt,
                    },
                    tokens: {
                        accessToken,
                        refreshToken: refreshTokenValue,
                    },
                },
            });
        }
        catch (error) {
            console.error('Login error:', error);
            return res.status(500).json({
                success: false,
                message: 'Login failed',
            });
        }
    }
    /**
     * Refresh access token
     */
    async refreshToken(req, res) {
        try {
            const { refreshToken: token } = req.body;
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid refresh token',
                });
            }
            // Generate new tokens
            const { accessToken, refreshToken: newRefreshToken } = generateTokens(req.user._id.toString(), req.user.email, req.user.role);
            // Update refresh token in database
            await RefreshToken.findOneAndUpdate({ userId: req.user._id, token }, {
                token: newRefreshToken,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            });
            return res.json({
                success: true,
                message: 'Token refreshed successfully',
                data: {
                    accessToken,
                    refreshToken: newRefreshToken,
                },
            });
        }
        catch (error) {
            console.error('Token refresh error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to refresh token',
            });
        }
    }
    /**
     * Logout (revoke refresh token)
     */
    async logout(req, res) {
        try {
            const { refreshToken: token } = req.body;
            if (req.user && token) {
                await RefreshToken.findOneAndUpdate({ userId: req.user._id, token }, { isRevoked: true });
            }
            res.json({
                success: true,
                message: 'Logged out successfully',
            });
        }
        catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                success: false,
                message: 'Logout failed',
            });
        }
    }
    /**
     * Logout from all devices
     */
    async logoutAll(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
            }
            // Revoke all refresh tokens for this user
            await RefreshToken.revokeAllUserTokens(req.user._id);
            return res.json({
                success: true,
                message: 'Logged out from all devices successfully',
            });
        }
        catch (error) {
            console.error('Logout all error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to logout from all devices',
            });
        }
    }
    /**
     * Get current user profile
     */
    async getProfile(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
            }
            // Check cache first
            const cacheKey = redisCache.getUserCacheKey(req.user._id.toString());
            const cachedProfile = await redisCache.getJSON(cacheKey);
            if (cachedProfile) {
                console.log('🔍 getProfile - Returning cached profile, googleAuth:', JSON.stringify(cachedProfile.googleAuth, null, 2));
                // Prevent browser caching
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
                return res.json({
                    success: true,
                    data: {
                        user: cachedProfile,
                    },
                    cached: true,
                });
            }
            // Fetch user profile data including avatar_url
            const profile = await UserProfile.findOne({ userId: req.user._id })
                .populate('userId', 'email firstName lastName username fullName role isEmailVerified createdAt googleAuth')
                .lean();
            // Get subscription details
            const subDetails = await subscriptionService.getUserSubscription(req.user._id);
            // Merge user data with profile data
            const userData = {
                id: req.user._id,
                email: req.user.email,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                username: req.user.username,
                fullName: req.user.fullName,
                avatar: profile?.avatar_url || null, // Include avatar_url from profile
                role: req.user.role,
                isEmailVerified: req.user.isEmailVerified,
                googleAuth: req.user.googleAuth, // Include Google OAuth data
                tier: subDetails.tier,
                subscriptionStatus: req.user.subscription.status,
                subscriptionPlan: req.user.subscription.planCode,
                subscriptionEndDate: req.user.subscription.expiresAt,
                subscriptionDetails: subDetails,
                createdAt: req.user.createdAt,
                // Include essential profile fields with safe access
                ...(profile && {
                    targetLanguage: profile.targetLanguage,
                    proficiencyLevel: profile.proficiencyLevel,
                    bio: profile.bio,
                    experienceLevel: profile.experienceLevel,
                    field: profile.field,
                    location: profile.location,
                    isPremium: subDetails.tier === 'premium' || subDetails.tier === 'pro',
                    subscriptionStatusLegacy: subDetails.tier === 'premium' ? 'premium' : 'basic',
                })
            };
            // Cache for 5 minutes
            await redisCache.setJSON(cacheKey, userData, CACHE_TTL.USER_PROFILE);
            console.log('🔍 getProfile - userData.googleAuth:', JSON.stringify(userData.googleAuth, null, 2));
            // Prevent browser caching to ensure fresh data
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            return res.json({
                success: true,
                data: {
                    user: userData,
                },
            });
        }
        catch (error) {
            console.error('Get profile error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to get profile',
            });
        }
    }
    /**
     * Update user profile
     */
    async updateProfile(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
            }
            const allowedFields = [
                'firstName',
                'lastName',
                'username',
            ];
            const updates = Object.keys(req.body).reduce((acc, key) => {
                if (allowedFields.includes(key)) {
                    acc[key] = req.body[key];
                }
                return acc;
            }, {});
            // Handle username uniqueness if being updated
            if (updates.username) {
                const existingUser = await User.findOne({
                    username: updates.username.toLowerCase(),
                    _id: { $ne: req.user._id }
                });
                if (existingUser) {
                    return res.status(409).json({
                        success: false,
                        message: 'Username is already taken',
                        field: 'username',
                    });
                }
                updates.username = updates.username.toLowerCase();
            }
            // Update user
            const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found',
                });
            }
            return res.json({
                success: true,
                message: 'Profile updated successfully',
                data: {
                    user: {
                        id: user._id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        username: user.username,
                        fullName: user.fullName,
                        createdAt: user.createdAt,
                        updatedAt: user.updatedAt,
                    },
                },
            });
        }
        catch (error) {
            console.error('Update profile error:', error);
            if (error && typeof error === 'object' && 'name' in error && error.name === 'ValidationError' && 'errors' in error) {
                const validationErrors = Object.values(error.errors).map((err) => ({
                    field: err.path,
                    message: err.message,
                }));
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: validationErrors,
                });
            }
            return res.status(500).json({
                success: false,
                message: 'Failed to update profile',
            });
        }
    }
    /**
     * Change password
     */
    async changePassword(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
            }
            const { currentPassword, newPassword } = req.body;
            // Verify current password
            const isCurrentPasswordValid = await req.user.comparePassword(currentPassword);
            if (!isCurrentPasswordValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Current password is incorrect',
                });
            }
            // Update password
            req.user.password = newPassword;
            await req.user.save();
            // Revoke all refresh tokens for security
            await RefreshToken.revokeAllUserTokens(req.user._id);
            return res.json({
                success: true,
                message: 'Password changed successfully. Please login again.',
            });
        }
        catch (error) {
            console.error('Change password error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to change password',
            });
        }
    }
    /**
     * Request password reset
     */
    async requestPasswordReset(req, res) {
        try {
            const { email } = req.body;
            if (!email || typeof email !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid or missing email format',
                });
            }
            const user = await User.findOne({ email: email.toLowerCase() });
            if (!user) {
                // Anti-enumeration: Don't reveal if email exists or not
                return res.json({
                    success: true,
                    message: 'If the email exists, a password reset link has been sent.',
                });
            }
            // Generate secure 32-byte crypto token
            const resetToken = crypto.randomBytes(32).toString('hex');
            // Security measure: Hash the token using SHA-256 before saving to DB
            // This protects users even if the database is leaked
            const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
            // Set token and expiration (1 hour)
            user.resetPasswordToken = hashedToken;
            user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
            await user.save();
            // Send password reset email with unhashed token
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
            try {
                await queueEmail({
                    to: user.email,
                    subject: 'Password Reset Request',
                    template: 'password-reset', // Assuming there's a password-reset template, otherwise fallback to plain text body if generic template exists
                    data: {
                        userName: user.fullName || user.firstName,
                        resetUrl: resetUrl,
                        appUrl: frontendUrl,
                    },
                    priority: 'high'
                });
            }
            catch (emailError) {
                console.error('Failed to queue password reset email:', emailError);
                // Clear tokens if email fails to send
                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;
                await user.save();
                return res.status(500).json({
                    success: false,
                    message: 'Error sending password reset email. Please try again later.',
                });
            }
            return res.json({
                success: true,
                message: 'If the email exists, a password reset link has been sent.',
            });
        }
        catch (error) {
            console.error('Password reset request error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to process password reset request',
            });
        }
    }
    /**
     * Reset password with token
     */
    async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;
            if (!token || !newPassword || newPassword.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid token and a new password (min 8 chars) are required.',
                });
            }
            // Hash the received token to compare with the one in DB
            const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
            // Find user with matching token and unexpired expiration
            // Note: We need to use findOne with explicit +resetPasswordToken since it's select: false
            const user = await User.findOne({
                resetPasswordToken: hashedToken,
                resetPasswordExpires: { $gt: new Date() },
            }).select('+resetPasswordToken +resetPasswordExpires');
            if (!user) {
                return res.status(400).json({
                    success: false,
                    message: 'Password reset token is invalid or has expired.',
                });
            }
            // Update password
            user.password = newPassword;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            // Save user (pre-save hook will hash the new password via bcrypt)
            await user.save();
            // Security measure: Revoke all refresh tokens instantly to terminate compromised sessions
            await RefreshToken.revokeAllUserTokens(user._id);
            return res.json({
                success: true,
                message: 'Password has been successfully reset. You can now log in with your new password.',
            });
        }
        catch (error) {
            console.error('Password reset error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to reset password',
            });
        }
    }
    /**
     * Verify email (placeholder)
     */
    async verifyEmail(req, res) {
        try {
            const { token } = req.query;
            // TODO: Implement email verification
            return res.json({
                success: true,
                message: 'Email verification functionality will be implemented soon.',
            });
        }
        catch (error) {
            console.error('Email verification error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to verify email',
            });
        }
    }
    /**
     * Verify Google ID token for sign-in (dual verification: email + Google ID)
     */
    async verifyGoogleToken(req, res) {
        try {
            const { idToken } = req.body;
            if (!idToken) {
                return res.status(400).json({
                    success: false,
                    message: 'Google ID token is required',
                });
            }
            const result = await googleOAuthService.verifyIdToken(idToken);
            if (!result.success) {
                return res.status(401).json(result);
            }
            return res.json(result);
        }
        catch (error) {
            console.error('Google token verification error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to verify Google token',
            });
        }
    }
    /**
     * Link Google account directly (requires authentication)
     * This is the direct linking method - user must already be logged in
     */
    async linkGoogleAccountDirect(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
            }
            const { googleToken } = req.body;
            if (!googleToken) {
                return res.status(400).json({
                    success: false,
                    message: 'Google token is required',
                });
            }
            const result = await googleOAuthService.linkGoogleAccount(req.user._id.toString(), googleToken);
            if (!result.success) {
                return res.status(400).json(result);
            }
            return res.json(result);
        }
        catch (error) {
            console.error('Google account linking error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to link Google account',
            });
        }
    }
    /**
     * Send email-only verification for Google account linking
     */
    async sendEmailOnlyGoogleLinkingVerification(req, res) {
        try {
            const { email } = req.body;
            const userId = req.user?.id || req.user?._id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User authentication required',
                });
            }
            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: 'Email is required',
                });
            }
            const result = await emailVerificationService.sendEmailOnlyGoogleLinkingVerification(userId, email);
            return res.json(result);
        }
        catch (error) {
            console.error('Email-only Google linking verification error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to send verification code',
            });
        }
    }
    /**
     * Verify email code and link Google account
     */
    async verifyEmailCodeAndLinkGoogle(req, res) {
        try {
            const { code, email } = req.body;
            const userId = req.user?.id || req.user?._id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User authentication required',
                });
            }
            if (!code) {
                return res.status(400).json({
                    success: false,
                    message: 'Verification code is required',
                });
            }
            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: 'Email is required',
                });
            }
            const result = await emailVerificationService.verifyEmailCodeAndLinkGoogle(userId, email, code);
            if (!result.success) {
                return res.status(400).json(result);
            }
            // Invalidate Redis cache for this user
            await redisCache.invalidateUserCache(userId);
            console.log('🗑️ Cache invalidated for user:', userId);
            // Fetch updated user data to return to frontend
            const { User } = await import('../../models/index.js');
            const updatedUser = await User.findById(userId).select('-password');
            // Prevent browser caching
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            console.log('🔍 verifyEmailCodeAndLinkGoogle - updatedUser.googleAuth:', JSON.stringify(updatedUser?.googleAuth, null, 2));
            return res.json({
                success: true,
                message: 'Google account linked successfully!',
                data: {
                    user: updatedUser
                }
            });
        }
        catch (error) {
            console.error('Email-only Google account verification error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to verify and link Google account',
            });
        }
    }
    /**
     * Resend email-only verification code for Google account linking
     */
    async resendEmailOnlyGoogleLinkingVerification(req, res) {
        try {
            const { email } = req.body;
            const userId = req.user?.id || req.user?._id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User authentication required',
                });
            }
            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: 'Email is required',
                });
            }
            const result = await emailVerificationService.resendEmailOnlyGoogleLinkingVerification(userId, email);
            return res.json(result);
        }
        catch (error) {
            console.error('Resend email-only Google linking verification error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to resend verification code',
            });
        }
    }
}
export const authController = new AuthController();
//# sourceMappingURL=auth.controller.js.map