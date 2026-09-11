# Quadruzz

Quadruzz is an early-stage shared live workspace for invited colleagues. The source currently contains the retained ChatGPT Sites application and its existing hosted-project connection; product functionality will be implemented only after the visual direction is aligned with the owner.

The repository uses an AI-ready project frame so future AI sessions, tools, and machines can recover the real project state from tracked documentation instead of relying on chat history.

## Layout

```text
Quadruzz/
  project/               actual code/product source by default
  asset_staging/         Git-safe raw/reference/transfer assets
  local_assets/          local-only ignored files
  docs/                  durable project, workflow, and AI memory
  notes/                 owner scratch and planning notes
  scripts/               optional repeatable repository automation
  .git-identity.example  copy into a project-specific .git-identity
  .githooks/             reusable email identity-guard hooks
  AGENTS.md              AI boot instructions
  README.md              repository overview
```

## Development

The application lives in `project/` and uses npm with Node.js 22.13 or newer.

```powershell
cd project
npm install
npm run dev
```

Validate a checkout with:

```powershell
.\scripts\Test-ProjectSetup.ps1
cd project
npm run build
```

## AI Workflow

`AGENTS.md` is the required AI-session boot file. It points to the handoff, memory protocol, workflow rules, project brief, Git guidance, and delivery policy.

- `memcheck`: save distilled decisions, functionality, plans, constraints, commands, and pitfalls into durable docs only.
- `gitcheck`: perform `memcheck`, inspect and validate the intended work, verify Git identity, commit, and push unless the owner says not to.

AI should not commit, publish, package, export, release, deploy, or inspect local-only material unless explicitly asked.

## Local And Private Files

Use `asset_staging/` for raw/reference material that may be shared through Git but is not yet source code. Use `local_assets/`, `local_data/`, or `private_data/` for private or machine-local material that must stay ignored. Ask explicitly before having AI inspect local-only files.

## Delivery

The existing `.openai/hosting.json` connection must be preserved. Building locally does not authorize publishing; deployment requires an explicit owner request. See `docs/DELIVERY_PROCESS.md`.
