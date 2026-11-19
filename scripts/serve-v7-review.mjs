import { dirname, join, resolve } from 'node:path';
import { realpath } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const servers = [];
const close = async () => { for (const server of servers) await server.close(); };
process.once('SIGINT', () => void close().then(() => process.exit(0)));
process.once('SIGTERM', () => void close().then(() => process.exit(0)));
try {
  for (const [index, product] of ['aegisops', 'scenestart', 'azure-optimizer'].entries()) {
    const fixture = join(root, 'tests/fixtures/pilots', `${product}-fixture`);
    if (await realpath(fixture) !== fixture) throw new Error('Review fixture must not be a symlink');
    const { preview } = await import(pathToFileURL(join(fixture, 'node_modules/vite/dist/node/index.js')).href);
    const server = await preview({ root: fixture, configFile: join(fixture, 'vite.config.ts'), logLevel: 'silent',
      preview: { host: '127.0.0.1', port: 4911 + index, strictPort: false } });
    servers.push(server);
    const address = server.httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Missing local review address');
    console.error(`${product}: http://127.0.0.1:${address.port}${product === 'scenestart' ? '/studio' : '/'}`);
  }
  console.error('Repository-owned demonstration fixtures only. No original applications or public hosting are changed.');
} catch (error) { await close(); throw error; }
