# AI Handoff

This is the portable continuity note for AI coding sessions working on this repository. Keep it a concise current snapshot, not a diary or changelog.

## Current State

- Product: **Cross-Quadruzz**, one specific hosted team workspace.
- Main project folder: `project/`.
- Stack: TypeScript, React 19, Vinext, Vite, Tailwind CSS, and Cloudflare Workers through ChatGPT Sites.
- Run: `cd project; npm run dev`.
- Validate: `./scripts/Test-ProjectSetup.ps1` and `cd project; npm run build`.
- No automated test command is defined yet.
- Preserve the existing Sites project ID, hosted connection, audience, and D1/R2 data. Standing owner authorization is active: requested Quadruzz development/fixes should be validated, committed, pushed, and deployed to the live Site automatically until the owner explicitly revokes this mode.
- Preferred public hostname: `cross-quadruzz.l-busslerberto.chatgpt.site`, if available.
- The source repository remains local; no Git remote is configured.
- Git is initialized on `main` with identity `Lo <lorenzo.berto@eduzz.com>` and the identity guard enabled.
- Dependencies are installed; the setup verifier and production build passed.
- Cross-Quadruzz authentication, access requests, D1/R2-backed membership and profiles, presence, the minimal member board, and the settings approval popup are implemented and deployed at the preferred hostname.
- Settled route structure: `/` is the complete workspace and all account-dependent states; signed-out visitors are redirected to `/authentication`; sign-in returns to `/`; legacy `/workspace` redirects to `/`.
- The ignored `tmp/sites-reference/` scaffold exists only to inspect official Sites auth/D1/R2 patterns; do not commit it.
- The settings popup is functional: every approved member can edit their profile and see and decide pending requests. Only the permanent host can remove another ordinary member through the compact × action; the host cannot be removed. No role labels are shown.

## Settled Product Direction

- Quadruzz Companion is deferred until after continued hosted-page development. It will eventually be one global, multi-instance-ready Chrome extension distributed as an unlisted Chrome Web Store item; Cross is its initial instance.
- Companion will expose a toolbar popup, a persistent side panel beside any tab, and native notifications. It will pair securely through the authenticated Quadruzz website to the stable OpenAI user ID, use the hosted product's live backend data and server-enforced permissions, and keep only non-authoritative device preferences locally. Member removal or pairing/access revocation must invalidate extension access.

- The public URL shows only Sign in with ChatGPT. Signed-in users request access and remain pending until approved. Anonymous and pending users see no board or member data.
- Identity is the stable authenticated OpenAI user ID. IP, device, browser profile, and display name are not identity; separate OpenAI accounts are separate Quadruzz identities.
- The current Site owner account is the permanent host. All other approved accounts are members; there is no admin role. Every member can manage requests, edit board settings, and edit their own profile. Only the host can remove another member or clear test data; the host cannot be removed.
- Approved first-time members must provide a display name and profile image.
- Every registered member remains visible in fixed first-join order; offline members are dimmed.
- Use a minimal pale muted dark-blue interface with a fixed settings button.
- Use Sites D1 for members, roles, requests, profiles, presence, board state, and later coordinates. Use Sites R2 for profile images.
- Presence follows open authenticated tabs, not focus: each tab has its own 15-second heartbeat session, closes its session on tab exit, and uses a five-minute stale-session cutoff only as a crash/connectivity fallback; a member stays present while any session is active.
- Synchronize request/approval/profile/presence views and future board changes about four times per second while relevant pages are open, using non-overlapping checks. Mutations update the acting browser immediately; server ordering/version metadata must protect future drag updates from stale overwrites.
- Treat this as the global shared-state rule for all future colors, images, elements, settings, and coordinates. The current Sites D1/R2 configuration exposes no supported shared broadcast binding, so retain reliable 250 ms synchronization until a supported true realtime channel becomes available.
- Profile onboarding saves name and image together in one server interaction, then returns the completed workspace payload.
- Predecode the selected onboarding image locally; after upload confirmation, show that ready local circle immediately and swap to the permanent versioned R2 URL only after it decodes.
- Before a new/changed member payload becomes visible, preload and decode its versioned profile-image URL; commit the payload only after decoding so image appearance and layout rearrangement happen in one frame.
- Use empty image alternative text and hide a failed image element so broken-image icons or member-name fallback text never appear in a profile circle.
- The root server-renders the authenticated workspace payload, optimistically includes the approved viewer as present, and lets HTML start visible-image downloads immediately. After hydration the client registers the tab session, reveals visible circles together after decode, and preloads offline images in the background. Settings remain scrollable without a visible scrollbar, with owner Remove/role actions aligned at the row right.
- Settings cover profile editing, profile reset/deletion, sign-out, and member-visible request decisions. Host-only administration covers member removal and clearing test data; there is no admin-role management.
- Dragging and saved coordinates come later.
- `docs/PRODUCT_SPEC.md` is the focused authoritative specification.

## Working Procedure For Future AI Sessions

1. Read root `AGENTS.md`, this handoff, the memory protocol, workflow/style rules, project brief, and `docs/PRODUCT_SPEC.md`.
2. Read focused docs relevant to the task and inspect real source files before editing.
3. Before delivery work, read `docs/DELIVERY_PROCESS.md` and require explicit owner authorization.
4. Check Git status and recent history; preserve user work.
5. If chat memory conflicts with repo files, trust repo files and ask if intent remains unclear.

## Suggested Near-Term Next Steps

- Continue improving and completing the hosted Cross page and its approved shared-workspace features.
- Keep authorization, instance membership, live data, and revocation behavior server-enforced and interface-neutral enough for the future Companion to reuse.
- Defer Companion implementation, Chrome Web Store packaging, and extension distribution until explicitly requested.
- Validate each hosted-page change locally and follow the current owner authorization for delivery unless a request explicitly says not to commit or deploy.

## Durable Workflow Decisions

- The repo, not chat memory, is the source of truth.
- `memcheck` updates durable memory only.
- For Quadruzz, `gitcheck` performs `memcheck`, validation, identity verification, staging, commit, push, and deployment of that exact commit to the existing live Site unless the owner explicitly says not to deploy.
- Local build verification does not authorize deployment.

## Settled Door And Settings Flow (2026-09-09)

- Signed-in unapproved accounts submit display name, profile image, and access request together from the Cross-Quadruzz door. Pending profile data expires after 24 hours; rejection and expiry delete it. Approval creates the completed member profile directly, with no second onboarding step.
- The permanent host bypasses approval and uses the profile door only if incomplete.
- All approved members see and decide pending requests inline in the Members list. Only the host can remove an approved member; the host is protected.
- Settings has a You section with profile controls and sign-out, a horizontal separator, then a unified Members list. There is no popup header, role label, or close icon; gear toggling and outside click close it.

- Live access-state reads are cache-disabled, and every signed-in door state continues synchronizing so approval always transitions an open requesting tab directly to the board without manual refresh.

- Request submission switches immediately to the waiting presentation while upload completes; settings and board avatars remain hidden until fully loaded; sign-out clears all presence sessions for the account before leaving.
