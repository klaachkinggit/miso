---
name: stripe-projects
description: Provision third-party services from https://projects.dev/providers using Stripe Projects CLI; create/retrieve API keys or tokens.
allowed-tools:
  - Bash(stripe *)
  - Bash(which stripe)
  - Bash(brew install stripe/stripe-cli/stripe)
  - Bash(brew upgrade stripe/stripe-cli/stripe)
  - Bash(scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git)
  - Bash(scoop install stripe)
  - Bash(sudo apt *)
  - Bash(curl -s https://packages.stripe.dev/*)
  - WebFetch
  - Skill
  - Read
---

# Stripe Projects

Provision service credentials through Stripe Projects.

## Flow

1. Fetch `https://projects.dev/providers`. If provider absent, stop.
2. Check CLI:

```bash
which stripe && stripe --version
```

3. Install/upgrade Stripe CLI if needed.
4. Install plugin:

```bash
stripe plugin install projects
```

5. Search catalog:

```bash
stripe projects search <query> --json
```

If `result_count` is 0, stop.

6. Check/init project:

```bash
stripe projects status --json
stripe projects init --json --yes
```

If browser auth opens, tell user to finish auth and report back.

7. Add service with non-interactive flags: `--json --yes`; paid services need `--confirm-paid-service`.
8. Return env var names in table. Never print secret values.

## Hard Stops

- Never read `.projects`.
- Never read generated `.env`.
- Never hand-edit CLI-managed files.
- Suggest 3-5 complementary providers only from real catalog output.
