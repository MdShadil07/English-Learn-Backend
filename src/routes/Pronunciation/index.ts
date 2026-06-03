import { Router } from 'express';
import soloPracticeRoutes from './soloPractice.js';
import visualsRoutes from './visuals.js';
import coachRoutes from './coach.js';

const router = Router();

router.use('/', soloPracticeRoutes);
router.use('/', visualsRoutes);
router.use('/', coachRoutes);

export default router;
