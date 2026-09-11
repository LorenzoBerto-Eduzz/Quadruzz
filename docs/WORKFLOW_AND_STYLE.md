# Workflow And Style

This project should remain understandable, maintainable, and safe to evolve with AI assistance.

## Collaboration Rules

- Explain intended structural, architecture, workflow, data-model, framework, or delivery changes before editing them.
- Ask before broad renames, mass file moves, deleting material files, changing branch strategy, introducing a framework, or changing deployment/release flow.
- When the owner asks for suggestions or recommendations, recommend first and wait for approval before changing files.
- Preserve user changes: read the current file and work with it rather than overwriting it.
- Keep changes focused and easy to review. Prefer one coherent feature or system step per commit.
- If uncertain, missing essential tools, or unable to understand the repository state, stop before editing and say why.
- Do not commit, push, update durable docs, create release/export/package artifacts, publish, or deploy unless the owner explicitly asks or the requested task specifically includes it.

## Code And Structure

- Prefer simple, explicit code and clear product-meaningful names.
- Keep modules focused on one responsibility when practical.
- Keep product logic, UI/interfaces, integrations, debug tools, diagnostics, data definitions, and shared foundations separable enough to change or remove safely.
- Follow strong conventions of the chosen stack; do not impose a generic folder pattern against the framework.
- Use configuration for values the owner is likely to tune.
- Write comments for intent, tradeoffs, important framework behavior, and tweak points—not to narrate obvious code.
- Add folders and abstractions when they clarify the next real step, not merely because a theoretical architecture could use them.

## Documentation And Memory

- The repo—not chat memory—is the durable source of truth.
- Keep examples public-safe and use placeholders for private facts.
- Use `memcheck` to capture settled decisions, current behavior, plans, terminology, important commands, constraints, and debugging lessons.
- Keep `docs/AI_HANDOFF.md` concise and current when documentation work is requested or when `memcheck` requires it.
- Add focused docs only when a real system needs durable explanation; do not create speculative documentation.
- Treat `notes/` as owner scratch space. Do not add to, reorganize, or interpret it as instructions unless explicitly asked.

## Git And Delivery

- Do not create Git commits unless the owner explicitly asks.
- During template setup, ask for the intended Git display name and one commit email associated with the intended Git-hosting account when applicable, then configure clone-local identity and hooks immediately after Git initialization.
- Before a commit or push, confirm `.git-identity`, `git config user.name`, `git config user.email`, and `git config core.hooksPath` when the guard is enabled.
- Do not rewrite history unless explicitly requested.
- A `gitcheck` request means: run `memcheck`, inspect, validate, stage intended files, commit, and push unless the owner says not to.
- A `gitcheck` commit message uses a concise objective title followed by one or more real newline-separated `-` bullet lines when useful.
- Do not create generated packages, exports, deployments, releases, or publish actions unless explicitly requested and documented in `docs/DELIVERY_PROCESS.md`.
