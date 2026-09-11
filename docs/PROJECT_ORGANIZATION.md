# Project Organization Direction

This note captures the broad folder organization direction for when the project grows beyond the first few prototype files. Use it before moving folders, adding new major systems, or deciding where a new set of source files/assets should live.

## Core Rule

Keep files near the concept they belong to.

```text
Feature-specific files live with the feature.
Domain-specific files live with the domain concept.
Interface-specific files live with the interface.
Integration-specific files live with the integration.
Shared foundations live in shared/common folders.
```

The goal is to avoid huge folders full of unrelated files and to make deletion/replacement easy later.

## Project Frame

The root of the repo is the project frame:

```text
Quadruzz/
  project/
  asset_staging/
  local_assets/
  docs/
  notes/
  scripts/
```

The actual product/source project lives in `project/` by default. The rest of the folders are there to help humans and AI collaborate safely.

`asset_staging/` is for raw/reference files that are okay to sync through Git. `local_assets/` is for private or machine-local files that should stay ignored unless the user explicitly asks AI to inspect them.

`scripts/` is for small, repeatable repository automation such as setup, validation, development-command, export, or delivery helpers. Shared behavior should be project-relative and tracked; executable paths, shell-profile registration, secrets, and other machine-specific configuration should remain local. Follow `docs/PORTABLE_HELPER_SCRIPTS.md`, and document delivery scripts separately in `docs/DELIVERY_PROCESS.md`.

If `project/` is renamed during setup, update this document and every root-level doc that mentions the main project folder.

## Feature Or Domain Packs

When a project grows, consider grouping files by feature or domain concept instead of by file type only.

Example:

```text
project/
  src/
    features/
      accounts/
        account_model.*
        account_service.*
        account_view.*
        account_tests.*
      billing/
      notifications/
    shared/
      config.*
      logging.*
```

For Quadruzz, follow Vinext and Next-compatible conventions. Keep route-level UI in `app/`, reusable interface primitives in `components/`, and future product features grouped by responsibility when they become substantial.

Use the local stack's conventions when they are strong. This doc is a direction, not permission to fight the framework.

After the real project kind is known, replace this section's examples with conventions that fit that project.

## Interfaces

Interfaces are user-facing or developer-facing ways to see or manipulate the system. This includes UI, CLI commands, debug panels, admin tools, previews, and tuning tools.

Keep temporary/debug interfaces separate from core product logic whenever practical, so they can be removed cleanly.

## Integrations

External services, files, APIs, databases, SDKs, and platform-specific glue should have clear boundaries.

Likely future boundaries, to introduce only when implementation requires them:

```text
project/
  src/
    integrations/
      sites_storage/
      authentication/
```

This makes it easier to swap or remove an integration later.

## Shared Foundations

Shared files are for foundations genuinely used by many features, domains, or interfaces.

Examples:

```text
project/
  src/
    shared/
      config/
      logging/
      errors/
      test_helpers/
```

Use shared folders only when the file really is shared. Do not put feature-specific files in a broad shared folder just because it is convenient at first.

## Current Project Status

`project/` is an existing Vinext application copied from ChatGPT Sites. The main route is `project/app/page.tsx`, global styling is in `project/app/globals.css`, and Sites/Vite integration is configured in `project/vite.config.ts`. Reusable Shadcn-compatible primitives live in `project/components/ui/`. No Quadruzz feature modules have been introduced yet.

If a system becomes complex, create a focused doc under `docs/` only when it fits the project. Examples might include `DEPLOYMENT_MODEL.md`, `DATA_MODEL.md`, `RELEASE_MODEL.md`, `PLUGIN_MODEL.md`, `GAME_MECHANICS.md`, or another project-specific name. Do not create theoretical docs just because the template lists examples.

Do not perform broad reorganizations casually. If a folder move will change many imports, paths, generated files, or user understanding, confirm first and do it as one focused structural change.
