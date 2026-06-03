import { Router } from 'express';
import { getCoursesBySection, getCourseBySlug } from '../controllers/course.controller.js';

const router = Router();

router.get('/', getCoursesBySection);
router.get('/:slug', getCourseBySlug);

export default router;
