/**
 * 🎯 ANALYZER REGISTRY
 * 
 * Central registry for all language analyzers.
 * Enables dynamic analyzer selection and composition.
 */

import { IAnalyzer, AnalyzerFactory, AnalyzerRegistry as IAnalyzerRegistry } from './IAnalyzer.js';

export class AnalyzerRegistry implements IAnalyzerRegistry {
  private analyzers: Map<string, AnalyzerFactory> = new Map();
  private instances: Map<string, IAnalyzer> = new Map();

  register(name: string, factory: AnalyzerFactory): void {
    this.analyzers.set(name, factory);
  }

  get(name: string): IAnalyzer | null {
    // Return existing instance if available
    if (this.instances.has(name)) {
      return this.instances.get(name)!;
    }

    // Create new instance from factory
    const factory = this.analyzers.get(name);
    if (!factory) {
      return null;
    }

    const instance = factory();
    this.instances.set(name, instance);
    return instance;
  }

  getAll(): IAnalyzer[] {
    const allAnalyzers: IAnalyzer[] = [];
    for (const [name, factory] of this.analyzers) {
      if (!this.instances.has(name)) {
        this.instances.set(name, factory());
      }
      allAnalyzers.push(this.instances.get(name)!);
    }
    return allAnalyzers.sort((a, b) => a.getPriority() - b.getPriority());
  }

  async getAvailable(): Promise<IAnalyzer[]> {
    const all = this.getAll();
    const available: IAnalyzer[] = [];
    
    for (const analyzer of all) {
      if (await analyzer.isAvailable()) {
        available.push(analyzer);
      }
    }
    
    return available.sort((a, b) => a.getPriority() - b.getPriority());
  }

  clear(): void {
    this.instances.clear();
  }
}

// Global registry instance
export const analyzerRegistry = new AnalyzerRegistry();
