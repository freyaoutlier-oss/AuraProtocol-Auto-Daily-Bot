import { getClients, loadAccounts } from './chain.js';
import { login } from './auth.js';
import { dailyClaim, getProfile } from './api.js';
import { claimFaucet } from './faucet.js';
import { discoverPools, stakeToken } from './staking.js';
import { syncTasks } from './tasks.js';
import { loadConfig, saveConfig } from './config.js';
import { ADDR, ABI } from './contracts.js';
import { parseUnits } from 'viem';
import { writeRunLog } from './runlog.js';
import readline from 'readline';

const DRY = process.env.DRY_RUN === 'true';

// Build a per-wallet session.
// auth=false skips the web login (used for on-chain-only steps like faucet/stake).
export async function buildSession(pk, auth = true) {
  const { client, wallet, account } = getClients(pk);
  const address = account.address;
  let cookie = null;
  let token = null;
  if (auth) {
    const r = await login(pk);
    token = r.token;
    cookie = r.cookie;
    console.log(`Login OK: ${address}`);
  }
  return { pk, account, address, client, wallet, token, cookie };
}

// Convert a stake spec ("1" or "50%") into a wei amount for the given balance.
function resolveAmount(spec, balWei) {
  if (spec === undefined || spec === null || spec === '' || spec === '0') return 0n;
  if (typeof spec === 'string' && spec.endsWith('%')) {
    const p = parseFloat(spec) / 100;
    return (balWei * BigInt(Math.round(p * 1000))) / 1000n;
  }
  return parseUnits(String(spec), 18);
}

// Promisified readline question (rl.question is callback-based).
function askQuestion(rl, q) {
  return new Promise((resolve) => rl.question(q, resolve));
}

// Ask for the stake plan ONCE (applied to every wallet).
// Returns { aura, rev, times }.
export async function getStakePlan(interactive) {
  const cfg = loadConfig();
  let aura = process.env.STAKE_AURA ?? cfg.STAKE_AURA;
  let rev = process.env.STAKE_REV ?? cfg.STAKE_REV;
  let times = process.env.STAKE_TIMES ?? cfg.STAKE_TIMES;

  const promptNeeded = interactive && process.stdout.isTTY;
  // One readline instance for all prompts (creating several on the same stdin
  // swallows buffered input and breaks piped/non-interactive use).
  const rl = promptNeeded
    ? readline.createInterface({ input: process.stdin, output: process.stdout })
    : null;

  const noStakeCfg = (aura === undefined || aura === '') && (rev === undefined || rev === '');
  if (noStakeCfg) {
    if (promptNeeded) {
      aura = (await askQuestion(rl, 'Stake AURA amount (empty = skip, e.g. 1 or 50%): ')).trim();
      rev = (await askQuestion(rl, 'Stake REV amount (empty = skip): ')).trim();
      cfg.STAKE_AURA = aura || '0';
      cfg.STAKE_REV = rev || '0';
    } else {
      aura = '0'; rev = '0';
    }
  }

  if (times === undefined || times === '') {
    if (promptNeeded) {
      times = (await askQuestion(rl, 'How many times to stake per cycle? [1]: ')).trim() || '1';
      cfg.STAKE_TIMES = times;
    } else {
      times = '1';
    }
  }

  if (promptNeeded) { rl.close(); saveConfig(cfg); }
  return {
    aura: (aura ?? '0').toString(),
    rev: (rev ?? '0').toString(),
    times: Math.max(1, parseInt(times) || 1),
  };
}

