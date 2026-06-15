---
name: setup-solidity-contracts
description: Set up Solidity project with OpenZeppelin Contracts for Hardhat/Foundry, remappings, imports, and dependency install.
license: AGPL-3.0-only
metadata:
  author: OpenZeppelin
---

# Solidity Setup

Detect framework:

- Hardhat: `hardhat.config.*`
- Foundry: `foundry.toml`

New project: ask Hardhat vs Foundry.

## OpenZeppelin

- Install correct `@openzeppelin/contracts` package.
- Use installed package imports, not copied contract code.
- Configure Foundry remappings when needed.
- Keep compiler version compatible with contracts.

## Verify

Run project compile command. For this repo: `npm run contracts:compile`.
