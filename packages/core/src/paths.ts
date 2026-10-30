import { fileURLToPath } from 'node:url';

/** Repo-level data directory. Same files whatever the working directory is. */
export const DATA_DIR = fileURLToPath(new URL('../../../data/', import.meta.url));
