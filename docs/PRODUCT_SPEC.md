# Cross-Quadruzz Product Specification

This document records settled product behavior and the current implementation boundary. The live Site and local source now contain the minimal Cross-Quadruzz workspace.

## Product And Hosting Identity

- **Cross-Quadruzz** is one specific hosted team workspace, not a multi-workspace product.
- Its preferred public hostname is `cross-quadruzz.l-busslerberto.chatgpt.site`, subject to availability when deployment is explicitly authorized.
- The source repository remains local. Preserve the existing Sites project ID in `project/.openai/hosting.json`.
- Do not deploy without explicit owner authorization.

## Quadruzz Companion

- **Quadruzz Companion** is now the primary daily browser surface. Cross is its initial instance; the architecture may later grow into one global multi-instance extension.
- The current unpacked build is in `project/extension/`. It injects a persistent floating top-right overlay into the focused ordinary tab. The toolbar action and Alt+Shift+W toggle it; switching tabs transfers the visible overlay to the focused tab, and hidden mode keeps the extension active for future notifications.
- Distribute it as an **unlisted Chrome Web Store item** after local testing and explicit authorization.
- Authorization begins through the authenticated Cross website and binds a revocable extension credential to the stable authenticated OpenAI user ID. Browser profile, device, IP address, display name, or possession of the files is not identity or authorization.
- Extension clients must use live backend data and the same server-enforced access rules as the hosted page. Never create a parallel client-authoritative permission model or treat locally cached state as authority.
- Local extension storage is limited to non-authoritative device preferences, such as presentation or convenience settings. Membership, roles, approval state, profiles, shared content, notification eligibility, and revocation state remain server-authoritative.
- Removing a member, revoking a pairing, or otherwise withdrawing access must invalidate extension access. A previously paired installation must not retain access merely because it still has local data or credentials.
- Preserve a clean backend/domain boundary so the hosted page and future Companion can share authorization, instance membership, and live data behavior without coupling product rules to either interface.
- Approved members can select an existing shared acting-status value or create one from the Companion. Acting-status spelling and capitalization are preserved exactly. Alt+Shift+D opens the selector directly; its keyboard model keeps the input ready for typing while Tab independently cycles the selected existing values and the create-input row, and Enter applies the selected row.
- Approved members can set or clear one server-authoritative note of up to two visual lines. Alt+Shift+S opens the note editor directly. A new or replaced note produces a five-second notification for other active Companion users while their full popup is hidden; notifications stack newest-first, clear when the full popup opens, exclude the author’s sessions, and never replay historical notes or removals.

## Access Flow And Privacy Boundary

1. The root route `/` is the Quadruzz workspace and renders every account-dependent state.
2. Signed-out visitors are redirected to `/authentication`, which presents only **Sign in with ChatGPT** and returns successful sign-in to `/`.
3. The former `/workspace` route redirects to `/` so old links remain safe while the visible product address stays clean.
4. A signed-in unregistered user sees a minimal **Cross** door and must provide a display name and profile image when submitting an access request.
5. Request submission changes the door to **Waiting for approval** immediately while the validated image upload completes; it never leaves a multi-second **Sending** label visible. Pending name/image data is stored for up to 24 hours. Approval converts it directly into the completed member profile with no second onboarding step; rejection or expiry deletes the request and staged profile data.
6. Anonymous and pending users cannot see board data, member data, profiles, presence, roles, or other workspace state. The permanent host bypasses approval and uses the same profile door only when its profile is incomplete.

Identity is the stable authenticated OpenAI user ID. Never identify a person by IP address, device, browser profile, or display name. Separate OpenAI accounts are separate Quadruzz identities.

## Roles And Authorization

The current Site owner account is the permanent initial Quadruzz **host**. Every other approved account is a **member**; there is no admin role.

| Capability | Host | Member |
|---|---:|---:|
| View the approved-member board | Yes | Yes |
| Edit own profile | Yes | Yes |
| Approve or reject access requests | Yes | Yes |
| Remove another member | Yes | No |
| Edit board settings | Yes | Yes |
| Clear test data | Yes | No |

The host cannot be removed and never needs approval. Members may manage requests. Only the host may remove members, and the host cannot be removed. No role label is sent for the member list or shown in settings. Removal uses a compact × action beside eligible members.
## Members, Profiles, And Presence

