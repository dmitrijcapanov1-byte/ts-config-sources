/**
 * ts-config-sources — библиотека конфигурации с несколькими источниками.
 *
 * Приоритеты (большее число = сильнее):
 *   JSON = 10, Remote = 20, ENV = 30.
 */
export type { ConfigSource } from './core/ConfigSource.js';
export {
  ConfigComposer,
  type ComposedConfig,
  type ResolvedValue,
} from './core/ConfigComposer.js';
export { EnvConfigSource } from './sources/EnvConfigSource.js';
export { JsonFileConfigSource } from './sources/JsonFileConfigSource.js';
export { RemoteConfigSource, type Fetcher } from './sources/RemoteConfigSource.js';
export {
  ConfigError,
  ConfigSourceError,
  ConfigComposerError,
} from './errors/ConfigError.js';
