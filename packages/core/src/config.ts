import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './paths.js';
import type { Config } from './types.js';

const FILE = join(DATA_DIR, 'config.json');

export const loadConfig = (): Config => JSON.parse(readFileSync(FILE, 'utf8')) as Config;

/** Write config.json in its hand-edited layout: one setting per line, one room per line. */
export function saveConfig(cfg: Config) {
  const { rooms, ...settings } = cfg;
  const value = (v: unknown) => (Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(', ')}]` : JSON.stringify(v));
  const lines = [
    ...Object.entries(settings).map(([k, v]) => `  ${JSON.stringify(k)}: ${value(v)},`),
    '  "rooms": [',
    // A blank line between parks, as in the hand-edited file.
    rooms
      .map((r, i) => `${i > 0 && r.hotelId !== rooms[i - 1].hotelId ? '\n' : ''}    ${JSON.stringify(r).replace(/([,:])(?=\S)/g, '$1 ').replace('{', '{ ').replace(/}$/, ' }')}`)
      .join(',\n'),
    '  ]',
  ];
  const tmp = FILE + '.tmp';
  writeFileSync(tmp, `{\n${lines.join('\n')}\n}\n`);
  renameSync(tmp, FILE);
}
