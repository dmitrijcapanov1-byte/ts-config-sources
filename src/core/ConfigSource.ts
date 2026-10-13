/**
 * Источник конфигурации.
 *
 * Контракт для всех источников (env, JSON, remote).
 * SRP: каждый источник отвечает только за чтение своих данных.
 */
export interface ConfigSource {
  readonly name: string;

  /**
   * Чем больше число — тем выше приоритет.
   * Шкала: JSON = 10, Remote = 20, ENV = 30.
   */
  readonly priority: number;

  load(): Promise<Record<string, unknown>>;
}
