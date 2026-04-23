declare module '@xenova/transformers' {
  export const env: {
    allowLocalModels?: boolean;
    allowRemoteModels?: boolean;
    cacheDir?: string;
    [key: string]: unknown;
  };

  export const AutoTokenizer: {
    from_pretrained: (model: string, options?: Record<string, unknown>) => Promise<any>;
  };

  export const AutoModelForCausalLM: {
    from_pretrained: (model: string, options?: Record<string, unknown>) => Promise<any>;
  };
}
