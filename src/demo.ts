import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  ConfigComposer,
  EnvConfigSource,
  JsonFileConfigSource,
  RemoteConfigSource,
} from './index.js';

async function main() {
  const configPath = join(tmpdir(), `demo-config-${Date.now()}.json`);
  await writeFile(configPath, JSON.stringify({
    db: { host: 'json-host', port: 5432 },
    debug: false,
  }));

  const fakeFetcher = async () =>
    new Response(JSON.stringify({ db: { host: 'remote-host' }, feature: 'beta' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  const composer = new ConfigComposer()
    .add(new EnvConfigSource('APP_', { APP_DB_HOST: 'env-host' }))
    .add(new RemoteConfigSource('https://cfg.example.com/app', 20, {}, fakeFetcher))
    .add(new JsonFileConfigSource(configPath));

  const { values, conflicts } = await composer.compose();

  console.log('Итоговая конфигурация:');
  console.log(JSON.stringify(values, null, 2));
  console.log('\nКонфликты:');
  console.log(JSON.stringify(conflicts, null, 2));

  await unlink(configPath).catch(() => {});
}

main().catch(console.error);
