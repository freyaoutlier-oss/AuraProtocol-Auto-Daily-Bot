import { ADDR, ABI } from './contracts.js';

// Claim REV + AURA faucet (on-chain). 6h cooldown, WITHDRAW_AMOUNT per claim.
// Returns an array of { sym, amount (number|null), tx } for what was actually claimed.
export async function claimFaucet(client, wallet, account, dryRun) {
  const claimed = [];
  const tokens = await client.readContract({ address: ADDR.faucet, abi: ABI.faucet, functionName: 'getTokens' });
  const cooldown = Number(await client.readContract({ address: ADDR.faucet, abi: ABI.faucet, functionName: 'COOLDOWN_PERIOD' }));
  let fee = 0n;
  try { fee = BigInt(await client.readContract({ address: ADDR.faucet, abi: ABI.faucet, functionName: 'FEE' })); } catch { }
  const now = Math.floor(Date.now() / 1000);

  for (const t of tokens) {
    const sym = t.symbol || await client.readContract({ address: t.contractAddress, abi: ABI.erc20, functionName: 'symbol' }).catch(() => '?');
    const last = Number(await client.readContract({
      address: ADDR.faucet, abi: ABI.faucet, functionName: 'getLastWithdrawalTime', args: [account.address, t.contractAddress],
    }).catch(() => 0));
    const ready = now - last >= cooldown;
    console.log(`  faucet ${sym}: last=${last} cooldown=${cooldown}s ready=${ready}`);
    if (!ready) continue;
    if (dryRun) { console.log(`  [DRY_RUN] would withdraw ${sym}`); claimed.push({ sym, amount: null, tx: null }); continue; }
    const before = await client.readContract({ address: t.contractAddress, abi: ABI.erc20, functionName: 'balanceOf', args: [account.address] }).catch(() => 0n);
    console.log(`  withdrawing ${sym} ...`);
    const tx = await wallet.writeContract({
      address: ADDR.faucet, abi: ABI.faucet, functionName: 'withdraw', args: [t.contractAddress], value: fee,
    });
    console.log(`  tx: ${tx}`);
    await client.waitForTransactionReceipt({ hash: tx });
    const after = await client.readContract({ address: t.contractAddress, abi: ABI.erc20, functionName: 'balanceOf', args: [account.address] }).catch(() => 0n);
    const delta = after - before;
    let dec = 18n;
    try { dec = BigInt(await client.readContract({ address: t.contractAddress, abi: ABI.erc20, functionName: 'decimals' })); } catch { }
    const amt = Number(delta) / (10 ** Number(dec));
    console.log(`  ${sym} claimed: +${amt}`);
    claimed.push({ sym, amount: amt, tx });
  }
  return claimed;
}
