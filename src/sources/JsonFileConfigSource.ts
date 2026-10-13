import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ConfigSource } from '../core/ConfigSource.js';
import { ConfigSourceError } from '../errors/ConfigError.js';

/**
 * Источник конфигурации из JSON-файла.
 * Приоритет = 10 (базовый слой).
 */
export class JsonFileConfigSource implements ConfigSource {
  public readonly name: string;
  public readonly priority: number;
  private readonly absolutePath: string;

  constructor(
    filePath: string,
    priority: number = 10,
    private readonly required: boolean = true,
  ) {
    this.absolutePath = resolve(filePath);
    this.name = `json:${this.absolutePath}`;
    this.priority = priority;
  }

  public async load(): Promise<Record<string, unknown>> {
    let raw: string;
    try {
      raw = await readFile(this.absolutePath, 'utf-8');
    } catch (cause) {
      const code = (cause as { code?: string } | undefined)?.code;
      if (!this.required && code === 'ENOENT') return {};
      throw new ConfigSourceError(this.name, 'Не удалось прочитать файл', cause);
    }
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch (cause) { throw new ConfigSourceError(this.name, 'Некорректный JSON', cause); }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ConfigSourceError(this.name, 'Корень JSON должен быть объектом');
    }
    return this.flatten(parsed as Record<string, unknown>);
  }

  private flatten(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this.flatten(value as Record<string, unknown>, fullKey));
      } else {
        result[fullKey] = value;
      }
    }
    return result;
  }
}
