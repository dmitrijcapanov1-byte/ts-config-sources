import type { ConfigSource } from './ConfigSource.js';
import { ConfigComposerError, ConfigSourceError } from '../errors/ConfigError.js';

export interface ResolvedValue {
  value: unknown;
  source: string;
  priority: number;
}

export interface ComposedConfig {
  values: Record<string, unknown>;
  origins: Record<string, ResolvedValue>;
  conflicts: Array<{ key: string; winner: string; losers: string[] }>;
}

/**
 * Компоновщик конфигурации.
 * SRP: слить результаты источников в один объект,
 * разрешая конфликты по правилу «больший priority побеждает».
 */
export class ConfigComposer {
  private readonly sources: ConfigSource[];

  constructor(sources: ConfigSource[] = []) {
    this.sources = [...sources];
  }

  public add(source: ConfigSource): this {
    this.sources.push(source);
    return this;
  }

  public remove(name: string): this {
    const idx = this.sources.findIndex((s) => s.name === name);
    if (idx !== -1) this.sources.splice(idx, 1);
    return this;
  }

  public async compose(): Promise<ComposedConfig> {
    const sorted = [...this.sources].sort((a, b) => a.priority - b.priority);
    const origins: Record<string, ResolvedValue> = {};
    const conflicts: ComposedConfig['conflicts'] = [];

    for (const source of sorted) {
      let data: Record<string, unknown>;
      try {
        data = await source.load();
      } catch (cause) {
        if (cause instanceof ConfigSourceError) throw cause;
        throw new ConfigSourceError(source.name, 'Ошибка загрузки', cause);
      }

      for (const [key, value] of Object.entries(data)) {
        const existing = origins[key];

        if (!existing) {
          origins[key] = { value, source: source.name, priority: source.priority };
          continue;
        }

        if (existing.priority === source.priority) {
          throw new ConfigComposerError(
            `Конфликт ключа "${key}": источники "${existing.source}" и "${source.name}" ` +
            `имеют одинаковый приоритет ${source.priority}.`,
          );
        }

        const sourceWins = source.priority > existing.priority;
        const winnerName = sourceWins ? source.name : existing.source;
        const loserName = sourceWins ? existing.source : source.name;

        conflicts.push({ key, winner: winnerName, losers: [loserName] });

        origins[key] = {
          value: sourceWins ? value : existing.value,
          source: winnerName,
          priority: sourceWins ? source.priority : existing.priority,
        };
      }
    }

    const values: Record<string, unknown> = {};
    for (const [key, meta] of Object.entries(origins)) values[key] = meta.value;

    return { values, origins, conflicts };
  }
}
