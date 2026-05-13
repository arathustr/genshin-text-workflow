import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const dataDir = process.env.GENSHIN_DATA_DIR || path.join(workspaceRoot, 'genshin-game-data');
const upstream = 'https://gitlab.com/Dimbreath/AnimeGameData.git';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || workspaceRoot,
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

async function main() {
  await mkdir(workspaceRoot, { recursive: true });

  if (!existsSync(path.join(dataDir, '.git'))) {
    run('git', ['clone', '--filter=blob:none', '--sparse', upstream, dataDir]);
  } else {
    run('git', ['-C', dataDir, 'pull', '--ff-only']);
  }

  run('git', ['-C', dataDir, 'sparse-checkout', 'set', 'TextMap', 'ExcelBinOutput', 'Readable/CHS']);

  console.log('');
  console.log('Genshin data is ready.');
  console.log('Next: npm run index');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
