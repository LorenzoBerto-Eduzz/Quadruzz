# Copying And Git

Every project created from this template must have its own Git repository, history, remote, and allowed contributor identity.

## What Transfers

- Copy the project frame: `project/`, `docs/`, `notes/`, `asset_staging/`, `scripts/`, `.githooks/`, editor/Git settings, and template docs.
- Do not copy `.git/`; it contains another project's history, branches, remotes, and repository identity.
- Do not copy local/private folders or generated artifacts such as `local_assets/`, `local_data/`, `private_data/`, `exports/`, `artifacts/`, or zip files.

`scripts/New-AIProject.ps1` performs this safe copy when a new destination folder does not yet exist.

## Recommended New Project Flow

1. Create a clean copy of the template and rename its outer folder.
2. Open the copied folder in an AI session.
3. Ask the AI to read `AGENTS.md`, `docs/TEMPLATE_SETUP.md`, and `docs/NEW_PROJECT_CHECKLIST.md`.
4. Adapt the project identity, source layout, commands, ignore rules, and durable docs to the real project.
5. Ask the owner for the intended Git display name and one commit email associated with the intended Git-hosting account when applicable.
6. Copy `.git-identity.example` to `.git-identity`, set the allowed email, configure the clone-local name/email, and enable the hooks immediately after Git is initialized.
7. Initialize Git when the project frame is ready.
8. Add a remote and make the first project-specific commit only when the owner explicitly requests it.

## Git Identity Guard

`.githooks/` contains reusable hook source. Once a copied project has a real `.git-identity`, enable it in that clone:

```powershell
Copy-Item .git-identity.example .git-identity
git config user.name "Owner Name"
git config user.email "your.allowed.email@example.com"
git config core.hooksPath .githooks
```

Then set `GIT_ALLOWED_EMAIL` in `.git-identity` to the same email. Confirm it is recognized by the chosen Git-hosting account when that service uses email attribution. The guard checks email only; configure the requested `user.name` but do not make hooks reject alternate device-specific names.

Before committing or pushing, verify:

```powershell
Get-Content .git-identity
git config user.name
git config user.email
git config core.hooksPath
```

If the configured email differs from `.git-identity`, stop and fix it before committing or pushing.
