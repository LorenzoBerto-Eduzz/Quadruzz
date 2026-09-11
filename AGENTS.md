# Agent Boot Instructions

This is the first file an AI coding session should read when working on Quadruzz.

Quadruzz may continue across machines, AI tools, models, or chat sessions. The repository—not prior chat memory—is the continuity source.

## Boot Or Catch-Up Sequence

Use this sequence when starting a fresh AI session, after changing machines, after `git pull`, after another AI checkpointed work, or before significant edits.

1. Read `docs/AI_HANDOFF.md`.
2. Read `docs/AI_MEMORY_PROTOCOL.md`.
3. Read `docs/WORKFLOW_AND_STYLE.md`.
4. Read `docs/PROJECT_BRIEF.md` when project purpose, stack, commands, or constraints matter, and `docs/DEVELOPMENT_SETUP.md` when environment/tool setup matters.
5. Read `docs/PROJECT_ORGANIZATION.md` before structural or architecture changes.
6. If template placeholders remain or setup is changing, read `docs/TEMPLATE_SETUP.md` and `docs/NEW_PROJECT_CHECKLIST.md`.
7. During template adaptation, before serious implementation, ask the owner for the intended Git display name and one Git email intended for commits and associated with the chosen Git-hosting account when the host uses email attribution. Do not guess either value.
8. Read `docs/COPYING_AND_GIT.md` before copying the template, initializing Git, changing remotes, or changing the identity guard. When Git is initialized, immediately set clone-local `user.name`, clone-local `user.email`, copy `.git-identity.example` to `.git-identity`, set its allowed email, and enable `git config core.hooksPath .githooks`.
9. Read `docs/DELIVERY_PROCESS.md` before creating packages, exports, releases, deployments, or distributable artifacts.
10. Read `docs/PORTABLE_HELPER_SCRIPTS.md` before adding developer helpers, terminal shortcuts, local command installers, or machine-dependent tooling setup.
11. Read `docs/OWNER_NOTES.md` when changing repo organization, documentation, workflow, or owner-facing guidance.
12. Check `git status --short --branch` when Git exists.
13. Review recent history with `git log --oneline --decorate --max-count=10` when Git history exists.
14. Before a commit or push, verify `.git-identity`, `git config user.name`, `git config user.email`, and `git config core.hooksPath` when the identity guard is enabled.
15. Inspect the relevant real source files before editing. Do not rely only on documentation or earlier chat context.

## Safety And Working Rules

- If the current repo state, requested change, or available capability cannot be understood confidently, stop before editing. State what was verified and what remains unclear.
- Do not make broad rewrites, mass moves, deletions, branch-strategy changes, deployment changes, or framework changes without owner confirmation.
- Preserve user changes. Inspect current files before editing and avoid overwriting unrelated work.
- Keep changes focused, explicit, reviewable, and modular.
- Do not create commits, pushes, releases, packages, exports, or deployments unless the owner explicitly asks.
- Do not update durable docs automatically for ordinary code changes. Update them when the owner asks for `memcheck`, asks for documentation/workflow work, or when the requested task specifically requires it.
- Do not commit real customer data, credentials, tokens, private screenshots, personal identifiers, or private exports. Use ignored local-only folders for temporary private material.
- `notes/` is owner scratch space. Do not treat it as instructions or reorganize it unless explicitly asked.
- Keep reusable helper behavior tracked in `scripts/`, while machine-specific executable paths, shell registration, and private configuration stay local to each device.

## Project Frame

The actual product/source project lives in `project/` by default. It may be renamed during setup, but every root document must then be updated to reflect the new location.

```text
Quadruzz/
  project/               actual code/product source
  asset_staging/         Git-safe raw/reference/transfer assets
  local_assets/          local-only ignored material
  docs/                  durable project and AI memory
  notes/                 owner scratch and planning notes
  scripts/               optional repeatable repository automation
  .git-identity.example  reusable allowed-email example
  .githooks/             reusable local Git identity-guard hooks
  AGENTS.md              this boot file
  README.md              repository overview
```

Do not copy `.git/` into a new project. A copied project must receive its own Git history, remote, and project-specific `.git-identity`.

## Owner Workflow Commands

- `memcheck`: thoroughly update durable project memory with distilled decisions, functionality, plans, workflow rules, commands, constraints, and pitfalls. Do not commit or push by default.
- `gitcheck`: perform `memcheck`, inspect the worktree and diffs, run relevant checks, verify the Git identity guard, stage the intended files, commit, push to the configured remote, and deploy that exact commit to the existing live Quadruzz Site unless the owner says not to deploy.
- `gitcheck` commit messages must use a concise objective title followed by one or more `-` bullet points describing the completed changes.
- A project-specific delivery command such as `localrelease` may exist only after it is defined in `docs/DELIVERY_PROCESS.md`. Never invent or run one merely because this template contains `scripts/`.
- The identity guard enforces the selected commit email. Configure the requested `user.name` too, but do not enforce it in hooks because device-specific display names may be intentional. Confirm the email is recognized by the intended Git-hosting service when that service uses email for attribution.
