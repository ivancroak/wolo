# The Complete Guide to Full Stack Solana Development with React, Anchor, Rust, and Phantom

Source: https://dev.to/edge-and-node/the-complete-guide-to-full-stack-solana-development-with-react-anchor-rust-and-phantom-3291

Code repo: https://github.com/dabit3/complete-guide-to-full-stack-solana-development

---

## Tooling

- **Solana Tool Suite**: CLI for interacting with the Solana network
- **Anchor Framework**: The Hardhat of Solana development. DSL on top of Rust. Manages build, test, deploy.
- **solana/web3.js**: Solana version of web3.js for client-side interaction
- **React**: Client-side framework
- **Phantom Wallet**: Solana browser wallet

## Prerequisites

1. Node.js (via nvm or fnm)
2. Solana Tool Suite
3. Anchor (including Mocha)
4. Phantom wallet

---

## Solana CLI Basics

```bash
# Check config
solana config get

# Switch networks
solana config set --url localhost
solana config set --url devnet

# Check wallet address
solana address

# Account details
solana account <address>

# Start local validator
solana-test-validator

# Airdrop tokens (local)
solana airdrop 100

# Check balance
solana balance
```

---

## Project Setup

```bash
anchor init mysolanaapp --javascript
cd mysolanaapp
```

