import { BASE } from './contracts.js';

async function authedFetch(cookie, path, opts = {}) {
  const headers = Object.assign({ Cookie: cookie }, opts.headers || {});
  const r = await fetch(`${BASE}${path}`, { ...opts, headers });
  const txt = await r.text();
  let json;
  try { json = JSON.parse(txt); } catch { json = { _raw: txt.slice(0, 200) }; }
  return { status: r.status, json };
}

// Claim daily login points
export async function dailyClaim(cookie) {
  return authedFetch(cookie, '/api/auth/me/claim', { method: 'POST' });
}

// Incentives data (tasks, profile, ranks)
export async function getIncentives(cookie) {
  return authedFetch(cookie, '/api/incentives/me');
}

// Sync on-chain task. index = 0-based task position in /api/incentives/me array
export async function verifyTask(cookie, taskId, index) {
  return authedFetch(cookie, `/api/incentives/tasks/${taskId}/verify?index=${index}`, { method: 'POST' });
}
