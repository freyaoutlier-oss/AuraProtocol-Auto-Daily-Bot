# AuraLaunch Auto-Daily Bot

Automated bot for https://beta.auralaunch.org/incentives (LitVM Testnet, chainId 4441).

Supports **multiple wallets** from `account.txt` (one private key per line).

Features:
- Wallet login (sign message `auth:<address>` -> `POST /api/auth` -> session cookie `aura_token`)
- Claim daily login points (`POST /api/auth/me/claim`)
- Claim REV + AURA faucet on-chain (8h cooldown, 10 tokens/claim)
- Auto-stake REV/AURA (interactive: asks AURA, REV, & how many times to stake on first run, applied to ALL wallets)
- Sync on-chain tasks (`POST /api/incentives/tasks/{id}/verify?index={pos}`)

## How to Join (Participation Guide)

▶️ Join: https://beta.auralaunch.org/incentives

1. Connect Wallet (Testnet)
2. Connect X & Discord
3. Claim Daily Login
4. Scroll Down
5. Complete Tasks & Missions
6. Mint $AURA
7. Done

- Faucet: https://liteforge.hub.caldera.xyz/
          https://t.me/litvm_faucet_bot
- Earn 1,000 $AURA for eligible airdrop
- Details: https://docs.auralaunch.org/usdaura/aura-airdrop-zero

> What the bot automates for you: **Claim Daily Login**, **Faucet** (REV/AURA), **Auto-stake**, and **on-chain task sync**.
> Still manual on the website: **Connect X & Discord** (OAuth), **Mint $AURA**, and the social tasks (Follow X / Join Telegram).

## Clone 
```
git clone https://github.com/sins219/AuraLaunch-Auto-Daily-Bot.git
cd AuraLaunch-Auto-Daily-Bot
```

## Install
```
cd auralaunch-bot
npm install
```

## Wallets (multi-wallet)
Create `account.txt` in this folder — one private key per line.
Lines starting with `#` and blank lines are ignored.

```
# account.txt
0xaaaa1111...your_first_private_key
0xbbbb2222...your_second_private_key
```

Fallback: if `account.txt` is missing, the bot uses `PRIVATE_KEY` env (single wallet).
Override the file path with `ACCOUNT_FILE=/path/to/file`.


## Config (.env or export)
```
RPC_URL=...                    # optional, default https://liteforge.rpc.caldera.xyz/infra-partner-http
DRY_RUN=false                  # true = simulate only, no tx/claim sent
STAKE_AURA=1                   # AURA amount to stake (token number) or "50%" of balance
STAKE_REV=1                    # REV amount to stake
STAKE_TIMES=2                  # how many times to stake per cycle (default 1)
DAEMON_INTERVAL_MS=28800000    # bot loop interval (default 8 hours)
WALLET_CONCURRENCY=1           # how many wallets to process in parallel (default 1; raise for bulk)
```
Stake amount + how many times can also be set interactively on the first `node index.js run` / `stake`, then saved to `config.json` (keys: STAKE_AURA, STAKE_REV, STAKE_TIMES).

## Usage
```
node index.js run       # run everything, THEN auto-loop every 8h (daily + faucet + stake + tasks)
```
After the first run (and the interactive settings are saved to config.json), the bot immediately loops every 8 hours. Press Ctrl+C to stop. Run it in a `screen` so it stays alive after the terminal is closed. Every command applies to ALL wallets in `account.txt`.

## Notes
- Native zkltc is required for on-chain gas (faucet/stake). Check balance via explorer liteforge.explorer.caldera.xyz.
- Social tasks (Follow X, Join TG, Connect Discord/X) are NOT auto-claimed — they need manual OAuth on the website. The bot only verifies on-chain/streak tasks that are not yet completed.
- `index` in verify = 0-based task position in the `/api/incentives/me` response (verified: execute_first_stake = index 5).
- Files: lib/{chain,contracts,auth,api,faucet,staking,tasks,config,runner}.js

- ## ðŸ¤– Run on GitHub Actions (free, no VPS)

Run the bot on GitHub's servers with zero setup. A scheduled workflow fires
**every 8 hours** (the bot's native loop interval + the faucet's 8h
cooldown), runs exactly ONE cycle (daily claim â†’ faucet â†’ stake â†’ tasks) via
[`run_github.sh`](run_github.sh), then exits â€” so the per-run **AUR / REV
balance & points change** shows up fresh in every run's log.

> Why every 8h and not once a day? The faucet has an 8h cooldown and the bot
> is built to loop every 8h. A 3x/day schedule maximizes faucet claims
> (â‰ˆ3x/day) and keeps each job to just a few active minutes â€” cheap on free
> minutes. One daily run would waste ~2/3 of the faucet windows.

**Why a wrapper?** `node index.js run` finishes one cycle and then
**auto-loops every 8h** (`setInterval`) â€” it never exits on its own, which
would hang a CI job forever. `run_github.sh` launches the bot in the
background, waits for the first cycle to finish (watching for the
`Bot auto-loop every` log line, printed right *before* the loop starts), then
kills the bot and prints the full log to the Actions UI. The bot source is
untouched, so upstream `git pull` updates still apply cleanly.

