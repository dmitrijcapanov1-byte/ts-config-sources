import type { ConfigSource } from '../core/ConfigSource.js';
import { ConfigSourceError } from '../errors/ConfigError.js';

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Источник конфигурации из удалённого HTTP(S)-хранилища.
 * Приоритет = 20 (средний слой).
 */
export class RemoteConfigSource implements ConfigSource {
  public readonly name: string;
  public readonly priority: number;

  constructor(
    private readonly url: string,
    priority: number = 20,
    private readonly options: {
      headers?: Record<string, string>;
      timeoutMs?: number;
    } = {},
    private readonly fetcher: Fetcher = globalThis.fetch.bind(globalThis),
  ) {
    this.name = `remote:${url}`;
    this.priority = priority;
  }

  public async load(): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeout = this.options.timeoutMs ?? 5000;
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await this.fetcher(this.url, {
        method: 'GET',
        headers: { Accept: 'application/json', ...this.options.headers },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ConfigSourceError(
          this.name, `HTTP ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as unknown;
      if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        throw new ConfigSourceError(this.name, 'Ожидался JSON-объект');
      }

      return this.flatten(data as Record<string, unknown>);
    } catch (cause) {
      if (cause instanceof ConfigSourceError) throw cause;
      throw new ConfigSourceError(this.name, 'Ошибка запроса', cause);
    } finally {
      clearTimeout(timer);
    }
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
