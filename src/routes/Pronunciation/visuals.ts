import { Router } from 'express';
import visualsMap, { visualsMeta } from '../../services/Pronunciation/phenomena/visuals.js';

const router = Router();

router.get('/visuals', (req, res) => {
  res.json({ success: true, data: { visualsMeta, visualsMap } });
});

export default router;
