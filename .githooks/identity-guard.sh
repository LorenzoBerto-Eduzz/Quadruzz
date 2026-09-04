#!/bin/sh
set -eu

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"

if [ -z "$repo_root" ]; then
  echo "Git identity guard blocked this action: repository root could not be found." >&2
  exit 1
fi

identity_file="$repo_root/.git-identity"

if [ ! -f "$identity_file" ]; then
  echo "Git identity guard blocked this action: missing .git-identity." >&2
  echo "Copy .git-identity.example to .git-identity, then set GIT_ALLOWED_EMAIL." >&2
  exit 1
fi

# shellcheck disable=SC1090
. "$identity_file"

if [ "${GIT_ALLOWED_EMAIL:-}" = "" ] ||
   [ "$GIT_ALLOWED_EMAIL" = "your@email.com" ] ||
   [ "$GIT_ALLOWED_EMAIL" = "{{GIT_ALLOWED_GIT_EMAIL}}" ]; then
  echo "Git identity guard blocked this action: configure .git-identity first." >&2
  exit 1
fi

current_email="$(git config user.email || true)"

if [ "$current_email" != "$GIT_ALLOWED_EMAIL" ]; then
  echo "Git identity guard blocked this action." >&2
  echo "Allowed email: $GIT_ALLOWED_EMAIL" >&2
  echo "Current email: ${current_email:-<empty>}" >&2
  echo "Fix with: git config user.email \"$GIT_ALLOWED_EMAIL\"" >&2
  echo "Also ensure: git config core.hooksPath .githooks" >&2
  exit 1
fi
