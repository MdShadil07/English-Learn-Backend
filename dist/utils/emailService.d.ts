interface EmailOptions {
    to: string;
    subject: string;
    template?: string;
    data?: Record<string, any>;
    html?: string;
    text?: string;
}
export declare function sendEmail(options: EmailOptions): Promise<void>;
export {};
//# sourceMappingURL=emailService.d.ts.map