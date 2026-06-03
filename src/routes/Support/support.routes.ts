import { Router } from 'express';
import { supportController } from '../../controllers/Support/support.controller.js';
import { supportRateLimit } from '../../middleware/security/rateLimit.js';

const router = Router();

router.post('/contact', supportRateLimit, supportController.submitContactRequest.bind(supportController));

export default router;
