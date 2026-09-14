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
- The complete workspace is one Git repository rooted at `Quadruzz/`; `project/` is a normal tracked folder whose earlier Sites history was imported during consolidation.
- Public GitHub remote: `https://github.com/LorenzoBerto-Eduzz/Quadruzz.git`. Never persist short-lived Sites source credentials.
- Git is initialized on `main` with identity `Lo <lorenzo.berto@eduzz.com>` and the identity guard enabled.
- Dependencies are installed; the setup verifier and production build passed.
- Cross-Quadruzz authentication, access requests, D1/R2-backed membership and profiles, the minimal member board, settings/log popup, and the first local Companion extension are implemented. Companion activity is the canonical online state shared by the extension and Site.
- The Companion/member-list and vivid/dim presence flow was re-tested by the owner and confirmed working after restoring the stable implementation. Preserve this baseline before changing presence again.
- Settled route structure: `/` is the complete workspace and all account-dependent states; signed-out visitors are redirected to `/authentication`; sign-in returns to `/`; legacy `/workspace` redirects to `/`.
- The ignored `tmp/sites-reference/` scaffold exists only to inspect official Sites auth/D1/R2 patterns; do not commit it.
- The settings popup is functional: every approved member can edit their profile and see and decide pending requests. Only the permanent host can remove another ordinary member through the compact × action; the host cannot be removed. No role labels are shown.

## Settled Product Direction

- Quadruzz Companion is now the primary daily interface. The current local unpacked Cross build lives in `project/extension/`; later distribution should be an unlisted Chrome Web Store item and can evolve toward a global multi-instance Companion.
- The Companion now keeps authorization, presence, access, and note synchronization in an extension-owned offscreen worker, independent of the focused page. Ordinary HTTP(S) pages retain the persistent floating top-right overlay; Chrome-protected pages use Chrome's native extension action popup, which closes when focus moves outside it. The toolbar icon and Alt+Shift+Q toggle the member popup, Alt+Shift+D toggles acting-status controls, and Alt+Shift+S toggles note controls. Hidden mode stays active for future notifications. Chrome 127 or newer is required for programmatic action-popup opening from the popup/role/note shortcuts.
- Companion version is `0.1.0`. The unpacked development source is `project/extension/`; the current uploadable archive is `local_assets/cross-quadruzz-extension-0.1.0.zip`. A Chrome Web Store draft has been submitted and is awaiting review, while local testing continues from the unpacked source.
- Companion authorization is issued through the authenticated Cross Site and bound to the stable OpenAI user ID. It uses the same server-authoritative membership/profile/state data as the Site; removal or credential revocation invalidates extension access.
- Approved members can select or create shared acting-status values from their own Companion row. Values preserve the exact capitalization entered. The picker has no outer shadow, keeps typing focus independent from its selected row, starts with the first matching option selected, cycles options and the input row with Tab, and applies the selected row with Enter. The direct picker and full member popup are independent overlay modes: opening the member popup clears any standalone picker/editor state so no stale overlay flashes before the member list; hiding the popup clears both.
- Approved members can publish one shared note of up to two visual lines from their own Companion row or Alt+Shift+S. Notes update optimistically and store a server timestamp. The centralized offscreen sync path detects changes once: injectable pages receive the existing five-second newest-first overlay stack, while protected pages automatically open the native action popup with a stack of new notes for five seconds and then close it. A native Chrome notification is the fallback only when Chrome cannot open that popup. If the member popup is already open, the changed member note updates there and performs one 1.5-second dark-gray-to-white freshness blink instead of queuing a later notification. Opening Q/D/S replaces any protected-page notification stack with the requested member/picker/editor view. Historical notes, removals, and other sessions belonging to the author do not notify.

