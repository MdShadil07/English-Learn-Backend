import { Router } from 'express';
import { authenticate } from '../../middleware/auth/auth.js';
import { pronunciationController } from '../../controllers/Pronunciation/pronunciation.controller.js';
import multer from 'multer';
import os from 'os';

const router = Router();
const chunkUpload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir()
  }),
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
  },
});

router.post('/solo-practice/session', authenticate, pronunciationController.createSession);
router.get('/solo-practice/session/:sessionId', authenticate, pronunciationController.getSession);
router.post('/solo-practice/upload/session', authenticate, pronunciationController.createUploadSession);
router.get('/solo-practice/upload/session/:uploadId', authenticate, pronunciationController.getUploadSession);
router.post('/solo-practice/upload/session/:uploadId/part', authenticate, chunkUpload.single('chunk'), pronunciationController.uploadChunk);
router.post('/solo-practice/upload/session/:uploadId/complete', authenticate, pronunciationController.completeUpload);
router.delete('/solo-practice/upload/session/:uploadId', authenticate, pronunciationController.cancelUpload);
router.post('/solo-practice/session/:sessionId/attempt', authenticate, pronunciationController.submitAttempt);
router.get('/solo-practice/session/:sessionId/attempt/:attemptId', authenticate, pronunciationController.getAttempt);
router.post('/solo-practice/passages/recommend', authenticate, pronunciationController.recommendPassage);

export default router;
