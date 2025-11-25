import { Router } from 'express';
import { authenticate } from '../../middleware/auth/auth.js';
import optimizedProgressController from '../../controllers/optimizedProgressController.js';

const router = Router();

router.get('/realtime', authenticate, optimizedProgressController.getRealtimeProgress);
router.get('/dashboard', authenticate, optimizedProgressController.getOptimizedDashboard);
router.get('/batch-stats', authenticate, optimizedProgressController.getBatchStats);
router.post('/force-flush', authenticate, optimizedProgressController.forceFlushQueue);

export default router;
