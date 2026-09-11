# Development Setup

This guide reproduces a working Quadruzz development checkout. Ordinary commands are summarized in `docs/PROJECT_BRIEF.md`.

## Supported Environments

- Operating systems/platforms: `Windows is currently verified; the Node-based project is expected to remain cross-platform.`
- Supported terminal/shells: `PowerShell is currently verified.`
- Architecture constraints: `Node.js 22.13.0 or newer; hosted server code must remain Cloudflare Workers compatible.`

## Required Tools

Record only tools that are actually required. Include an exact version or supported range when compatibility matters.

| Tool | Version | Purpose | Installation source |
|---|---|---|---|
| Tool | Version | Purpose | Installation source |
|---|---|---|---|
| Node.js | 22.13.0 or newer | Application runtime and build tooling | https://nodejs.org/ |
| npm | Bundled with the selected Node.js release | Dependency installation and scripts | https://docs.npmjs.com/ |
| Git | Current supported release | Source control and identity hooks | https://git-scm.com/ |

Prefer official installation sources. Do not place credentials, license keys, private package tokens, or personal paths in this tracked file.

## First-Time Setup

1. Install Node.js 22.13.0 or newer and Git.
2. Clone or copy the repository using `docs/COPYING_AND_GIT.md`.
3. Configure the clone-local Git identity and identity guard as documented there.
4. Run `npm install` from `project/`.
5. Run `.\scripts\Test-ProjectSetup.ps1` from the repository root.
6. Run `npm run build` from `project/`.
7. For local development, run `npm run dev` from `project/`.

## Machine-Local Configuration

Document what each developer/device must configure locally, where it is stored, and how to recreate it. Provide tracked `.example` files only when useful and safe.

- Local executable/tool paths: `Node.js, npm, and Git must be discoverable on PATH.`
- Environment/secrets setup: `No application secrets are currently required. Keep future values in ignored .env files and hosted runtime configuration.`
- Local command registration: `None.`

If terminal shortcuts are installed, state whether they require a shell profile. Prefer profile-independent launchers for commands that must also work in restricted or isolated development terminals; follow `docs/PORTABLE_HELPER_SCRIPTS.md`.

## Verification

Record a short, deterministic check that confirms the environment is usable:

```text
Setup verification: .\scripts\Test-ProjectSetup.ps1
Project smoke test: cd project; npm run build
```

## Troubleshooting

- Do not run a Sites initializer over `project/`; it is a retained existing Site checkout.
- Do not replace `project/.openai/hosting.json`; it contains the existing hosted-project connection.
- Build output and local Wrangler state are generated and ignored.
