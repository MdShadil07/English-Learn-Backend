import { Router, Request } from 'express';
import { authenticate } from '../../middleware/auth/auth.js';
import { User } from '../../models/index.js';

interface AuthRequest extends Request {
  user?: any;
  token?: string;
}

const router = Router();

/**
 * @route GET /api/user/me
 * @desc Get current user information
 * @access Private
 */
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    return res.json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user information',
    });
  }
});

/**
 * @route GET /api/user/:id
 * @desc Get user by ID (admin only)
 * @access Private
 */
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user',
    });
  }
});

/**
 * @route GET /api/user
 * @desc Get all users (admin only)
 * @access Private
 */
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: {
        users,
        count: users.length,
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get users',
    });
  }
});

export default router;
