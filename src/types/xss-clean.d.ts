declare module 'xss-clean' {
  interface XssCleanOptions {
    whiteList?: Record<string, string[]>;
    stripIgnoreTag?: boolean;
    stripIgnoreTagBody?: boolean | string[];
    allowCommentTag?: boolean;
    whiteList?: Record<string, string[]>;
    css?: {
      whiteList?: Record<string, string[]>;
    };
  }

  function xss(input: string, options?: XssCleanOptions): string;
  function xss(): (req: any, res: any, next: any) => void;

  export = xss;
}
