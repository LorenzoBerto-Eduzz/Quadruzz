# Delivery Process

Quadruzz is connected to an existing ChatGPT Sites project. This document distinguishes local validation from a future authorized deployment.

## Default Rule

The owner has granted standing authorization for requested Quadruzz development and fixes to be validated, committed, pushed, and deployed to the existing live Site automatically until the owner explicitly revokes this mode. `gitcheck` also authorizes the same complete delivery flow. Use the shortest safe path, preserve the existing Site/project ID and audience, and do not clear D1/R2 data. A local production build alone is not a live update.

## Current Build

- Source: `project/`.
- Command: `npm run build` from `project/`.
- Generated output: `project/dist/`, which remains ignored.
- Hosting metadata: `project/.openai/hosting.json`; preserve its existing project ID and bindings.
- Repository: one monorepo rooted above `project/`, published at `https://github.com/LorenzoBerto-Eduzz/Quadruzz.git`.
- Deployment authority: the owner.

`gitcheck` is the project-specific delivery command: after memcheck, validation, identity verification, commit, and push, package that exact commit, save a Sites version, and deploy it to the existing Site. Preserve the current audience and never clear D1/R2 data as part of deployment.

## Before Any Delivery

1. Inspect the intended source changes and Git state.
2. Run relevant validation for the project.
3. Confirm the requested target, version, and scope.
4. Confirm no private data, credentials, or unintended generated files will be included.
5. Report exactly what was created, uploaded, or deployed.

For an explicitly authorized Sites deployment, follow the current Sites hosting workflow, reuse the existing project ID, verify the Site's current access level before publishing, and never store source credentials in files or Git configuration.


Because Sites requires a Git repository rooted at the selected Site source, prepare an ignored temporary checkout containing the tracked `project/` tree for deployment. Commit that exact source in the temporary checkout, use the short-lived Sites credential only for the push command, and remove the checkout afterward. Do not restore `project/.git` or commit generated build output to the monorepo.
