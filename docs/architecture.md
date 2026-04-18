# Architecture

The bridge is a paired SillyTavern server plugin and UI extension.

The bridge owns:

- Discord bot lifecycle and slash commands
- Discord thread to SillyTavern chat-file mapping
- bridge-owned chat persistence and swipe state
- per-Discord-user persona text
- headless assembly of the saved Chat Completion preset prompt chain

SillyTavern owns:

- Chat Completion settings
- Claude reverse-proxy URL and proxy password
- Claude Sonnet 4.6 backend request shaping
- stop strings, assistant prefill handling, reasoning, verbosity, and provider-specific fields

Generation flow:

1. The bridge loads `data/<userHandle>/OpenAI Settings/<presetName>.json`.
2. The bridge assembles the core Prompt Manager chain from saved preset prompts, character card fields, chat history, and Discord persona.
3. The bridge posts the completed messages to `/api/backends/chat-completions/generate`.
4. SillyTavern performs the provider-specific Claude request.

No SillyTavern browser tab is required for this headless flow.
