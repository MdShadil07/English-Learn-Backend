import { IErrorDetector, ICache } from './interface.js';
import { ErrorDetail, AnalysisConfig } from './types.js';
export declare class LanguageToolDetector implements IErrorDetector {
    name: string;
    priority: number;
    private baseURL;
    private cache;
    constructor(baseURL: string | undefined, cache: ICache);
    detect(text: string, config: AnalysisConfig): Promise<ErrorDetail[]>;
    isAvailable(): Promise<boolean>;
    getConfidence(): number;
    private convertToErrorDetail;
    private mapCategoryToType;
    private mapIssueSeverity;
}
//# sourceMappingURL=LanguageToolDetector.d.ts.map