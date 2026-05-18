-- Migration 0016 — Extend currency enum with EUR.
--
-- Postgres requires a new enum value to be committed before it can be used
-- in DML, so the data rewrite + check constraint swap lives in 0017.

alter type currency add value if not exists 'EUR';