- Every registered member remains visible in fixed first-join order.
- Offline members remain visible but are dimmed.
- Dragging and saved coordinates are later features.
- Every approved member can edit their own display name and optionally replace their profile image from settings.
- Removing a member revokes their access, clears their profile image and profile fields, and requires that same OpenAI account to request and receive approval again before re-entering.
- The host account cannot be removed.
- Settings also support profile reset/deletion and sign-out.
- Canonical activity is tied to an authorized Companion running in the browser, not to an open/focused HQ page and not to overlay visibility.
- Approved Companion-active members are vivid and sorted first in join order. All other approved members remain listed afterward and dimmed.
- Successful authenticated Companion member-list reads count as activity and renew a D1 extension session when needed. This read-as-proof rule is required because Chrome can suspend Manifest V3 service workers and suppress separate background heartbeat POSTs. Popup/background heartbeat POSTs remain redundant fallbacks.
- Extension activity expires after 90 seconds without authenticated Companion traffic.
- While a relevant page is open, synchronize access requests, approvals, membership/profile changes, presence displays, and later board mutations about four times per second without overlapping requests.
- Every signed-in door state must keep synchronizing while the page remains open, including a temporary `not_requested` response. Workspace reads and responses must disable HTTP caching so stale door payloads cannot suppress an approval transition; an approved account must enter the board automatically without refreshing. The acting browser applies successful mutation responses immediately; other browsers converge on the next synchronization check.
- This low-latency rule applies globally to every shared mutation: requests, approval transitions, presence, profiles, roles, settings, colors, images, elements, and later dragging/coordinates. Use immediate mutation responses for the actor and the shared 250 ms synchronization path for everyone else. Keep server-authoritative timestamps/versions and non-overlapping requests so stale responses cannot overwrite newer state.
- The current Sites D1/R2 project configuration has no supported shared broadcast binding. Do not introduce a fragile pseudo-push transport; adopt a true server broadcast channel later only if Sites exposes an appropriate supported shared realtime capability for this project.
- Future draggable-item updates must use server-authoritative ordering/version metadata so late responses cannot overwrite newer positions.
- A newly visible or changed profile image must be downloaded and decoded before its member payload is committed to the visible board. Layout rearrangement and the fully rendered circle should appear together; never expose progressive top-to-bottom image painting or an empty reserved circle.
- Profile images use empty alternative text and hide themselves on load failure, so a browser never substitutes a member name or broken-image icon inside a circle. A failed circle stays out until a valid version is ready.
- Every profile image, including images inside the settings member list, remains invisible until its complete image load fires; progressive top-to-bottom painting is never shown.
- Render the authenticated workspace payload in the original server response rather than sending an empty client shell followed by a second data request. Use canonical extension activity for ordering/dimming. Begin visible profile-image downloads from server-rendered HTML, reveal them together after decode, and preload inactive member images in the background.
- Decode the selected door profile image locally before submission when possible. After the server confirms the upload, use that ready local image for the entering member immediately while the versioned R2 image decodes in the background; switch only after the permanent server image is ready.
- Profile-image URLs must carry a server-derived version so a changed image cannot be masked by a stale browser cache.
- Profile reset/deletion must preserve the stable-ID, permanent-host, and authorization invariants.

## Initial Interface

- Use a minimal interface with a pale muted dark-blue background and a fixed settings button.
- The settings popup may scroll when needed but must not show a scrollbar track or thumb. It has no top title or close icon: the gear toggles it and clicking outside closes it. It shows a **You** profile section, sign-out, a horizontal divider, and one **Members** list.
- Pending requests appear inline in the member list as an email with green approve and red reject icons for every approved member. Approved profiles show image and name; only the host sees a compact removal × for removable members. No role labels are shown.
- Never expose board or member information on public, sign-in, access-request, or pending screens.

## Sites Storage

- Use Sites D1 for members, roles, access requests, profiles, presence, board state, and later coordinates.
- Use Sites R2 for profile images.
- The retained hosting manifest uses the existing Sites D1 `DB` binding and R2 `FILES` binding.
- Enforce authorization and privacy in server-side data access; client-side hiding is insufficient.

## Current Implementation And Repository Status

- Cross-Quadruzz authentication, access requests, membership/profile storage, activity log, minimal board, settings workflow, clean routing, and the local Companion overlay are implemented. The Site and Companion share D1/R2 data and server authorization. Companion activity is the canonical member activity state.
- The live Site uses the minimal pale muted dark-blue board and direct authenticated entry; the former test screen and redundant Continue entrance are gone.
- Git is initialized on `main` with clone-local identity `Lo <lorenzo.berto@eduzz.com>` and the identity guard enabled.
- Dependencies are installed; the setup verifier and production build passed.
- An ignored scaffold at `tmp/sites-reference/` exists only to inspect official Sites authentication, D1, and R2 patterns. It is reference material, not product source, and must not be committed.
