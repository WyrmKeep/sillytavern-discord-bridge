# SillyTavern Prompt Manager Parity Plan

## Status

Planned. Not implemented in the current bridge runtime.

The bridge now fixes unsafe Claude request fields and supports Discord persona / `{{user}}` macro handling in its bridge-owned prompt builder. It still does not claim full SillyTavern Prompt Manager parity.

## Problem

The current bridge prompt path builds a ChatML-style prompt from character-card fields, bridge config, chat history, and Discord profiles. This intentionally scoped v1 path does not include SillyTavern's full browser-side prompt assembly.

Missing parity includes:

- active Chat Completion preset ordering
- Main Prompt / NSFW Prompt
- jailbreak prompts
- instruct-mode formatting
- Prompt Manager custom ordering
- Author's Note / memory / extension-injected prompts
- SillyTavern macro expansion beyond the bridge-supported `{{char}}` and `{{user}}`

## Preferred Direction

Use SillyTavern's own prompt assembly path rather than reimplementing Prompt Manager logic inside the bridge.

The bridge should add a Task 0 contract capture before implementation:

- identify the current server-side endpoint or importable helper that can assemble a prompt for a selected character/chat/user
- verify whether that path can run from a server plugin without a browser session
- verify how to provide a bridge-owned chat history and active character while reusing the configured preset
- confirm how user persona, Author's Note, memory, and extension prompts are resolved for the configured ST user handle
- add contract tests pinned to the supported SillyTavern release

## Fallback Direction

If SillyTavern does not expose an importable/route-safe prompt assembly path, implement preset reading as a separate milestone:

- load the active Chat Completion preset from `{DATA_ROOT}/{handle}/OpenAI Settings/`
- load relevant user settings from `{DATA_ROOT}/{handle}/settings.json`
- reproduce prompt ordering and macro expansion for the supported Claude Chat Completion path only
- explicitly document unsupported Prompt Manager features that cannot be reproduced server-side

## Acceptance Criteria

- A bridge-generated request includes the same core prompt blocks as a SillyTavern browser generation for the same character, preset, user persona, and chat history.
- Contract tests compare bridge prompt assembly against pinned SillyTavern behavior.
- The bridge does not silently fall back to simplified prompt assembly when parity mode is enabled.
- Logs and failed diagnostics do not expose private prompt text by default.

## Non-Goals

- Public deployment support.
- Multi-character/group chat parity.
- Supporting every SillyTavern extension prompt injection in the first parity milestone.
