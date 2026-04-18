# SillyTavern Discord Bridge

SillyTavern server plugin and UI extension for running a private two-user Discord forum RP bridge.

The bridge loads a pinned SillyTavern Chat Completion preset headlessly, sends generation through SillyTavern's Chat Completion backend path, and saves Discord conversations as SillyTavern-compatible chats.

See:

- `docs/plans/2026-04-17-discord-bridge-implementation.md`
- `docs/install-local.md`
- `docs/discord-app-setup.md`
- `docs/operation.md`
- `SECURITY.md`

The SillyTavern Git extension installer can install only the browser UI extension. Use the `st-ui-extension` branch for that installer, then install the server plugin locally from this repository as described in `docs/install-local.md`.

Headless deployments do not need a SillyTavern browser tab open. The configured preset must exist at `data/<userHandle>/OpenAI Settings/<presetName>.json`, where `presetName` is entered without the `.json` suffix.
