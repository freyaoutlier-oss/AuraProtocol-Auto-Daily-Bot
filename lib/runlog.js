import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// Persistent run log written into README.md after every cycle.
// History is kept in run_log.json (committed) so it survives CI checkouts.

const MARK_START = '<!-- AURALAUNCH_RUNLOG_START -->';
const MARK_END = '<!-- AURALAUNCH_RUNLOG_END -->';
const MAX_HISTORY = 30;
const RUN_LOG_FILE = 'run_log.json';

function shortAddr(a) {
  if (!a) return '?';
  return a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function fmt(n) {
  if (n === null || n === undefined) return 'DRY';
  if (typeof n !== 'number') return String(n);
  // up to 4 decimals, trim trailing zeros
  return parseFloat(n.toFixed(4)).toString();
}

function dailyText(d) {
  if (!d) return '—';
  switch (d.status) {
    case 'claimed': return `✅ +${d.pointsGained ?? '?'} pts (streak ${d.streak ?? '?'})`;
    case 'already': return `ℹ️ already (streak ${d.streak ?? '?'})`;
    case 'dry': return '⏱ DRY';
    case 'error': return `⚠️ ${d.message ?? ''}`;
    default: return `? ${d.message ?? ''}`;
  }
}

function tokenAmt(faucet, sym) {
  const hits = (faucet || []).filter((f) => f.sym && f.sym.toLowerCase() === sym.toLowerCase());
  if (!hits.length) return '—';
  return hits.map((h) => (h.amount === null ? 'DRY' : `+${fmt(h.amount)}`)).join(', ');
}

function buildRecord(results) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const wallets = (results || []).map((r) => ({
    address: r.address,
    daily: dailyText(r.daily),
    aura: tokenAmt(r.faucet, 'AURA'),
    rev: tokenAmt(r.faucet, 'REV'),
    status: r.error ? `error: ${r.error}` : 'ok',
  }));
  return { time: ts, wallets };
}

function readHistory() {
  try {
    if (existsSync(RUN_LOG_FILE)) return JSON.parse(readFileSync(RUN_LOG_FILE, 'utf8'));
  } catch { /* ignore */ }
  return [];
}

function render(history) {
  const latest = history[0];
  const lastRun = latest
    ? latest.wallets.map((w) =>
        `| ${shortAddr(w.address)} | ${w.daily} | ${w.aura} | ${w.rev} | ${w.status} |`).join('\n')
    : '| — | — | — | — | — |';

  const histRows = history.map((h) =>
    h.wallets.map((w) =>
      `| ${h.time} | ${shortAddr(w.address)} | ${w.daily} | ${w.aura} | ${w.rev} | ${w.status} |`).join('\n')
  ).join('\n');

  return [
    `## 📋 Bot Run Log`,
    ``,
    `_Last updated: ${latest ? latest.time : '—'}_`,
    ``,
    `### 🟢 Last Run`,
    ``,
    `| Wallet | Daily Login | Faucet AURA | Faucet REV | Status |`,
    `|--------|-------------|-------------|------------|--------|`,
    lastRun,
    ``,
    `### 📜 History (newest first, last ${MAX_HISTORY})`,
    ``,
    `| Time (UTC) | Wallet | Daily Login | AURA | REV | Status |`,
    `|------------|--------|-------------|------|-----|--------|`,
    histRows || `| — | — | — | — | — | — |`,
    ``,
  ].join('\n');
}

export async function writeRunLog(results) {
  const record = buildRecord(results);
  const history = readHistory();
  history.unshift(record);
  while (history.length > MAX_HISTORY) history.pop();

  try { writeFileSync(RUN_LOG_FILE, JSON.stringify(history, null, 2)); } catch (e) {
    console.error('runlog: could not write', RUN_LOG_FILE, e.message);
  }

  const block = render(history);
  const readme = existsSync('README.md') ? readFileSync('README.md', 'utf8') : '';
  let out;
  if (readme.includes(MARK_START) && readme.includes(MARK_END)) {
    const re = new RegExp(`${MARK_START}[\\s\\S]*?${MARK_END}`);
    out = readme.replace(re, `${MARK_START}\n${block}\n${MARK_END}`);
  } else {
    out = readme + `\n\n${MARK_START}\n${block}\n${MARK_END}\n`;
  }
  try { writeFileSync('README.md', out); } catch (e) {
    console.error('runlog: could not write README.md', e.message);
  }
  console.log('\n[runlog] README run log updated.');
}
