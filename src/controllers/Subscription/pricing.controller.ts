import { Request, Response } from 'express';

/**
 * Get pricing configuration from environment variables
 * This allows admin to update prices without code changes
 */
export async function getPricingConfig(req: Request, res: Response) {
  try {
    const pricing = {
      pro: {
        monthly: parseInt(process.env.PRO_MONTHLY_PRICE || '49900'),
        yearly: parseInt(process.env.PRO_YEARLY_PRICE || '499000'),
      },
      premium: {
        monthly: parseInt(process.env.PREMIUM_MONTHLY_PRICE || '99900'),
        yearly: parseInt(process.env.PREMIUM_YEARLY_PRICE || '999000'),
      },
    };

    return res.json({
      success: true,
      pricing,
    });
  } catch (error) {
    console.error('Get pricing config error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pricing configuration',
    });
  }
}