**1. Add the files** (via web UI or `git push`):
- `.github/workflows/daily.yml`
- `run_github.sh`
- `.gitignore` (exclude `account.txt`, `.env`, `config.json`)

**2. Add Secrets** (repo â†’ Settings â†’ Secrets and variables â†’ Actions):

| Secret               | Value                                                          |
|----------------------|---------------------------------------------------------------|
| `ACCOUNTS`           | Private keys, **one per line** (same as `account.txt`)        |
| `PRIVATE_KEY`        | *(fallback)* single key if `ACCOUNTS` is empty                |
| `RPC_URL` *(opt)*    | Custom RPC (default is fine)                                  |
| `DRY_RUN` *(opt)*    | `true` to simulate (no tx/claim) â€” great for a first test    |
| `STAKE_AURA` *(opt)* | AURA stake amount or `50%` (else `config.json` default)      |
| `STAKE_REV` *(opt)*  | REV stake amount                                              |
| `STAKE_TIMES` *(opt)*| How many times to stake per cycle                             |
| `WALLET_CONCURRENCY` *(opt)* | Parallel wallets (default 1)                           |

> âš ï¸ The bot reads env vars **directly** (no `.env` loader), so the workflow
> injects these from Secrets at runtime. `account.txt` / `config.json` are
> written from Secrets / repo and excluded by `.gitignore` â€” **never commit
> your private keys**.

**3. Run it**
- Automatic: **every 8 hours** (00:00 / 08:00 / 16:00 UTC â‰ˆ 07:00 / 15:00 /
  23:00 WIB). Edit `cron:` in `daily.yml`.
- Manual smoke test: **Actions â†’ AuraLaunch Auto Daily â†’ Run workflow**.

---

## ðŸ“ˆ Daily AUR / REV balance & points change

Each 8h run prints the full result, so you can watch your **AUR / REV
balance and incentive points move** every cycle:

- **Daily login claim** â€” `[1] Daily login claim` shows the API response
  (points / streak status) for each wallet.
- **Faucet (REV/AURA)** â€” `[2] Faucet REV/AURA` logs `faucet REV: ... ready=`
  and `tx: 0x...` when a claim goes through. 8h cooldown, so it only fires
  when ready.
- **Auto-stake** â€” `[3] Auto-stake` logs `AURA balance: N` and
  `stake AURA tx: 0x...` (and REV), so each run shows exactly how much moved
  into the staking pool.
- **Tasks sync** â€” `[4] Sync onchain tasks` verifies on-chain/streak tasks.
- **Full log in Actions** â€” the entire bot log is printed at the end of every
  run, giving you a permanent, timestamped record under the Actions tab.

Because the job runs **every 8h**, comparing consecutive runs' faucet /
stake / balance lines (or the API response in step [1]) gives you the
**per-cycle change in your AUR / REV balance and incentive points**.

> ðŸ”Ž The bot does **not** persist historical balances itself â€” it reports the
> *current* cycle activity. Track long-term change by keeping the Actions run
> logs (each run is archived) or piping the log into your own tracker.

<!-- AURALAUNCH_RUNLOG_START -->
## 📋 Bot Run Log

_Last updated: 2026-07-17 03:53:47 UTC_

### 🟢 Last Run

| Wallet | Daily Login | Faucet AURA | Faucet REV | Status |
|--------|-------------|-------------|------------|--------|
| 0xDDd8…2153 | ℹ️ already (streak 1) | +10 | +10 | ok |

### 📜 History (newest first, last 30)

| Time (UTC) | Wallet | Daily Login | AURA | REV | Status |
|------------|--------|-------------|------|-----|--------|
| 2026-07-17 03:53:47 UTC | 0xDDd8…2153 | ℹ️ already (streak 1) | +10 | +10 | ok |
| 2026-07-17 02:22:09 UTC | 0xA04E…5C49 | ✅ +40 pts (streak 2) | +10 | +10 | ok |
| 2026-07-16 19:54:48 UTC | 0xA04E…5C49 | ℹ️ already (streak 1) | — | — | ok |

<!-- AURALAUNCH_RUNLOG_END -->

==============================================================================
TROUBLESHOOTING
==============================================================================
- Job fails immediately ("No accounts"): the ACCOUNTS secret is empty -> fill
  it in Step 5 (Secrets).
- Want to test without spending gas: set the DRY_RUN secret to true, run
  manually, check the log, then clear DRY_RUN.
- Want to change the schedule: edit the cron "0 */8 * * *" in daily.yml
  ("0 4 * * *" = once/day at 04:00 UTC, "0 */4 * * *" = every 4 hours).
- Logs look messy/odd: open the Actions tab -> latest run -> the
  "Run one daily cycle" step -> the "BOT LOG" section.
==============================================================================