Project structure:
- **app/**: Frontend code
- **programs/**: Rust/Anchor programs
- **test/**: JavaScript tests
- **migrations/**: Deploy scripts

---

## Example 1: Counter Program

### Rust Program (programs/mysolanaapp/src/lib.rs)

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
mod mysolanaapp {
    use super::*;

    pub fn create(ctx: Context<Create>) -> ProgramResult {
        let base_account = &mut ctx.accounts.base_account;
        base_account.count = 0;
        Ok(())
    }

    pub fn increment(ctx: Context<Increment>) -> ProgramResult {
        let base_account = &mut ctx.accounts.base_account;
        base_account.count += 1;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Create<'info> {
    #[account(init, payer = user, space = 16 + 16)]
    pub base_account: Account<'info, BaseAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Increment<'info> {
    #[account(mut)]
    pub base_account: Account<'info, BaseAccount>,
}

#[account]
pub struct BaseAccount {
    pub count: u64,
}
```

### JavaScript Test

```javascript
const assert = require("assert");
const anchor = require("@project-serum/anchor");
const { SystemProgram } = anchor.web3;

describe("mysolanaapp", () => {
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Mysolanaapp;

  it("Creates a counter", async () => {
    const baseAccount = anchor.web3.Keypair.generate();
    await program.rpc.create({
      accounts: {
        baseAccount: baseAccount.publicKey,
        user: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      },
      signers: [baseAccount],
    });
    const account = await program.account.baseAccount.fetch(baseAccount.publicKey);
    assert.ok(account.count.toString() == 0);
    _baseAccount = baseAccount;
  });

  it("Increments the counter", async () => {
    const baseAccount = _baseAccount;
    await program.rpc.increment({
      accounts: {
        baseAccount: baseAccount.publicKey,
      },
    });
    const account = await program.account.baseAccount.fetch(baseAccount.publicKey);
    assert.ok(account.count.toString() == 1);
  });
});
```

### Key Concepts

Two main things needed to call a Solana program with Anchor:

1. **Provider**: Abstraction of Connection + Wallet + preflight commitment. In tests, Anchor creates it from env. In frontend, construct manually.
2. **Program**: Combines Provider + IDL + programID. Allows calling RPC methods against the program.

Calling functions: `program.rpc.functionName()`

### Build, Test, Deploy

```bash
# Get program ID
solana address -k target/deploy/mysolanaapp-keypair.json

# Update declare_id! in lib.rs and Anchor.toml with the program ID

anchor build
anchor test
anchor deploy  # with solana-test-validator running
```

---

## React Frontend Integration

### Install Dependencies

```bash
npx create-react-app app
cd app
npm install @project-serum/anchor @solana/web3.js
npm install @solana/wallet-adapter-react \
  @solana/wallet-adapter-react-ui \
  @solana/wallet-adapter-wallets \
  @solana/wallet-adapter-base
```

### Frontend Code (App.js) - Counter Example

```javascript
import './App.css';
import { useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, Provider, web3 } from '@project-serum/anchor';
import idl from './idl.json';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { useWallet, WalletProvider, ConnectionProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
require('@solana/wallet-adapter-react-ui/styles.css');

const wallets = [new PhantomWalletAdapter()]
const { SystemProgram, Keypair } = web3;
const baseAccount = Keypair.generate();
const opts = { preflightCommitment: "processed" }
const programID = new PublicKey(idl.metadata.address);

function App() {
  const [value, setValue] = useState(null);
  const wallet = useWallet();

  async function getProvider() {
    const network = "http://127.0.0.1:8899";
    const connection = new Connection(network, opts.preflightCommitment);
    const provider = new Provider(connection, wallet, opts.preflightCommitment);
    return provider;
  }

  async function createCounter() {
    const provider = await getProvider();
    const program = new Program(idl, programID, provider);
    try {
      await program.rpc.create({
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [baseAccount]
      });
      const account = await program.account.baseAccount.fetch(baseAccount.publicKey);
      setValue(account.count.toString());
    } catch (err) {
      console.log("Transaction error: ", err);
    }
  }

  async function increment() {
    const provider = await getProvider();
    const program = new Program(idl, programID, provider);
    await program.rpc.increment({
      accounts: { baseAccount: baseAccount.publicKey }
    });
    const account = await program.account.baseAccount.fetch(baseAccount.publicKey);
    setValue(account.count.toString());
  }

  if (!wallet.connected) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop:'100px' }}>
        <WalletMultiButton />
      </div>
    )
  } else {
    return (
      <div className="App">
        <div>
          {!value && (<button onClick={createCounter}>Create counter</button>)}
          {value && <button onClick={increment}>Increment counter</button>}
          {value && value >= Number(0) ? (<h2>{value}</h2>) : (<h3>Please create the counter.</h3>)}
        </div>
      </div>
    );
  }
}

const AppWithProvider = () => (
  <ConnectionProvider endpoint="http://127.0.0.1:8899">
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
        <App />
      </WalletModalProvider>
    </WalletProvider>
  </ConnectionProvider>
)

export default AppWithProvider;
```

### Important: Copy IDL to Frontend

After each `anchor build`, copy `target/idl/mysolanaapp.json` to `app/src/idl.json`.

Script to automate:
```javascript
// copyIdl.js
const fs = require('fs');
const idl = require('./target/idl/mysolanaapp.json');
fs.writeFileSync('./app/src/idl.json', JSON.stringify(idl));
```

---

## Example 2: CRUD Program (Messages)

### Rust Program

```rust
use anchor_lang::prelude::*;

declare_id!("your-program-id");

#[program]
mod mysolanaapp {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, data: String) -> ProgramResult {
        let base_account = &mut ctx.accounts.base_account;
        let copy = data.clone();
        base_account.data = data;
        base_account.data_list.push(copy);
        Ok(())
    }

    pub fn update(ctx: Context<Update>, data: String) -> ProgramResult {
        let base_account = &mut ctx.accounts.base_account;
        let copy = data.clone();
        base_account.data = data;
        base_account.data_list.push(copy);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 64 + 64)]
    pub base_account: Account<'info, BaseAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub base_account: Account<'info, BaseAccount>,
}

#[account]
pub struct BaseAccount {
    pub data: String,
    pub data_list: Vec<String>,
}
```

---

## Deploying to Devnet

1. `solana config set --url devnet`
2. Switch Phantom wallet to devnet
3. Update `Anchor.toml`: change cluster from `localnet` to `devnet`
4. Rebuild: `anchor build`
5. Deploy: `anchor deploy`
6. Update frontend endpoint:

```javascript
import { clusterApiUrl } from '@solana/web3.js';
const network = clusterApiUrl('devnet');
<ConnectionProvider endpoint={network}>
```

---

## Key Patterns Summary

- **All state lives in accounts**, not in the program itself
- **No read operations on-chain** -- just fetch the account to read state
- **IDL** (Interface Description Language) is the equivalent of ABI in Solidity
- **RPC calls**: `program.rpc.functionName({ accounts: {...}, signers: [...] })`
- **Account fetching**: `program.account.accountType.fetch(publicKey)`
- **Wallet integration**: Use `@solana/wallet-adapter-react` with Provider pattern
- Use `useAnchorWallet` hook instead of `useWallet` for Anchor (some wallets don't support signing)
- Stop `solana-test-validator` before running `anchor test` (Anchor spins up its own)

## Further Reading

- [Create a Solana dApp from scratch](https://lorisleiva.com/create-a-solana-dapp-from-scratch) (Twitter clone on Solana)
- [Metaplex](https://www.metaplex.com/) for NFT marketplace development
