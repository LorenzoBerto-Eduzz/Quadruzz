# Portable Helper Scripts

Use this guide when a real project needs repeatable development helpers, local command shortcuts, validation launchers, or one-time tooling setup.

## Core Model

Separate shared behavior from device configuration:

```text
Tracked in scripts/                 Local to each device
-------------------------------     --------------------------------
Reusable command behavior           Tool installation paths
Project-relative path discovery     Shell profile registration
Portable launcher generation        User command-path installation
Input validation and clear errors   Credentials and private settings
Optional setup/install helper       Other machine-specific values
```

The repository should contain everything another device needs to reproduce the helper, except facts that are inherently local or private.

## Rules For Repository Helpers

- Put small, purposeful, repeatable automation in `scripts/`.
- Resolve project files relative to the script or repository, not the current machine's absolute project path.
- Accept machine-specific tool paths as parameters or discover them safely. Do not commit one developer's absolute executable path as the only supported path.
- Never embed credentials, tokens, private data, or other secrets.
- Fail with a clear message that explains the missing prerequisite and the setup command needed to fix it.
- Keep helper names and responsibilities explicit. Do not create speculative scripts merely because a folder exists.
- Keep delivery/export/publish helpers governed by `docs/DELIVERY_PROCESS.md` and explicit owner authorization.

## Local Command Registration

A short command typed in a terminal may require local shell registration even when its implementation lives in Git.

Prefer a small launcher installed into an existing user command directory on `PATH` when the supported platform permits it. This works in ordinary shells and in restricted/isolated terminals that may refuse to load a PowerShell or shell profile. Profile functions and aliases may still be installed as optional convenience, but they should not be the only way to invoke an important project command.

When a project needs that convenience:

1. Keep the real behavior in a tracked repository script.
2. Provide a tracked, clearly named installer such as `Install-DevCommands.ps1` when registration cannot happen automatically.
3. Make the installer safe to run repeatedly. It should replace only launchers it owns and update only its own marked profile block without deleting unrelated content.
4. Store the resolved tool path or other non-secret machine setting locally, not in shared project files.
5. Document the one-time command each new clone/device must run and how to override automatic tool discovery.
6. Keep the underlying repository script directly runnable so the workflow does not depend solely on a short alias.
7. Verify command discovery with shell profiles disabled when profile-independent behavior is intended.

Do not weaken machine-wide script-execution or security policy merely to support a shortcut. If a local policy change is genuinely needed, explain its scope and risk and obtain explicit owner approval. Prefer a profile-independent launcher when it satisfies the requirement safely.

Portable means reproducible on each supported device. It does not mean one shell script must automatically support every operating system or shell. State which environments are supported, and add another thin installer only when the project truly uses another environment.

## Documentation Checklist

When adding or changing helpers, record:

- the canonical helper/setup command in `docs/PROJECT_BRIEF.md`;
- prerequisites and supported shells/platforms;
- which files synchronize through Git and which setup is local per device;
- any generated or local configuration that must remain ignored;
- a minimal verification that proves the helper resolves and invokes the intended project/tool, including a no-profile check when promised.
