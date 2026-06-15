---
name: deploy-to-vercel
description: Deploy apps/sites to Vercel. Use when user asks to deploy, publish live, create preview, or get deployment URL.
metadata:
  author: vercel
  version: "3.0.0"
---

# Deploy To Vercel

Default: preview deploy. Production only if user explicitly asks.

## Preflight

Run:

```bash
git remote get-url origin 2>/dev/null
cat .vercel/project.json 2>/dev/null || cat .vercel/repo.json 2>/dev/null
vercel whoami 2>/dev/null
vercel teams list --format json 2>/dev/null
```

If multiple teams, ask for team slug once. Then pass `--scope <team-slug>`.

Linked project means `.vercel/project.json` or `.vercel/repo.json` exists. Do
not use `vercel project inspect`, `vercel ls`, or `vercel link` just to detect
state in unlinked dirs; they can prompt or mutate.

## Method

- Linked + git remote: ask before commit/push. Push triggers Vercel. Then fetch preview URL from `vercel ls --format json` when authenticated.
- Linked + no git remote: run `vercel deploy [path] -y --no-wait`; inspect with `vercel inspect <deployment-url>`.
- Unlinked + authenticated: link first. With git remote prefer `vercel link --repo --scope <team-slug>`. Without git remote use `vercel link --scope <team-slug>`.
- CLI missing/auth missing: install Vercel CLI, have user auth, link, deploy.

Production:

```bash
vercel deploy [path] --prod -y --no-wait
```

Use only after explicit production request.

## Rules

- Never push or deploy production without explicit approval.
- Use `--no-wait`; inspect status after.
- Preserve `.vercel/` link files when already present.
- Report final preview/production URL and any build failure URL.
