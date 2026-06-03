import { Request, Response } from 'express';
export declare class AccuracyController {
    /**
     * * 💎 Analyze message with tier-based premium features
     *
     * FREE: Basic grammar (7 patterns), simple feedback
     * PRO: Advanced grammar (20+ patterns), tone analysis, readability, detailed explanations
     * PREMIUM: Everything + AI analysis, coherence, style, idiomatic suggestions, learning path
     *
     * ✅ NOW SAVES TO PROGRESS SCHEMA (optimized with debouncing & caching)
     * Analyze message accuracy
     */
    analyzeMessage(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get real-time accuracy insights and trends
     * GET /api/accuracy/insights/:userId
     */
    getAccuracyInsights(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Get proficiency level based on overall accuracy
     */
    private getProficiencyLevel;
    /**
     * Generate quick recommendations for insights endpoint
     */
    private generateQuickRecommendations;
    /**
     * Get message analysis history (placeholder)
     */
    getAnalysisHistory(req: Request, res: Response): Promise<void>;
}
export declare const accuracyController: AccuracyController;
//# sourceMappingURL=accuracy.controller.d.ts.map