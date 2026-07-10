import { ADDR, ABI } from './contracts.js';

// Discover symbol -> { pid, pool } mapping from the Factory.
// Each pool is single-token: stake(uint256 amount, uint256 pid) with pid = 0.
export async function discoverPools(client) {
  const cnt = Number(await client.readContract({ address: ADDR.factory, abi: ABI.factory, functionName: 'stakingPoolCount' }));
  const map = {}; // symbol -> { pid, pool }
  for (let i = 0; i < cnt; i++) {
    const pool = await client.readContract({ address: ADDR.factory, abi: ABI.factory, functionName: 'getStakingPoolByIndex', args: [i] });
    try {
      const tok = await client.readContract({ address: pool, abi: ABI.poolStakeToken, functionName: 'stakeToken' });
      if (tok && tok !== '0x0000000000000000000000000000000000000000') {
        const sym = await client.readContract({ address: tok, abi: ABI.erc20, functionName: 'symbol' }).catch(() => tok);
        map[sym] = { pid: i, pool };
        console.log(`  pool pid ${i}: ${sym} (${tok}) -> stake on ${pool}`);
      } else {
        console.log(`  pool pid ${i}: native LIT (${pool})`);
      }
    } catch (e) {
      console.log(`  pool pid ${i}: failed to read (${e.message.slice(0, 40)})`);
    }
  }
  return map;
}

// Stake amountWei of token symbol into its pool.
// approve token -> pool address, then pool.stake(amount, 0).
export async function stakeToken(client, wallet, account, symbol, poolInfo, amountWei, dryRun) {
  const tokenAddr = symbol === 'AURA' ? ADDR.aura : ADDR.rev;
  const pool = poolInfo.pool;
  const bal = await client.readContract({ address: tokenAddr, abi: ABI.erc20, functionName: 'balanceOf', args: [account.address] });
  console.log(`  ${symbol} balance: ${Number(bal / 10n ** 18n)}`);
  if (bal < amountWei) { console.log(`  ${symbol} balance insufficient`); return; }
  if (dryRun) { console.log(`  [DRY_RUN] stake ${symbol} amount ${amountWei} on ${pool}`); return; }

  const allow = await client.readContract({ address: tokenAddr, abi: ABI.erc20, functionName: 'allowance', args: [account.address, pool] });
  if (allow < amountWei) {
    const ap = await wallet.writeContract({ address: tokenAddr, abi: ABI.erc20, functionName: 'approve', args: [pool, amountWei] });
    console.log(`  approve ${symbol} -> ${pool} tx: ${ap}`);
    await client.waitForTransactionReceipt({ hash: ap });
  } else {
    console.log(`  allowance sufficient, skip approve`);
  }
  // stake(uint256 amount, uint256 pid); pid = 0 for single-token pool
  const tx = await wallet.writeContract({ address: pool, abi: ABI.stake, functionName: 'stake', args: [amountWei, 0] });
  console.log(`  stake ${symbol} tx: ${tx}`);
  await client.waitForTransactionReceipt({ hash: tx });
  console.log(`  ${symbol} staked.`);
}
