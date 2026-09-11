# Template Setup

This guide turns the template into a real project without losing the continuity system that lets future AI sessions work safely.

## What The Template Provides

- a source-project frame (`project/` by default);
- durable AI and owner memory in `docs/`;
- Git-safe staging and local-only private-material boundaries;
- an email-based Git identity guard;
- a stack-neutral setup checklist, environment guide, setup verifier, copy/Git guide, and delivery policy.

It does not decide your stack, framework, package manager, source layout, test command, build process, deployment, or release workflow.

## Adaptation Order

1. Read `AGENTS.md`, `docs/AI_HANDOFF.md`, `docs/AI_MEMORY_PROTOCOL.md`, `docs/WORKFLOW_AND_STYLE.md`, this guide, and `docs/NEW_PROJECT_CHECKLIST.md`.
2. Inspect the actual files inside the main source folder. Do not infer a stack merely from a folder name.
3. Identify the project kind, primary stack, package/dependency files, real run/test commands, generated paths, and local-secret needs.
4. Ask the owner only for facts that cannot be recovered safely: project identity, users, folder choice, delivery expectations, remote, intended Git display name, and one commit email associated with the intended Git-hosting account when applicable.
5. Replace template placeholders throughout the repo. Search for unresolved placeholder markers and resolve every meaningful occurrence.
6. Update `docs/PROJECT_BRIEF.md` first, then `docs/DEVELOPMENT_SETUP.md`, `docs/AI_HANDOFF.md`, `AGENTS.md`, `README.md`, and focused organization/workflow docs.
7. Tune ignore rules and attributes for the real stack. Do not add a build/release process unless the project needs one.
8. If development helpers or terminal shortcuts are needed, keep their reusable logic in `scripts/` and follow `docs/PORTABLE_HELPER_SCRIPTS.md` for per-device setup.
9. Configure the Git identity guard and initialize Git only in the copied real project.

## Main Source Folder

The default main project folder is `project/`. You may rename it to a project-specific name such as `web/`, `app/`, `api/`, `service/`, `library/`, or `game/`.

If renamed, update every root document that refers to `project/`, including `AGENTS.md`, `README.md`, `docs/AI_HANDOFF.md`, `docs/PROJECT_BRIEF.md`, `docs/PROJECT_ORGANIZATION.md`, and `docs/OWNER_NOTES.md`.

On Windows, scripts extracted from a downloaded ZIP may retain a downloaded-file marker and be blocked by PowerShell. For a template obtained from a trusted source, review the scripts and use `Get-ChildItem .\scripts\*.ps1 | Unblock-File`. Do not weaken the machine-wide execution policy or unblock untrusted scripts.

## Git Setup

The template intentionally contains no `.git/` folder and no ready-to-use `.git-identity`.

Capture Git identity during project setup—not at the first commit. Ask the owner for:

- the desired clone-local `git user.name` for commit display;
- one exact `git user.email` intended for commits and associated with the chosen Git-hosting account when that service uses email attribution.

The guard intentionally enforces the selected commit email while still requiring the AI to configure the requested display name for this clone. Hosting services differ in how they display or attribute commits, so verify the email with the chosen host when applicable.

For a new copied project:

```powershell
Copy-Item .git-identity.example .git-identity
# Set GIT_ALLOWED_EMAIL in .git-identity before the first commit.
git init
git config user.name "Owner Name"
git config user.email "your.allowed.email@example.com"
git config core.hooksPath .githooks
git add .
git commit -m "Set up AI-ready project frame"
git branch -M main
```

Add a remote and push only when the owner is ready. Immediately after this setup, confirm `git config user.name`, `git config user.email`, and `GIT_ALLOWED_EMAIL` in `.git-identity`; the two email values must match exactly.

For an existing repository, merge the template frame carefully rather than overwriting existing `README.md`, ignore rules, editor settings, or project-specific docs. Read `docs/COPYING_AND_GIT.md` first and review every diff.

## Do Not Invent These Facts

- a stack, framework, run/test command, remote, deployment, or release path;
- a folder restructuring or renamed source root without approval;
- a Git identity or remote;
- a package/export/deployment command;
- a dependency on `local_assets/` or any other local-only material.

## Adaptation Complete When

- `README.md`, `AGENTS.md`, `docs/PROJECT_BRIEF.md`, and `docs/AI_HANDOFF.md` describe the real project.
- Template placeholders are resolved or intentionally marked `unknown` with a next action.
- Actual source files and project commands have been inspected and documented.
- `docs/DEVELOPMENT_SETUP.md` records real supported environments, required tools, local setup, and a smoke test.
- Any helper commands are reproducible from tracked scripts, with machine-specific setup documented separately.
- `docs/PROJECT_ORGANIZATION.md` suits the real project type.
- Ignore rules protect dependencies, builds, secrets, private data, and generated artifacts for the chosen stack.
- `.git-identity` exists only in the copied project, has the real allowed email, and hooks are enabled in the clone.
- A delivery workflow is documented only if the real project has one.
- `notes/` remains owner-controlled and Git is initialized only in the copied project.
- `scripts/Test-ProjectSetup.ps1` passes after adaptation without allowing placeholders.

## Useful First Prompt For Another AI Chat

```text
Read AGENTS.md, docs/TEMPLATE_SETUP.md, and docs/NEW_PROJECT_CHECKLIST.md. Inspect the real source files, then adapt this template to the project I am starting. Replace only facts you can verify or that I provide, ask me only for materially important unknowns, and preserve the memcheck/gitcheck workflow. Do not create commits, release artifacts, or broad structural changes unless I explicitly ask.
```
