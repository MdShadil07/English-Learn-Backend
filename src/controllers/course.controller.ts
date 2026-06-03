import { Request, Response } from 'express';
import { Course } from '../models/Course.js';

export const getCoursesBySection = async (req: Request, res: Response) => {
  try {
    const { coreSection, page = '1', limit = '20', search = '' } = req.query;
    
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query: any = { status: 'Published' };
    
    if (coreSection && coreSection !== 'All') {
      query.coreSection = coreSection;
    }

    if (search) {
      query.$text = { $search: search as string };
    }

    const [courses, total] = await Promise.all([
      Course.find(query)
        .select('title slug summary category level language instructor tags modulesCount lessonsCount enrolledCount rating durationMinutes featuredImageUrl thumbnailUrl isFeatured createdAt')
        .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Course.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: courses,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      }
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch courses',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getCourseBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const course = await Course.findOne({ slug, status: 'Published' }).lean();
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    return res.status(200).json({ success: true, data: course });
  } catch (error) {
    console.error('Error fetching course:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch course',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
