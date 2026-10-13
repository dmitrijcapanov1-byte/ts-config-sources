import type { ConfigSource } from '../core/ConfigSource.js';

/**
 * Источник конфигурации из переменных окружения.
 * Приоритет = 30 (высший). ENV переопределяет JSON и Remote.
 */
export class EnvConfigSource implements ConfigSource {
  public readonly name = 'env';
  public readonly priority: number;

  constructor(
    private readonly prefix: string = '',
    private readonly env: NodeJS.ProcessEnv = process.env,
    priority: number = 30,
  ) {
    this.priority = priority;
  }

  public async load(): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    for (const [rawKey, rawValue] of Object.entries(this.env)) {
      if (rawValue === undefined) continue;
      if (typeof rawValue !== 'string') continue;
      if (this.prefix && !rawKey.startsWith(this.prefix)) continue;

      const key = this.prefix ? rawKey.slice(this.prefix.length) : rawKey;
      result[this.normalizeKey(key)] = this.parseValue(rawValue);
    }
    return result;
  }

  /** APP_DB_HOST → db.host */
  private normalizeKey(key: string): string {
    return key.toLowerCase().replace(/__+/g, '.').replace(/_/g, '.');
  }

  private parseValue(value: string): unknown {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
    if (value.startsWith('{') || value.startsWith('[')) {
      try { return JSON.parse(value); } catch { return value; }
    }
    return value;
  }
}
