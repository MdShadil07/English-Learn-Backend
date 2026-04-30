import { Request, Response } from 'express';
export declare function createOrderHandler(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function createSubscriptionHandler(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function createSubscriptionProductionHandler(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function confirmPaymentHandler(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function webhookHandler(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function subscriptionSseHandler(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare function taxPreviewHandler(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function getPlansHandler(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function getMySubscriptionHandler(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function getPaymentHandler(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=payment.controller.d.ts.map