import { Request, Response } from 'express';
import { User } from '../models/index.js';

interface AuthRequest extends Request {
  user?: any;
  token?: string;
}

export class UserController {
  /**
   * Update user profile information (firstName, lastName, username)
   */
  async updateProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const userId = req.user._id;
      const updateData = req.body;

      // Validate update data
      const allowedFields = ['firstName', 'lastName', 'username'];
      const updateFields: Record<string, unknown> = {};

      for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(updateData, field)) {
          updateFields[field] = updateData[field];
        }
      }

      // Username validation
      if (updateFields.username) {
        const username = String(updateFields.username).toLowerCase().trim();

        // Check for duplicates
        const existingUser = await User.findOne({
          username: username,
          _id: { $ne: userId }
        });

        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: 'Username is already taken',
            field: 'username',
          });
        }

        // Username format validation
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
          return res.status(400).json({
            success: false,
            message: 'Username can only contain letters, numbers, and underscores',
            field: 'username',
          });
        }

        if (username.length < 3 || username.length > 30) {
          return res.status(400).json({
            success: false,
            message: 'Username must be between 3 and 30 characters',
            field: 'username',
          });
        }

        updateFields.username = username;
      }

      // Update user
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        updateFields,
        { new: true, runValidators: true }
      ).select('firstName lastName username email role createdAt updatedAt');

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      return res.json({
        success: true,
        message: 'User profile updated successfully',
        data: {
          _id: updatedUser._id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          username: updatedUser.username,
          role: updatedUser.role,
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt,
          fullName: updatedUser.getFullName(),
        },
      });

    } catch (error: any) {
      console.error('Update user profile error:', error);

      // Handle MongoDB duplicate key errors
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern || {})[0];
        return res.status(409).json({
          success: false,
          message: `${field} already exists`,
          field,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to update user profile',
      });
    }
  }

  /**
   * Get current user profile data
   */
  async getProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const userId = req.user._id;

      const user = await User.findById(userId).select('firstName lastName username email role createdAt updatedAt');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      return res.json({
        success: true,
        data: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          fullName: user.getFullName(),
        },
      });

    } catch (error) {
      console.error('Get user profile error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get user profile',
      });
    }
  }
}

export const userController = new UserController();
