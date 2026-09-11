# Owner Notes

Quadruzz uses this project frame to keep the actual Site source separate from durable context, allowing work to continue across devices and AI sessions.

## What The Folders Are For

- `project/`: the actual application, tool, library, site, automation, game, or service. Rename it only intentionally.
- `docs/`: durable project memory, AI handoff, workflow rules, development-environment/setup guidance, and focused design/architecture notes.
- `asset_staging/`: raw/reference/transfer assets that are safe to synchronize but are not yet source assets.
- `local_assets/`: private or one-machine material. Its contents are ignored and AI should inspect it only when asked.
- `notes/`: your scratchpad and planning area. AI should not treat it as instructions unless you tell it to.
- `scripts/`: optional repeatable repository automation; this template includes only the safe-copy helper. Future project helpers should keep reusable behavior in Git while device-specific paths and terminal registration remain local, following `docs/PORTABLE_HELPER_SCRIPTS.md`.

## Starting A Real Project

1. Create a clean copy with `scripts/New-AIProject.ps1` or a manual copy without `.git/` and local/generated folders.
2. Open the copied project in an AI session.
3. Ask it to read `AGENTS.md`, `docs/TEMPLATE_SETUP.md`, and `docs/NEW_PROJECT_CHECKLIST.md`.
4. Describe the project and let it inspect the actual source before deciding stack-specific rules.
5. During setup, tell the AI the desired Git display name and commit email for the intended Git-hosting account. Configure clone-local `user.name`, the matching `user.email`, `.git-identity`, and `.githooks` immediately after Git initialization—not only when the first commit is due.
6. Fill `docs/DEVELOPMENT_SETUP.md`, then run `scripts/Test-ProjectSetup.ps1` to find incomplete setup.

## Owner Commands

### memcheck

Ask for `memcheck` when the AI should save the durable outcome of discussion and work: settled decisions, functionality, plans, constraints, commands, pitfalls, and shared vocabulary. It does not commit or push.

### gitcheck

Ask for `gitcheck` when the AI should perform `memcheck`, inspect and validate current work, confirm Git identity, stage intended files, commit with a useful title/bullets, push, and publish that exact commit to the existing live Quadruzz Site unless you say not to deploy.

### Delivery Commands

Local validation uses `npm run build` from `project/`. While the owner's standing live-development authorization remains active, every requested Quadruzz development/fix—and every `gitcheck`—preserves the existing Sites connection and audience, validates and commits the source, then publishes that exact commit to the live Site without asking again. The owner may explicitly revoke this mode.

## Ground Rules

- Keep private data, credentials, exports, screenshots, and customer material out of Git.
- Ask before broad restructuring, deleting significant files, changing technology, or changing how the project is delivered.
- Ask AI to recommend first when you want options rather than immediate changes.
- Keep the template docs factual and current through `memcheck`; do not use them as full chat transcripts.
