# Project Brief

## Identity

- Project name: `Quadruzz`
- Project kind: `Shared live workspace web application`
- Main project folder: `project/`
- Primary language/stack: `TypeScript, React 19, Vinext, Vite, Tailwind CSS, and Cloudflare Workers through ChatGPT Sites`

## Purpose

Cross-Quadruzz is the initial hosted team-workspace instance for approved colleagues. Its hosted Site is the HQ/control center, while the Chrome Companion overlay is the primary daily interface and defines member activity. See `docs/PRODUCT_SPEC.md` for the settled boundaries.

## Audience Or Users

Authenticated, invited colleagues.

## Current Scope

Repository setup and the initial Cross-Quadruzz implementation are complete. Authentication, access requests, D1/R2-backed members and profiles, presence, the minimal board, direct authenticated entry, and the settings/request workflow are deployed on the existing Site.

The agreed initial product direction is:

- a restrained modern interface on a muted dark-blue background;
- an authenticated profile with a display name and circular profile image;
- all currently connected users shown in the central workspace;
- a small fixed settings button for profile editing and logout;
- heartbeat-based presence expiry; and
- future shared state backed by Sites storage.

The local unpacked Companion is implemented in `project/extension/`. It securely authorizes through the authenticated website and stable OpenAI user ID, reuses server-enforced permissions/live data, and appears as a persistent floating overlay on the focused tab. The toolbar icon or Alt+Shift+Q toggles the member popup; Alt+Shift+D toggles the shared acting-status picker; Alt+Shift+S toggles the shared-note editor. Hidden mode receives five-second stacked notifications for new notes from other members. Version `0.1.0` has been submitted for Chrome Web Store review while local development continues.

## Run And Test Commands

```text
Install: cd project; npm install
Run: cd project; npm run dev
Build: cd project; npm run build
Lint: cd project; npm run lint
Test: no automated test command is defined yet
```

If commands are not known yet, write `unknown` and ask before assuming.

When a command requires one-time local registration or a machine-specific tool path, record the portable repository command here and link to its per-device setup instructions. Do not treat a shell alias existing on one computer as sufficient project documentation.

## Delivery Or Release Process

- Delivery command/policy: `Preserve the existing Sites project ID; deploy only after an explicit owner request and successful build.`
- Versioning/release authority: `The owner authorizes deployments and releases.`
- Preferred public hostname: `cross-quadruzz.l-busslerberto.chatgpt.site`, if available.

Keep this brief summary current. Put detailed build, export, package, deployment, or publish instructions in `docs/DELIVERY_PROCESS.md` only after the project has a real process.

## Important Constraints

- Preserve `project/.openai/hosting.json`, its existing Site project ID, and the hosted connection.
- Do not deploy or alter live Site access without explicit owner authorization.
- Keep the interface minimal and extend only owner-approved functionality.
- Treat profiles, presence, and shared workspace data as authenticated, privacy-sensitive data.
- Treat recent authenticated Companion traffic as canonical activity. The member-list GET renews activity at least every 10 seconds when needed because Chrome may suspend background workers and suppress separate heartbeat POSTs; expire activity after 30 seconds without extension traffic.
- Continue using the existing Sites D1 and R2 bindings for shared state and profile images.
- Preserve the existing Vinext/npm structure and lockfile unless a requested change requires otherwise.

## Current Priorities

1. Continue polishing the Companion popup; acting-state controls, shared member notes, and hidden-state note notifications are implemented.
2. Keep the hosted Site as the HQ for access, profiles, membership, logs, and instance configuration.
3. Keep authorization, membership, live data, and revocation server-authoritative and shared across Site and Companion.
4. Defer dragging/saved coordinates. After Store approval, connect the HQ installation prompt to the approved listing.
## Glossary

- **Companion activity:** approved users whose authorized extension has made recent authenticated traffic; this is the canonical vivid/dim and online state.
- **Central workspace:** the primary surface where currently connected colleagues appear.
- **Sites project:** the existing hosted ChatGPT Sites application identified by `project/.openai/hosting.json`.
- **Quadruzz Companion:** the implemented local Chrome overlay for Cross, designed to evolve toward a global multi-instance extension.
- **Extension authorization:** a revocable server-issued credential created through the authenticated Cross Site and bound to the stable OpenAI user identity.

## Known Pitfalls

- The source was copied from an existing ChatGPT Sites application; do not replace or regenerate its hosting manifest.
- The old test screen is gone. Preserve the deployed minimal board and direct-entry authentication flow.
- `npm run build` writes generated output under `project/dist/`; generated output must remain untracked.
- The public Git remote is `https://github.com/LorenzoBerto-Eduzz/Quadruzz.git`.
- Reloading the unpacked extension leaves old injected tab contexts invalid; refresh open test tabs after every extension reload.

## Settled Product Specification

Use `docs/PRODUCT_SPEC.md` as the authoritative product specification before implementation. It records the authenticated OpenAI user-ID boundary, pending-access privacy rules, permanent owner and role permissions, required onboarding profile, Companion-defined activity with 90-second expiry, D1/R2 responsibilities, settings/admin scope, and deferred dragging/distribution work.
