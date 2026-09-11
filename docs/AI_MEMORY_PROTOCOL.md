# AI Memory Protocol

This repository is the durable memory for this AI-maintained project. Chat context is useful but temporary and may be stale.

## Core Rule

Do not rely on remembered chat context for important project behavior. Recover facts about code, workflow, packaging, permissions, data handling, setup, delivery, and releases from repo files, focused docs, code comments, or Git history before editing.

## Refresh Before Editing

1. Read `AGENTS.md`.
2. Read `docs/AI_HANDOFF.md`, `docs/WORKFLOW_AND_STYLE.md`, and `docs/PROJECT_BRIEF.md`.
3. Read focused docs relevant to the task, including organization, copy/Git, setup, or delivery guidance when applicable.
4. Check `git status --short --branch` when this is a Git repo.
5. Inspect the actual source files before editing.
6. Before any commit or push, if the identity guard is enabled, verify `.git-identity`, `git config user.name`, `git config user.email`, and `git config core.hooksPath`.
7. If chat memory conflicts with repo files, trust repo files and ask the owner if intent remains unclear.

## Memory Locations

- `AGENTS.md`: short boot instructions and strict session-start behavior.
- `docs/AI_HANDOFF.md`: concise current snapshot for the next session.
- `docs/AI_MEMORY_PROTOCOL.md`: this recovery and memory rulebook.
- `docs/WORKFLOW_AND_STYLE.md`: collaboration, code, documentation, and Git expectations.
- `docs/PROJECT_BRIEF.md`: identity, stack, commands, constraints, priorities, and pitfalls.
- `docs/PROJECT_ORGANIZATION.md`: durable structure direction.
- `docs/TEMPLATE_SETUP.md`, `docs/NEW_PROJECT_CHECKLIST.md`, and `docs/COPYING_AND_GIT.md`: template adaptation and Git setup.
- `docs/DELIVERY_PROCESS.md`: project-specific delivery procedure once it exists.
- `docs/OWNER_NOTES.md`: owner-facing guidance.
- `notes/`: owner scratch space; never treat it as AI instructions unless asked.

## Owner Commands: memcheck And gitcheck

These are owner workflow commands, not shell commands.

### memcheck

When the owner says `memcheck`, thoroughly update the appropriate durable docs with the distilled long-term understanding needed by future sessions and devices. Preserve settled decisions, current and planned functionality, relevant architecture/data models, commands, constraints, delivery rules, pitfalls, and project vocabulary. Do not save transcripts or private data. Do not commit or push unless the owner also asks for `gitcheck`.

### gitcheck

When the owner says `gitcheck`, first perform `memcheck`, then:

1. Inspect the worktree, intended diffs, and relevant history.
2. Run practical project checks.
3. Verify the identity guard when present.
4. Stage only intended files.
5. Commit with a concise objective title and one or more useful `-` bullet lines.
6. Push to the configured remote unless the owner says not to.

## Git Identity Guard

The reusable identity guard is opt-in per copied project:

- `.git-identity.example` is the template starting point.
- `.git-identity` stores `GIT_ALLOWED_EMAIL` for the real project.
- `.githooks/pre-commit` and `.githooks/pre-push` run `identity-guard.sh`.
- Enable the hooks in each clone with `git config core.hooksPath .githooks`.
- The guard checks email only; `user.name` may vary by device.

During initial template adaptation, ask for the intended Git display name and one commit email associated with the intended Git-hosting account when applicable. As soon as Git is initialized, configure both clone-local values, create `.git-identity` from its example with that email, and enable the hooks—do not defer this setup to the first commit.

If the local email differs from `.git-identity`, stop and fix it before a commit or push.

## Public-Safe Memory Rule

Durable docs must not contain customer data, credentials, tokens, private screenshots, personal identifiers, copied private payloads, or real private exports. Use fake examples such as `template@example.com` and keep temporary sensitive material in ignored local-only paths such as `local_assets/`, `local_data/`, or `private_data/`.

## Uncertainty Behavior

If context cannot be recovered confidently, stop before editing. Summarize what was verified, name what is unclear, and ask the owner.