// Returns a result object: { status, claimed, pointsGained, streak, message }
export async function stepDaily(cookie) {
  console.log('\n[1] Daily login claim');
  const prof = await getProfile(cookie);
  const dl = prof.json?.profile?.daily_login;
  const curPoints = prof.json?.profile?.points;
  if (DRY) {
    console.log(`  [DRY_RUN] daily_login: ${JSON.stringify(dl)} points: ${curPoints}`);
    return { status: 'dry', claimed: false, pointsGained: null, streak: dl?.streak ?? null, message: 'DRY_RUN' };
  }
  if (!dl) {
    console.log(`  ! could not read daily_login state: ${JSON.stringify(prof.json).slice(0, 150)}`);
    return { status: 'unknown', claimed: false, message: 'cannot read daily_login state' };
  }
  if (dl.is_claimable === false) {
    const next = dl.next_day ? new Date(dl.next_day * 1000).toUTCString() : 'unknown';
    console.log(`  [i] Already claimed today — streak=${dl.streak}, next available ${next}`);
    return { status: 'already', claimed: false, pointsGained: null, streak: dl.streak, message: `already claimed (streak=${dl.streak})` };
  }
  // is_claimable === true → claim and prove it credited
  const before = dl;
  const d = await dailyClaim(cookie);
  if (d.json && d.json.status === 'success') {
    const after = await getProfile(cookie);
    const adl = after.json?.profile?.daily_login;
    const ap = after.json?.profile?.points;
    const gained = (typeof ap === 'number' && typeof curPoints === 'number') ? ap - curPoints : null;
    console.log(`  [OK] Daily claimed! streak=${adl?.streak ?? '?'} points=${ap ?? '?'} (was streak=${before.streak}, +${gained ?? before.next_reward})`);
    return { status: 'claimed', claimed: true, pointsGained: gained ?? before.next_reward, streak: adl?.streak ?? null, message: `streak=${adl?.streak} +${gained ?? before.next_reward} pts` };
  }
  console.log(`  -> ${d.status} ${JSON.stringify(d.json).slice(0, 150)}`);
  return { status: 'error', claimed: false, message: `${d.status} ${JSON.stringify(d.json).slice(0, 120)}` };
}

export async function stepFaucet(client, wallet, account) {
  console.log('\n[2] Faucet REV/AURA');
  return claimFaucet(client, wallet, account, DRY);
}

export async function stepStake(client, wallet, account, plan) {
  console.log('\n[3] Auto-stake');
  const pools = await discoverPools(client);
  const times = plan.times || 1;
  for (let i = 1; i <= times; i++) {
    if (times > 1) console.log(`  -- stake ${i}/${times} --`);
    if (plan.aura && plan.aura !== '0') {
      const a = resolveAmount(plan.aura, await client.readContract({ address: ADDR.aura, abi: ABI.erc20, functionName: 'balanceOf', args: [account.address] }));
      if (a > 0n && pools.AURA) await stakeToken(client, wallet, account, 'AURA', pools.AURA, a, DRY);
      else if (a > 0n) console.log('  AURA pool not found');
    }
    if (plan.rev && plan.rev !== '0') {
      const r = resolveAmount(plan.rev, await client.readContract({ address: ADDR.rev, abi: ABI.erc20, functionName: 'balanceOf', args: [account.address] }));
      if (r > 0n && pools.REV) await stakeToken(client, wallet, account, 'REV', pools.REV, r, DRY);
      else if (r > 0n) console.log('  REV pool not found');
    }
  }
  if ((!plan.aura || plan.aura === '0') && (!plan.rev || plan.rev === '0')) console.log('  no stake amount configured (skipped)');
}

export async function stepTasks(cookie) {
  console.log('\n[4] Sync onchain tasks');
  await syncTasks(cookie, DRY);
}

// Run the full pipeline for a single wallet session. Returns a result object.
export async function runAll(session, plan) {
  const result = { address: session.address, daily: null, faucet: [], error: null };
  console.log(`\n===== Wallet ${session.address} =====`);
  try {
    if (!session.cookie) {
      const r = await login(session.pk);
      session.cookie = r.cookie;
    }
    result.daily = await stepDaily(session.cookie);
    result.faucet = await stepFaucet(session.client, session.wallet, session.account);
    await stepTasks(session.cookie);
    console.log(`Wallet ${session.address} done.`);
  } catch (e) {
    result.error = e.message;
    console.error(`Wallet ${session.address} error: ${e.message}`);
  }
  return result;
}

// Run all wallets once. Plan is resolved interactively on the first call.
// Collects per-wallet results and writes the run log to README.md.
export async function runAllWallets(interactive) {
  const plan = await getStakePlan(interactive);
  const pks = loadAccounts();
  console.log(`\nLoaded ${pks.length} wallet(s).`);
  const results = [];
  const conc = Math.max(1, parseInt(process.env.WALLET_CONCURRENCY || '1', 10));
  let idx = 0;
  const worker = async () => {
    while (idx < pks.length) {
      const pk = pks[idx++];
      const session = await buildSession(pk, true);
      const r = await runAll(session, plan);
      results.push(r);
    }
  };
  const ws = [];
  for (let k = 0; k < Math.min(conc, pks.length); k++) ws.push(worker());
  await Promise.all(ws);
  try { await writeRunLog(results); } catch (e) { console.error('runlog error:', e.message); }
}
