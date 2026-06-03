import * as fs from 'fs/promises';
import type { AlignmentPhoneInterval, AlignmentWordInterval } from './types.js';

interface TextGridItem {
  name: string;
  intervals: Array<{
    xmin: number;
    xmax: number;
    text: string;
  }>;
}

const normalizeWord = (word: string) => word.toLowerCase().replace(/[^a-z']/g, '');
const SILENCE_LABELS = new Set(['', 'SIL', 'SP', 'SPN', '<SIL>', '<SPOKEN_NOISE>']);

export class TextGridParser {
  async parseFile(filePath: string) {
    const content = await fs.readFile(filePath, 'utf8');
    return this.parse(content);
  }

  parse(content: string): { words: AlignmentWordInterval[]; phones: AlignmentPhoneInterval[] } {
    const items = this.extractItems(content);
    const wordTier = items.find((item) => ['words', 'word', 'transcription'].includes(item.name.toLowerCase()));
    const phoneTier = items.find((item) => ['phones', 'phone', 'phonemes', 'segments'].includes(item.name.toLowerCase()));

    const phones: AlignmentPhoneInterval[] = (phoneTier?.intervals || [])
      .filter((interval) => !SILENCE_LABELS.has(interval.text.trim().toUpperCase()))
      .map((interval) => ({
        phoneme: interval.text.trim().toUpperCase(),
        startTime: Math.round(interval.xmin * 1000),
        endTime: Math.round(interval.xmax * 1000),
        durationMs: Math.max(0, Math.round((interval.xmax - interval.xmin) * 1000)),
        source: 'mfa',
      }));

    const words: AlignmentWordInterval[] = (wordTier?.intervals || [])
      .filter((interval) => normalizeWord(interval.text))
      .map((interval) => {
        const startTime = Math.round(interval.xmin * 1000);
        const endTime = Math.round(interval.xmax * 1000);
        return {
          word: interval.text.trim(),
          normalizedWord: normalizeWord(interval.text),
          startTime,
          endTime,
          durationMs: Math.max(0, endTime - startTime),
          phonemes: phones.filter((phone) => this.overlaps(phone, startTime, endTime)),
        };
      });

    return { words, phones };
  }

  private overlaps(phone: AlignmentPhoneInterval, wordStartMs: number, wordEndMs: number) {
    const overlapStart = Math.max(phone.startTime, wordStartMs);
    const overlapEnd = Math.min(phone.endTime, wordEndMs);
    const overlap = Math.max(0, overlapEnd - overlapStart);
    const phoneDuration = Math.max(1, phone.durationMs);
    return overlap / phoneDuration >= 0.5;
  }

  private extractItems(content: string): TextGridItem[] {
    const lines = content.split(/\r?\n/);
    const items: TextGridItem[] = [];
    let currentItem: TextGridItem | null = null;
    let currentInterval: { xmin?: number; xmax?: number; text?: string } | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (line.startsWith('item [')) {
        if (currentItem) {
          this.pushPendingInterval(currentItem, currentInterval);
          items.push(currentItem);
        }
        currentItem = { name: '', intervals: [] };
        currentInterval = null;
        continue;
      }

      if (!currentItem) {
        continue;
      }

      if (line.startsWith('name =')) {
        currentItem.name = this.extractQuotedValue(line);
        continue;
      }

      if (line.startsWith('intervals [')) {
        this.pushPendingInterval(currentItem, currentInterval);
        currentInterval = {};
        continue;
      }

      if (!currentInterval) {
        continue;
      }

      if (line.startsWith('xmin =')) {
        currentInterval.xmin = Number(line.split('=').pop()?.trim() || 0);
      } else if (line.startsWith('xmax =')) {
        currentInterval.xmax = Number(line.split('=').pop()?.trim() || 0);
      } else if (line.startsWith('text =')) {
        currentInterval.text = this.extractQuotedValue(line);
      }
    }

    if (currentItem) {
      this.pushPendingInterval(currentItem, currentInterval);
      items.push(currentItem);
    }

    return items;
  }

  private pushPendingInterval(
    item: TextGridItem,
    interval: { xmin?: number; xmax?: number; text?: string } | null
  ) {
    if (interval?.xmin === undefined || interval?.xmax === undefined) {
      return;
    }

    item.intervals.push({
      xmin: interval.xmin,
      xmax: interval.xmax,
      text: interval.text || '',
    });
  }

  private extractQuotedValue(line: string) {
    const match = line.match(/"(.*)"/);
    return match?.[1] || '';
  }
}
