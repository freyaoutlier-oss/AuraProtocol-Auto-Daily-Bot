import { runAllWallets, buildSession, getStakePlan, stepDaily, stepFaucet, stepStake, stepTasks } from './lib/runner.js';
import { loadAccounts } from './lib/chain.js';

const cmd = process.argv[2] || 'run';
const INTERVAL_MS = Number(process.env.DAEMON_INTERVAL_MS || 28800_000); // default 8 hours
const INTERACTIVE = process.stdout.isTTY;

// Iterate over all wallets. auth=true logs in to the web API; auth=false is for on-chain-only steps.
async function withWallets(auth, fn) {
  const pks = loadAccounts();
  console.log(`\nLoaded ${pks.length} wallet(s).`);
  for (const pk of pks) {
    let session;
    try {
      session = await buildSession(pk, auth);
      await fn(session);
    } catch (e) {
      console.error(`Wallet ${session ? session.address : '?'} error: ${e.message}`);
    }
  }
}

async function main() {
  try {
    loadAccounts();
  } catch (e) {
    console.error(e.message);
    console.error('See README.md for account.txt usage.');
    process.exit(1);
  }

  switch (cmd) {
    case 'login':
      await withWallets(true, async () => { /* buildSession already logs in */ });
      break;
    case 'daily':
      await withWallets(true, async (s) => { console.log(`\n===== Wallet ${s.address} =====`); await stepDaily(s.cookie); });
      break;
    case 'faucet':
      await withWallets(false, async (s) => { console.log(`\n===== Wallet ${s.address} =====`); await stepFaucet(s.client, s.wallet, s.account); });
      break;
    case 'stake': {
      const plan = await getStakePlan(INTERACTIVE);
      await withWallets(false, async (s) => { console.log(`\n===== Wallet ${s.address} =====`); await stepStake(s.client, s.wallet, s.account, plan); });
      break;
    }
    case 'tasks':
      await withWallets(true, async (s) => { console.log(`\n===== Wallet ${s.address} =====`); await stepTasks(s.cookie); });
      break;
    case 'run':
      await runAllWallets(INTERACTIVE);
      console.log(`\nBot auto-loop every ${INTERVAL_MS / 1000}s (${(INTERVAL_MS / 3600000)}h). Press Ctrl+C to stop.`);
      setInterval(async () => {
        const ts = new Date().toISOString();
        console.log(`\n===== [${ts}] run =====`);
        try { await runAllWallets(false); } catch (e) { console.error('loop error:', e.message); }
      }, INTERVAL_MS);
      break;
    case 'daemon':
      console.error('Use: node index.js run  (already auto-loops every 8h)');
      process.exit(1);
    default:
      console.log('Commands: login | daily | faucet | stake | tasks | run');
      console.log('Example:  node index.js run');
  }
  if (cmd !== 'run') process.exit(0);
}

process.on('SIGINT', () => { console.log('\nBot stopped.'); process.exit(0); });
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
