# ADR-0007 — Backend-Owned Event Chain Authority

- **Status:** Proposed
- **Date:** 2026-06-21
- **Deciders:** Miso maintainers

## Context

Organization admins need to manage event content, but deployed contract authority fields on `events` feed backend wallet operations. The organization-admin RLS policy allowed broad event updates, which meant a directly authenticated client could attempt to mutate `nft_contract_address` or `role_admin_address` if table privileges allowed the column update.

## Decision

Event chain authority columns are backend-owned and not client-updatable.

- Keep organization-admin RLS for normal event management.
- Revoke `UPDATE` on `events.nft_contract_address` and `events.role_admin_address` from `anon` and `authenticated`.
- Keep service-role server code as the writer for deploy and chain authority updates.

## Alternatives Considered

- **Split event management into separate public/admin tables —** rejected as too large for the current hardening patch.
- **Use RLS `with check` only —** rejected because RLS cannot express per-column update restrictions against the previous row value.
- **Move chain authority fields to a new service-only table immediately —** rejected because it needs app-wide read/write rewiring and a backfill plan.

## Consequences

- Upside: organization admins keep event management access without owning backend chain authority fields.
- Upside: service-role deploy, mint, transfer, and redeem flows remain unchanged.
- Cost we're accepting: future client-side event editors must avoid these columns or they will receive permission errors.
- Cost we're accepting: a fuller schema split may still be desirable later.
- Reversibility: medium; privileges can be granted back, but doing so would reopen the authority risk.

## Links

- Handoff: docs/handoffs/2026-06-20-audit-pass-1.md
