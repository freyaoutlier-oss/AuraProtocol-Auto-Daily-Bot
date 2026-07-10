import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(fs.readFileSync(join(__dirname, 'abis', f), 'utf8'));

export const ADDR = {
  factory: '0xd084FA1f5530f82c814FB937E662aF95B9e5F1c8',
  staking: '0x9D001EAa62E3c8A7E3f5a47523Fa7DC3790fcBBB', // staking manager; stake(uint256 pid, uint256 amount)
  faucet:  '0x2881BDa1E897d02D97aa7Ef1161d9aA7f227f315',
  aura:    '0x0B779FF5855bc4E6937EbFa64aBE7AB8207f09c3', // AURA token
  rev:     '0x6bf699fDed8c7edA845D04eaB689eAaCCbB6e9F5', // REV token
};

export const BASE = 'https://beta.auralaunch.org';

export const ABI = {
  faucet: load('faucet.json'),
  factory: load('factory.json'),
  // decoded from deployed bytecode: stake(uint256,uint256) on ADDR.staking
  stake: [{ type: 'function', name: 'stake', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }, { type: 'uint256' }], outputs: [] }],
  erc20: [
    { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
    { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
    { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
    { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
  ],
  // per-pool stakeToken() read
  poolStakeToken: [{ type: 'function', name: 'stakeToken', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }],
};
