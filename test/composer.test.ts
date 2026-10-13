import { describe, it, expect, vi } from 'vitest';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  ConfigComposer,
  EnvConfigSource,
  JsonFileConfigSource,
  RemoteConfigSource,
  ConfigComposerError,
  type ConfigSource,
} from '../src/index.js';

class StubSource implements ConfigSource {
  constructor(
    public readonly name: string,
    public readonly priority: number,
    private readonly data: Record<string, unknown>,
  ) {}
  async load() { return this.data; }
}

describe('ConfigComposer', () => {
  it('сливает источники, побеждает больший priority', async () => {
    const composer = new ConfigComposer()
      .add(new StubSource('json', 10, { host: 'json-host', debug: true }))
      .add(new StubSource('env', 30, { host: 'env-host', port: 1 }));

    const { values, conflicts } = await composer.compose();

    expect(values).toEqual({ host: 'env-host', debug: true, port: 1 });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toEqual({
      key: 'host', winner: 'env', losers: ['json'],
    });
  });

  it('бросает ошибку при равных приоритетах', async () => {
    const composer = new ConfigComposer()
      .add(new StubSource('a', 10, { x: 1 }))
      .add(new StubSource('b', 10, { x: 2 }));
    await expect(composer.compose()).rejects.toThrow(ConfigComposerError);
  });

  it('отслеживает происхождение значений', async () => {
    const composer = new ConfigComposer()
      .add(new StubSource('json', 10, { a: 1 }))
      .add(new StubSource('env', 30, { b: 2 }));
    const { origins } = await composer.compose();
    expect(origins.a.source).toBe('json');
    expect(origins.b.source).toBe('env');
  });

  it('ENV переопределяет JSON при совпадении ключа', async () => {
    const composer = new ConfigComposer()
      .add(new EnvConfigSource('APP_', { APP_DB_HOST: 'env-host' }, 30))
      .add(new StubSource('json', 10, { 'db.host': 'json-host' }));

    const { values, conflicts } = await composer.compose();
    expect(values['db.host']).toBe('env-host');
    expect(conflicts[0].winner).toBe('env');
  });
});

describe('EnvConfigSource', () => {
  it('приводит переменные к точечной нотации', async () => {
    const source = new EnvConfigSource('APP_', {
      APP_DB_HOST: 'localhost',
      APP_DB_PORT: '5432',
      APP_DEBUG: 'true',
      OTHER: 'ignored',
    });
    const data = await source.load();
    expect(data).toEqual({
      'db.host': 'localhost', 'db.port': 5432, debug: true,
    });
  });

  it('поддерживает двойное подчёркивание', async () => {
    const source = new EnvConfigSource('APP_', {
      APP_DB__HOST: 'localhost',
      APP_DB__PORT: '5432',
    });
    const data = await source.load();
    expect(data).toEqual({ 'db.host': 'localhost', 'db.port': 5432 });
  });
});

describe('JsonFileConfigSource', () => {
  it('уплощает вложенный JSON', async () => {
    const path = join(tmpdir(), `test-config-${Date.now()}.json`);
    await writeFile(path, JSON.stringify({ db: { host: 'h', port: 5 } }));
    try {
      const source = new JsonFileConfigSource(path);
      const data = await source.load();
      expect(data).toEqual({ 'db.host': 'h', 'db.port': 5 });
    } finally {
      await unlink(path).catch(() => {});
    }
  });
});

describe('RemoteConfigSource', () => {
  it('читает JSON по HTTP', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ api: { url: 'https://api' } }), { status: 200 }),
    );
    const source = new RemoteConfigSource('https://cfg', 20, {}, fetcher);
    const data = await source.load();
    expect(data).toEqual({ 'api.url': 'https://api' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('бросает ошибку при HTTP != 200', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response('nope', { status: 500, statusText: 'Server Error' }),
    );
    const source = new RemoteConfigSource('https://cfg', 20, {}, fetcher);
    await expect(source.load()).rejects.toThrow(/HTTP 500/);
  });
});
