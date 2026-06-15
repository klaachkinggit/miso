---
name: solidity-security
description: Smart-contract security checklist for writing/auditing Solidity, preventing common vulnerabilities, and applying secure patterns.
---

# Solidity Security

Use for Solidity edits, reviews, audits.

## Checks

- Access control: explicit roles/ownership, no public privileged paths.
- Reentrancy: checks-effects-interactions, guards when external calls exist.
- External calls: handle failures, avoid untrusted callbacks where possible.
- Arithmetic/accounting: Solidity 0.8 checks, precise fee/share math, no rounding leaks.
- Token handling: safe ERC20/ERC721 interfaces, approval risks, receiver hooks.
- Upgradeability: initializer guards, storage layout, admin separation.
- Randomness/time: no insecure block timestamp/hash for value-bearing randomness.
- Denial of service: bounded loops, pull over push payments.
- Events: emit security-relevant state changes.
- Tests: cover exploit paths and permission failures.

Prefer OpenZeppelin primitives over custom security code.