- The public URL shows only Sign in with ChatGPT. Signed-in users request access and remain pending until approved. Anonymous and pending users see no board or member data.
- Identity is the stable authenticated OpenAI user ID. IP, device, browser profile, and display name are not identity; separate OpenAI accounts are separate Quadruzz identities.
- The current Site owner account is the permanent host. All other approved accounts are members; there is no admin role. Every member can manage requests, edit board settings, and edit their own profile. Only the host can remove another member or clear test data; the host cannot be removed.
- Approved first-time members must provide a display name and profile image.
- Every registered member remains visible. Companion-active members are vivid and sorted first in join order; inactive members are dimmed afterward in join order.
- Use a minimal pale muted dark-blue interface with a fixed settings button.
- Use Sites D1 for members, roles, requests, profiles, presence, board state, and later coordinates. Use Sites R2 for profile images.
- Online/activity is dictated by an authorized Companion running in the browser, regardless of whether its overlay is visible. Merely opening the HQ page does not make a member active.
- A successful authenticated Companion member-list read is itself proof of activity and renews a server-side extension session at least every 10 seconds when needed. This is intentionally authoritative because Chrome may suspend Manifest V3 background workers and suppress separate heartbeat POSTs. Separate popup/background pulses remain redundant fallbacks. Extension sessions expire after 30 seconds without authenticated extension traffic, so abruptly closed browsers and powered-off devices age out promptly.
- Synchronize request/approval/profile/presence views and future board changes about four times per second while relevant pages are open, using non-overlapping checks. Mutations update the acting browser immediately; server ordering/version metadata must protect future drag updates from stale overwrites.
- Treat this as the global shared-state rule for all future colors, images, elements, settings, and coordinates. The current Sites D1/R2 configuration exposes no supported shared broadcast binding, so retain reliable 250 ms synchronization until a supported true realtime channel becomes available.
- Profile onboarding saves name and image together in one server interaction, then returns the completed workspace payload.
- Predecode the selected onboarding image locally; after upload confirmation, show that ready local circle immediately and swap to the permanent versioned R2 URL only after it decodes.
- Before a new/changed member payload becomes visible, preload and decode its versioned profile-image URL; commit the payload only after decoding so image appearance and layout rearrangement happen in one frame.
- Use empty image alternative text and hide a failed image element so broken-image icons or member-name fallback text never appear in a profile circle.
- The root server-renders the authenticated workspace payload, orders/dims members from canonical extension activity, starts visible-image downloads immediately, reveals circles together after decode, and preloads inactive images in the background. Settings remain scrollable without a visible scrollbar.
- Settings cover profile editing, profile reset/deletion, sign-out, and member-visible request decisions. Host-only administration covers member removal and clearing test data; there is no admin-role management.
- Host-only test-data clearing is a complete fresh-start reset: it removes all non-host memberships, requests, presence and extension sessions, extension credentials/pairings, shared role options, notes, board state, activity logs, and stored profile images. It retains only the permanent host identity row with an empty profile so the host re-enters through profile setup.
- Dragging and saved coordinates come later.
- `docs/PRODUCT_SPEC.md` is the focused authoritative specification.

## Working Procedure For Future AI Sessions

1. Read root `AGENTS.md`, this handoff, the memory protocol, workflow/style rules, project brief, and `docs/PRODUCT_SPEC.md`.
2. Read focused docs relevant to the task and inspect real source files before editing.
3. Before delivery work, read `docs/DELIVERY_PROCESS.md` and require explicit owner authorization.
4. Check Git status and recent history; preserve user work.
5. If chat memory conflicts with repo files, trust repo files and ask if intent remains unclear.

## Suggested Near-Term Next Steps

- Continue polishing the Companion popup after the implemented shared notes, hidden-state five-second notification stack, and acting-status selector.
- Continue the HQ as the configuration, access, membership, and instance control center while keeping shared data and permissions server-authoritative.
- Continue local Companion development; after changes stabilize, prepare a new versioned Web Store archive and submit it as an update. Add the HQ install prompt only after the Store listing is approved and its installation URL is known.
- Validate each hosted-page change locally and follow the current owner authorization for delivery unless a request explicitly says not to commit or deploy.

## Durable Workflow Decisions

- The repo, not chat memory, is the source of truth.
- `memcheck` updates durable memory only.
- For Quadruzz, `gitcheck` performs `memcheck`, validation, identity verification, staging, commit, push, and deployment of that exact commit to the existing live Site unless the owner explicitly says not to deploy.
- Local build verification does not authorize deployment.
- For Sites delivery from this monorepo, stage the tracked `project/` source in an isolated temporary Git checkout rooted at the Site project, then use the normal Sites hosting flow. Do not recreate a persistent nested repository inside `project/`.
- Reloading an unpacked extension invalidates extension contexts already injected into open tabs. After reloading it in `chrome://extensions`, refresh each test tab before judging the popup. Do not introduce new cross-origin request headers or redesign the canonical presence-session path without verifying the popup member list and HQ vivid/dim state together in a real Chrome profile.

## Settled Door And Settings Flow (2026-09-09)

- Signed-in unapproved accounts submit display name, profile image, and access request together from the Cross-Quadruzz door. Pending profile data expires after 24 hours; rejection and expiry delete it. Approval creates the completed member profile directly, with no second onboarding step.
- The permanent host bypasses approval and uses the profile door only if incomplete.
- All approved members see and decide pending requests inline in the Members list. Only the host can remove an approved member; the host is protected.
- Settings has a You section with profile controls and sign-out, a horizontal separator, then a unified Members list. There is no popup header, role label, or close icon; gear toggling and outside click close it.

- Live access-state reads are cache-disabled, and every signed-in door state continues synchronizing so approval always transitions an open requesting tab directly to the board without manual refresh.

- Request submission switches immediately to the waiting presentation while upload completes; settings and board avatars remain hidden until fully loaded; sign-out clears all presence sessions for the account before leaving.
