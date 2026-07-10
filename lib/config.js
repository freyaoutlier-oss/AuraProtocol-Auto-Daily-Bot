import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CFG = join(__dirname, '..', 'config.json');

export function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch { return {}; }
}
export function saveConfig(c) {
  fs.writeFileSync(CFG, JSON.stringify(c, null, 2));
}
