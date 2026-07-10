# AuraLaunch Auto-Daily Bot

Automated bot for https://beta.auralaunch.org/incentives (LitVM Testnet, chainId 4441).

Supports **multiple wallets** from `account.txt` (one private key per line).

Features:
- Wallet login (sign message `auth:<address>` -> `POST /api/auth` -> session cookie `aura_token`)
- Claim daily login points (`POST /api/auth/me/claim`)
- Claim REV + AURA faucet on-chain (6h cooldown, 10 tokens/claim)
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
