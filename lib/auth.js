import { BASE } from './contracts.js';
import { privateKeyToAccount } from 'viem/accounts';

// Login: personal_sign("auth:<address>") -> POST /api/auth {address, signature} -> {token}
// Returns { token, cookie, address }.
export async function login(pk) {
  const account = privateKeyToAccount(pk);
  const address = account.address;
  const message = `auth:${address}`;
  const signature = await account.signMessage({ message });
  const r = await fetch(`${BASE}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, signature }),
  });
  const j = await r.json().catch(() => ({}));
  if (j.status !== 'success' || !j.token) {
    throw new Error('Login failed: ' + JSON.stringify(j));
  }
  return { token: j.token, cookie: `aura_token=${j.token}`, address };
}
