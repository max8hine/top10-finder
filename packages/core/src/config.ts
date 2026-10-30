import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './paths.js';
import type { Config } from './types.js';

export const loadConfig = (): Config =>
  JSON.parse(readFileSync(join(DATA_DIR, 'config.json'), 'utf8')) as Config;
