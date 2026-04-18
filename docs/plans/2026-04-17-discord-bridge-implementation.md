# SillyTavern Discord Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private, stable-looking SillyTavern extension that runs a Discord bot, creates Discord forum-thread RP conversations, uses SillyTavern character cards and configured Claude reverse-proxy settings, and saves every conversation back into SillyTavern JSONL chat storage.

**Architecture:** Ship a paired SillyTavern server plugin and UI extension in one GitHub repo. The server plugin starts the Discord bot, reads SillyTavern user settings and character/chat files, builds Discord-specific prompts, calls the same configured Chat Completion Claude reverse proxy that SillyTavern uses, and persists all messages as normal ST chats. The UI extension provides an ST-native settings panel for bot setup, allowlisting, profiles, diagnostics, and command registration.

**Tech Stack:** Node.js 20+, TypeScript, ESM, discord.js v14, Express router mounted by SillyTavern, Zod, Vitest, Vite, ESLint, Prettier, GitHub Actions.

---

## 1. Key Architecture Decision: Reuse SillyTavern Claude Settings

The bridge should not maintain a separate primary model endpoint config in v1. It should reuse the selected SillyTavern Chat Completion settings for the configured ST user:

- `main_api` should be `openai` or otherwise report that ST is not currently configured for Chat Completion use.
- `settings.oai_settings.chat_completion_source` should be `claude`.
- `settings.oai_settings.reverse_proxy` should be the reverse proxy URL, for example `http://example.invalid/v1/claude-proxy`.
- `settings.oai_settings.claude_model` should be `claude-sonnet-4-6`.
- `settings.oai_settings.proxy_password` should be reused only if present, but must be redacted in UI/logs.
- Generation settings such as `temp_openai`, `top_p_openai`, `top_k_openai`, `openai_max_tokens`, `stream_openai`, `reasoning_effort`, `verbosity`, `assistant_prefill`, `use_sysprompt`, and stop strings should be read from ST settings where applicable.

Important distinction:

- Reuse ST's **connection/model settings**.
- Do not try to reuse the whole ST browser generation pipeline in v1, because Discord messages arrive in the server process without an active browser chat session, DOM state, prompt manager state, selected character state, or `request.user` from a normal ST generation request.
- The bridge therefore owns Discord prompt assembly and JSONL persistence, while matching the Claude reverse-proxy request semantics SillyTavern uses.

Ownership boundary:

- The bridge owns Discord bot lifecycle, Discord thread/session mapping, character selection, bridge-owned intermediate history, bridge-owned chat writes, and swipe/regenerate UX.
- SillyTavern remains the source of truth for Claude source selection, reverse proxy base URL, proxy password, model selection, supported generation knobs, and Claude-compatible request shaping for `claude-sonnet-4-6`.
- v1 does **not** attempt full SillyTavern Prompt Manager parity with the browser UI.
- v1 does require ST-compatible Claude request shaping for the supported reverse-proxy configuration.

For Claude reverse proxy mode, SillyTavern's backend sends Anthropic Messages-style requests to:

```text
{reverse_proxy}/messages
```

So with a configured reverse proxy:

```text
reverse_proxy = http://example.invalid/v1/claude-proxy
effective URL = http://example.invalid/v1/claude-proxy/messages
model = claude-sonnet-4-6
```

Implementation note:

- A reverse proxy may legitimately return `404` on its base path or on `/models`.
- The implementation smoke test must use an explicit low-token `POST /messages` request, not a GET health check.
- Do not commit real private proxy URLs or live probe results to this repository.

Explicit v1 non-goals:

- Group chats and multi-character chats.
- Simultaneous editing of the same active bridge chat in SillyTavern and Discord.
- Discord DMs.
- Attachments and image understanding.
- Streaming Discord replies.
- Public internet deployment.
- Alternate greeting selection.
- Full SillyTavern browser Prompt Manager parity.

## 2. Source Documentation

Keep these links in `docs/architecture.md` and cite them in `README.md` where relevant:

- SillyTavern server plugins: https://docs.sillytavern.app/for-contributors/server-plugins/
- SillyTavern UI extensions: https://docs.sillytavern.app/for-contributors/writing-extensions/
- SillyTavern config, including `enableServerPlugins`: https://docs.sillytavern.app/administration/config-yaml/
- SillyTavern upstream repository: https://github.com/SillyTavern/SillyTavern
- Discord interactions and commands: https://docs.discord.com/developers/platform/interactions
- Discord application commands: https://docs.discord.com/developers/interactions/application-commands
- Discord Gateway intents and Message Content intent: https://docs.discord.com/developers/events/gateway
- Discord threads/forum behavior: https://docs.discord.com/developers/topics/threads
- Discord channel API: https://docs.discord.com/developers/resources/channel
- Discord guild API: https://docs.discord.com/developers/resources/guild
- discord.js v14 guide: https://discordjs.guide/
- Anthropic Messages API shape for Claude-compatible proxies: https://docs.anthropic.com/en/api/messages
- GitHub protected branches/reviews: https://docs.github.com/articles/about-required-reviews-for-pull-requests
- GitHub Actions secrets: https://docs.github.com/en/actions/how-tos/administering-github-actions/sharing-workflows-secrets-and-runners-with-your-organization

## 3. Private GitHub Repo Guidelines

Repository name:

```text
sillytavern-discord-bridge
```

Repository settings:

- Visibility: public is acceptable only after confirming the repository contains no real secrets, private proxy URLs, real character cards, or chat logs. Runtime deployment remains private/local.
- Default branch: `main`.
- License: `AGPL-3.0-only`, because this runs inside and imports internals from AGPL SillyTavern.
- Enable Dependabot alerts and npm ecosystem updates.
- Enable secret scanning and push protection if available for the account.
- Protect `main`:
  - Require a pull request before merging.
  - Require status checks to pass.
  - Require one approval.
  - Dismiss stale approvals on new commits.
  - Block force pushes.
  - Block deletion.
- Do not store real Discord tokens, ST settings, character cards, chat logs, API keys, or private proxy URLs in committed fixtures.
- Use synthetic fixtures only.

Branch and commit conventions:

- Branches: `feature/<short-name>`, `fix/<short-name>`, `docs/<short-name>`.
- Commits: Conventional Commits, for example `feat: add discord conversation state`.
- PRs must include:
  - Summary.
  - Test output.
  - Manual smoke-test status.
  - Security notes.
  - Whether any fixture contains copied user data.

Additional repository governance rules:

- This repository may be public only if it remains sanitized. The deployment, Discord app, ST settings, chat logs, and runtime data must remain private.
- No secrets may ever be committed. This includes Discord bot tokens, real Discord client/application IDs, real guild IDs, real allowed-user IDs, reverse proxy credentials, SillyTavern settings exports, real character cards, real chat logs, and private proxy URLs.
- Runtime secrets and machine-local settings must be provided only through local config or environment variables. At minimum, local setup must support:
  - `DISCORD_BOT_TOKEN`
  - `DISCORD_CLIENT_ID`
  - `DISCORD_GUILD_ID`
  - `DISCORD_ALLOWED_USER_IDS`
  - `SILLYTAVERN_BASE_URL`, only if needed by local scripts/tools
  - `DISCORD_BRIDGE_PLUGIN_AUTH_TOKEN`, optional for non-UI admin routes/scripts
- `.env.example` must contain fake placeholder values only.
- `.gitignore` must exclude at minimum:
  - `.env`
  - `.env.*`
  - `node_modules/`
  - build output
  - coverage output
  - logs
  - packaged artifacts
  - local state
  - debug transcript dumps
  - generated runtime/chat data under the bridge data directory
- The project uses npm. `package-lock.json` must be committed and kept in sync with `package.json`.
- `main` must remain protected.
- All implementation work must happen on feature branches.
- A pull request is required before merge, even for a two-person private project.
- CI must pass before merge: install, lint, typecheck, unit tests, and integration tests where practical.
- At least one review is required before merging any non-trivial change.
- Commit messages must follow Conventional Commits.
- A PR template is required. Issue templates are recommended.
- Generated artifacts must stay out of code review unless intentionally committed for a documented reason.
- The repository must document local development setup, release/versioning strategy, SillyTavern chat backup/restore, dependency updates, secret rotation, threat model, and unsupported scope.
- The bridge and the SillyTavern server must not be exposed to the public internet without explicit authentication and a conscious deployment decision.
- By default, logs must not contain prompts, completions, token values, proxy passwords, Discord tokens, or private chat content.
- Optional debug logging that can include conversation content must be off by default, clearly labeled, gitignored, and easy to delete.
- Test fixtures must remain synthetic. Do not copy real chats, real cards, or real settings into the repository.

## 4. Repository Layout

Create this structure:

```text
.
├─ AGENTS.md
├─ README.md
├─ SECURITY.md
├─ LICENSE
├─ package.json
├─ package-lock.json
├─ tsconfig.json
├─ tsconfig.server.json
├─ tsconfig.ui.json
├─ vite.config.ts
├─ eslint.config.js
├─ .prettierrc.json
├─ .env.example
├─ .gitignore
├─ .github/
│  ├─ workflows/ci.yml
│  ├─ dependabot.yml
│  ├─ pull_request_template.md
│  └─ CODEOWNERS
├─ docs/
│  ├─ architecture.md
│  ├─ discord-app-setup.md
│  ├─ install-local.md
│  ├─ operation.md
│  ├─ testing.md
│  ├─ troubleshooting.md
│  └─ plans/
│     └─ 2026-04-17-discord-bridge-implementation.md
├─ scripts/
│  ├─ install-local.mjs
│  ├─ register-discord-commands.mjs
│  ├─ smoke-claude-proxy.mjs
│  └─ pack-extension.mjs
├─ src/
│  ├─ server-plugin/
│  │  ├─ index.ts
│  │  ├─ config/
│  │  │  ├─ paths.ts
│  │  │  ├─ schema.ts
│  │  │  ├─ store.ts
│  │  │  └─ redact.ts
│  │  ├─ discord/
│  │  │  ├─ client.ts
│  │  │  ├─ commands.ts
│  │  │  ├─ interactions.ts
│  │  │  ├─ message-handler.ts
│  │  │  ├─ forum.ts
│  │  │  ├─ components.ts
│  │  │  └─ permissions.ts
│  │  ├─ generation/
│  │  │  ├─ claude-reverse-proxy.ts
│  │  │  ├─ prompt-builder.ts
│  │  │  ├─ token-budget.ts
│  │  │  └─ types.ts
│  │  ├─ sillytavern/
│  │  │  ├─ imports.ts
│  │  │  ├─ users.ts
│  │  │  ├─ characters.ts
│  │  │  ├─ chats.ts
│  │  │  ├─ settings.ts
│  │  │  └─ versions.ts
│  │  ├─ state/
│  │  │  ├─ schema.ts
│  │  │  ├─ store.ts
│  │  │  └─ locks.ts
│  │  ├─ routes/
│  │  │  ├─ status.ts
│  │  │  ├─ config.ts
│  │  │  ├─ discord.ts
│  │  │  ├─ characters.ts
│  │  │  ├─ diagnostics.ts
│  │  │  └─ index.ts
│  │  ├─ logging.ts
│  │  └─ errors.ts
│  └─ ui-extension/
│     ├─ manifest.json
│     ├─ index.ts
│     ├─ settings-panel.ts
│     ├─ api.ts
│     ├─ styles.css
│     └─ templates/
│        └─ settings.html
└─ tests/
   ├─ fixtures/
   │  ├─ characters/
   │  │  ├─ character-v2.json
   │  │  ├─ character-v1.json
   │  │  └─ character-v3.png
   │  ├─ settings/
   │  │  ├─ st-claude-reverse-proxy.json
   │  │  ├─ st-not-claude.json
   │  │  └─ st-legacy-openai-root.json
   │  └─ chats/
   │     └─ simple-chat.jsonl
   ├─ unit/
   ├─ integration/
   ├─ contract/
   └─ smoke/
```

## 5. Runtime Config And State

Use data-root storage, not repo files:

```text
{DATA_ROOT}/_discord-bridge/config.json
{DATA_ROOT}/_discord-bridge/secrets.json
{DATA_ROOT}/_discord-bridge/state.json
```

`config.json` schema:

```ts
type DiscordBridgeConfig = {
  version: 1;
  enabled: boolean;
  sillyTavernUserHandle: string;
  discord: {
    clientId: string;
    guildId: string;
    forumChannelId: string;
    createForumIfMissing: boolean;
    forumName: string;
    defaultForumTagIds: string[];
  };
  access: {
    allowlistedUserIds: string[];
    adminUserIds: string[];
  };
  profiles: Record<string, {
    enabled: boolean;
    promptName: string;
    displayName: string;
    persona: string;
  }>;
  defaults: {
    defaultCharacterAvatarFile: string;
    maxHistoryMessages: number;
    maxReplyCharacters: number;
    includeCreatorNotes: boolean;
    includePostHistoryInstructions: boolean;
  };
  behavior: {
    ignoreBotMessages: boolean;
    rejectNonAllowlistedUsers: "silent" | "ephemeral-reply-for-commands";
    attachmentMode: "ignore-with-note";
    conversationTitleFormat: "{{character}} - {{date}}";
  };
};
```

`secrets.json` schema:

```ts
type DiscordBridgeSecrets = {
  discordBotToken?: string;
};
```

Do not duplicate Claude proxy URL/model/API password here in v1. Those come from ST settings.

`state.json` schema:

```ts
type DiscordBridgeState = {
  version: 1;
  conversations: Record<string, {
    guildId: string;
    forumChannelId: string;
    threadId: string;
    starterMessageId: string;
    characterAvatarFile: string;
    chatFolderName: string;
    characterName: string;
    chatFileName: string;
    createdAt: string;
    updatedAt: string;
    createdByDiscordUserId: string;
    lastAssistantDiscordMessageId?: string;
    lastAssistantBridgeMessageId?: string;
  }>;
};
```

`chatFileName` must use a collision-resistant bridge-owned filename and includes the `.jsonl` suffix:

```text
<UTC timestamp compact>--<discordThreadId>.jsonl
```

Do not derive chat filenames from thread title, character display name, or date-only strings.

## 6. SillyTavern Settings Adapter

Implement `src/server-plugin/sillytavern/settings.ts`.

Responsibilities:

- Read `{DATA_ROOT}/{handle}/settings.json`.
- Parse `settings.oai_settings` first.
- Fall back to legacy root-level OpenAI settings if `settings.oai_settings` is absent.
- Return a normalized generation settings object:

```ts
type SillyTavernClaudeSettings = {
  mainApi: string | undefined;
  chatCompletionSource: "claude";
  reverseProxy: string;
  proxyPassword?: string;
  model: "claude-sonnet-4-6";
  maxTokens: number;
  temperature: number;
  topP: number;
  topK: number | undefined;
  assistantPrefill: string | undefined;
  stopSequences: string[];
  stream: false;
  originalStreamOpenAI: boolean;
  useSystemPrompt: boolean;
  reasoningEffort: "auto" | "low" | "medium" | "high" | "min" | "max";
  verbosity: "auto" | "low" | "medium" | "high";
};
```

Validation rules:

- `chat_completion_source` must be `claude`.
- `main_api` must be `openai`; otherwise report that ST is not currently configured for Chat Completion use.
- `reverse_proxy` must be a valid absolute HTTP(S) URL.
- `claude_model` must be `claude-sonnet-4-6`.
- `proxy_password` is optional and may be empty.
- `stream_openai` is read for diagnostics, but v1 intentionally overrides transport to `stream: false` because Discord replies are edited after a complete model response.
- `openai_max_tokens` defaults to `300` only if missing.
- `temp_openai` defaults to `1`.
- `top_p_openai` defaults to `1`.
- `top_k_openai <= 0` becomes `undefined`.
- `assistant_prefill`, `use_sysprompt`, `reasoning_effort`, `verbosity`, and stop strings must be represented explicitly, even if a specific value is not sent for a request.

UI behavior:

- Show a read-only "SillyTavern Claude Settings" diagnostic:
  - Source.
  - Model.
  - Reverse proxy host/path with credentials redacted.
  - Max tokens.
  - Temperature.
  - Whether settings are valid.
- Provide no separate model endpoint editor in v1.

## 7. Claude Reverse Proxy Client

Implement `src/server-plugin/generation/claude-reverse-proxy.ts`.

Request URL:

```ts
const url = joinUrl(settings.reverseProxy, "messages");
```

Request body:

The bridge should build a bridge-owned intermediate ChatML-style message list, then apply ST-compatible Claude conversion and request shaping. Do not treat `POST {reverse_proxy}/messages` alone as parity.

Minimum supported body fields:

```ts
type ClaudeProxyRequestBody = {
  model: "claude-sonnet-4-6";
  max_tokens: number;
  messages: Array<{ role: "user" | "assistant"; content: string | Array<unknown> }>;
  system?: Array<{ type: "text"; text: string }>;
  stop_sequences?: string[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stream: false;
  thinking?: unknown;
  output_config?: { effort?: string };
};
```

Request shaping rules:

- Append `/messages` to the configured reverse proxy base URL.
- Convert bridge messages through an ST-compatible equivalent of `convertClaudeMessages`.
- Include `system` only when `use_sysprompt` is enabled.
- Support `assistant_prefill`, except where current ST Claude 4.6 behavior rewrites or suppresses the assistant prefill shape for `claude-sonnet-4-6`.
- Handle Sonnet 4.6 no-prefill and assistant-tail behavior according to the pinned ST release contract tests.
- Forward stop strings as `stop_sequences`.
- Forward `top_k` when allowed by the active Claude 4.6 thinking/adaptive mode.
- Apply current Claude 4.6 limited-sampling behavior: when `top_p < 1`, omit `temperature`; otherwise omit `top_p`.
- Normalize `reasoning_effort` and `verbosity` for diagnostics, but do not send them to native Anthropic `/messages` unless a pinned ST contract proves a supported mapping.
- Add `anthropic-beta` only when the active settings require it.
- v1 does not support tools, web search, JSON schema forced tools, or streaming.

Headers:

- `Content-Type: application/json`
- `anthropic-version: 2023-06-01`
- `x-api-key: proxyPassword` only if ST settings contain `proxy_password`
- `anthropic-beta` only when required by prompt caching, thinking/adaptive output, verbosity, or other supported ST-compatible options.

Response parsing:

- Prefer `response.content[0].text`.
- If the proxy wraps OpenAI-style output despite Claude mode, fallback to `choices[0].message.content`.
- Throw a typed `GenerationError` containing HTTP status and a redacted body preview when no text is found.

Smoke test:

```bash
DISCORD_BRIDGE_SMOKE=1 npm run smoke:claude-proxy
```

The script reads ST settings for the configured user and sends:

```json
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 8,
  "temperature": 0,
  "stream": false,
  "messages": [{ "role": "user", "content": "Reply with exactly: ok" }]
}
```

`use_sysprompt` is an internal bridge/ST setting that determines whether the `system` field is emitted; it is not a top-level Anthropic Messages request field.

Expected result: HTTP 200 and output containing `ok`.

## 8. SillyTavern Character And Chat Storage

Implement `src/server-plugin/sillytavern/characters.ts`.

Responsibilities:

- Use `getUserDirectories(handle).characters`.
- Read `.png` character cards through ST's `character-card-parser.js` if importable.
- Support current V3 (`ccv3`) card metadata when present and prefer it over older embedded metadata.
- Also support JSON fixtures in tests.
- Normalize to:

```ts
type BridgeCharacter = {
  characterAvatarFile: string;
  chatFolderName: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMes: string;
  alternateGreetings: string[];
  mesExample: string;
  creatorNotes: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  tags: string[];
};
```

Implement `src/server-plugin/sillytavern/chats.ts`.

Storage path:

```text
{DATA_ROOT}/{handle}/chats/{chatFolderName}/{chatFileName}
```

Chat folder identity:

- `characterAvatarFile` is the actual SillyTavern card filename, for example `Alice.png`.
- `chatFolderName = path.parse(characterAvatarFile).name`, for example `Alice`.
- Do not derive the chat folder from display name, sanitized name, or a bridge-defined internal name.
- This rule is required for bridge-created chats to appear under the selected character in SillyTavern.

Chat header:

```json
{
  "chat_metadata": {
    "main_chat": null,
    "discord_bridge": {
      "version": 1,
      "guild_id": "...",
      "forum_channel_id": "...",
      "thread_id": "...",
      "character_avatar_file": "...",
      "chat_folder_name": "...",
      "created_by": "...",
      "created_at": "..."
    }
  },
  "user_name": "unused",
  "character_name": "unused"
}
```

User message shape:

```json
{
  "name": "Profile Name",
  "is_user": true,
  "send_date": "2026-04-17T18:00:00.000Z",
  "mes": "Discord message content",
  "extra": {
    "discord_bridge": {
      "discord_user_id": "...",
      "discord_message_id": "...",
      "discord_thread_id": "..."
    }
  }
}
```

Assistant message shape:

```json
{
  "name": "Character Name",
  "is_user": false,
  "send_date": "2026-04-17T18:00:05.000Z",
  "mes": "Selected reply text",
  "swipes": ["Selected reply text"],
  "swipe_id": 0,
  "swipe_info": [{
    "send_date": "2026-04-17T18:00:05.000Z",
    "extra": {
      "api": "claude-reverse-proxy",
      "model": "claude-sonnet-4-6",
      "discord_bridge": {
        "bridge_message_id": "asst_...",
        "discord_message_id": "..."
      }
    }
  }],
  "extra": {
    "api": "claude-reverse-proxy",
    "model": "claude-sonnet-4-6",
    "discord_bridge": {
      "bridge_message_id": "asst_...",
      "discord_thread_id": "..."
    }
  }
}
```

Save strategy:

- Preferred path: import and reuse SillyTavern's exported `getChatData(...)` and `trySaveChat(...)` helpers when available.
- Fallback path, only if helper imports are unavailable:
  - Read current JSONL.
  - Parse every line.
  - Modify in memory.
  - Write to a temp file in the same directory.
  - Rename temp file into place.

Concurrency policy:

- Serialize bridge writes per chat file, not just per Discord thread.
- All chat mutations that read-modify-write a chat file (`message create`, `regenerate`, `swipe previous`, `swipe next`, and recovery helpers) must use the same per-chat-file queue keyed by normalized chat file path.
- Store bridge ownership metadata in `chat_metadata.discord_bridge`.
- v1 does not support simultaneous editing of the same active bridge chat in SillyTavern and Discord.
- If the on-disk chat changed since load and the bridge cannot safely merge, fail clearly instead of silently overwriting.

## 9. Prompt Builder

Implement `src/server-plugin/generation/prompt-builder.ts`.

The prompt builder produces a bridge-owned intermediate ChatML-style message list. It must not build the final Anthropic body directly.

System content order:

1. Bridge instruction: this is a Discord RP bridge; respond only as the selected character.
2. Character card fields:
   - `name`
   - `description`
   - `personality`
   - `scenario`
   - `system_prompt`
   - `post_history_instructions`, only when `includePostHistoryInstructions` is enabled
   - `mes_example`
   - `creator_notes`, only when `includeCreatorNotes` is enabled
3. Discord profile mappings:
   - Each allowed participant's prompt name.
   - Each enabled participant's persona snippet.
4. Formatting instruction:
   - No Discord markdown requirement beyond normal text.
   - Do not prepend the character name unless the character naturally would.
   - Treat `maxReplyCharacters` as a soft prompt hint, not silent truncation.

Message content:

- Include the chat history after the header.
- For user messages, content should be:

```text
{promptName}: {message}
```

- For assistant messages, use selected swipe:

```text
{selectedSwipeText}
```

Token/history policy:

- v1 uses message-count trimming, not tokenizer-perfect trimming.
- Default `maxHistoryMessages` is `80`.
- Always include the most recent user message.
- Keep character card/system material intact.

First-message and length policy:

- Use `firstMes` for the Discord forum starter post when present.
- If `firstMes` is empty, use a short synthetic starter that names the character and states that the conversation has begun.
- If a starter or assistant reply exceeds Discord message limits, split it into ordered Discord messages while preserving one ST assistant message in JSONL.
- Thread titles generated from `conversationTitleFormat` must be normalized and truncated to Discord's forum thread name limit.
- Alternate greetings are parsed and stored on `BridgeCharacter`, but v1 uses the primary `firstMes` only.

## 10. Discord App Setup

Document in `docs/discord-app-setup.md`.

Developer Portal setup:

- Create application.
- Add bot.
- Enable Message Content Intent.
- OAuth2 scopes:
  - `bot`
  - `applications.commands`
- Bot permissions:
  - View Channels
  - Send Messages
  - Read Message History
  - Use Application Commands
  - Send Messages in Threads
  - Optional, only when the matching feature is enabled:
    - Manage Channels, for `/discord/ensure-forum`
    - Manage Threads, for repair/archive operations outside bot-created active threads
- Invite bot to the private guild.

Do not request `GUILD_MEMBERS` or `GUILD_PRESENCES`. `MESSAGE_CONTENT` is the only privileged intent required in v1 because normal forum-thread messages are RP input.

Discord model:

- One forum channel is the conversation hub.
- Each ST conversation is one Discord forum post/thread.
- The bot creates a forum post when `/st new` is used.
- The first post content is the character's first message.
- Regular messages in the forum thread are RP input.
- If the configured forum has the `REQUIRE_TAG` flag, the bridge must apply configured `defaultForumTagIds` or fail `/st new` with a clear admin-facing error.
- The implementation must enforce Discord limits for forum thread names and message content.

Slash commands:

- `/st new character:<autocomplete>`: create a new conversation thread.
- `/st status`: show bridge status.
- `/st character`: show the active character for the current thread.
- `/st sync`: diagnostics-only command that verifies this thread maps to an existing bridge state entry and chat file; v1 does not repair or rewrite state from this command.

Message components:

- Previous swipe button.
- Regenerate button.
- Next swipe button.

Component custom ID format:

```text
stb:v1:swipe_prev:{threadId}:{bridgeMessageId}
stb:v1:swipe_regen:{threadId}:{bridgeMessageId}
stb:v1:swipe_next:{threadId}:{bridgeMessageId}
```

Swipe controls must show a visible `Swipe N/M` counter and disable previous/next at the ends.

## 11. Discord Event Handling

Implement `src/server-plugin/discord/message-handler.ts`.

Message create flow:

1. Ignore bot messages.
2. Ignore messages outside the configured guild.
3. Ignore messages outside tracked forum threads.
4. Check allowlist.
5. Check profile enabled.
6. Acquire the per-chat-file queue lock.
7. Append user message to ST chat.
8. Build prompt from ST chat and character card.
9. Read current ST Claude settings.
10. Generate reply through Claude reverse proxy.
11. Append assistant message to ST chat.
12. Send Discord reply with swipe buttons.
13. Persist updated state.

Failure behavior:

- If allowlist fails for ordinary message-create flow: default silent ignore.
- If allowlist fails for slash-command interactions: ephemeral rejection is allowed.
- If ST settings invalid: reply with a concise admin-visible error in the thread.
- If generation fails: save user message, post error, leave thread usable.
- If save fails: do not call the model; post storage error.

## 12. Regeneration And Swipes

Implement `src/server-plugin/discord/interactions.ts`.

Regenerate flow:

1. Validate component ID.
2. Check allowlist.
3. Load thread state.
4. Resolve the mapped chat file and acquire the per-chat-file queue lock.
5. Load chat file.
6. Find assistant message by `extra.discord_bridge.bridge_message_id`.
7. Build prompt using chat history up to the prior user message, excluding the current assistant reply.
8. Generate a new reply.
9. Append text to `swipes`.
10. Append matching `swipe_info`.
11. Set `swipe_id` to the new last index.
12. Set `mes` to selected swipe.
13. Save chat atomically.
14. Edit the existing Discord message content and components.

Previous/next flow:

1. Validate component ID.
2. Check allowlist.
3. Load thread state and acquire the per-chat-file queue lock.
4. Load assistant message.
5. Move `swipe_id`.
6. Set `mes` to selected swipe.
7. Save chat atomically.
8. Edit the existing Discord message content and counter.
9. Disable previous/next buttons when the selected swipe is at the first/last boundary.

No branch-on-regenerate in v1.

## 13. Server Plugin API Routes

Mount all routes under:

```text
/api/plugins/discord-bridge
```

Routes:

- `GET /status`
  - Bot ready state, Discord user tag, guild ID, forum channel ID, tracked conversation count, ST user handle, ST Claude settings validity.
- `GET /config`
  - Redacted config and masked secret presence.
- `PUT /config`
  - Update config with Zod validation.
- `PUT /secrets`
  - Update Discord bot token only.
- `POST /bot/restart`
  - Stop and restart Discord client.
- `POST /discord/test`
  - Validate token, guild, forum, and permissions.
- `POST /discord/register-commands`
  - Register guild slash commands.
- `POST /discord/ensure-forum`
  - Create or repair the configured forum channel when permitted.
- `GET /characters`
  - List available ST characters for the target ST user.
- `GET /st-settings/status`
  - Validate current ST Chat Completion Claude settings.
- `POST /model/smoke`
  - Explicit low-token Claude proxy smoke test.

Route security:

- Read-only diagnostics may be called from the SillyTavern UI session.
- Treat `request.user` as identity context, not a full privilege boundary, because account-disabled SillyTavern instances may populate the default user.
- Require an authenticated ST browser session for UI calls where accounts are enabled.
- Require admin user when accounts are enabled and `request.user.profile.admin` is available.
- Mutating routes (`PUT /config`, `PUT /secrets`, `POST /bot/restart`, `POST /discord/*`, `POST /model/smoke`) must not authorize by `request.user` alone.
- Mutating route calls from non-UI scripts must require `DISCORD_BRIDGE_PLUGIN_AUTH_TOKEN`.
- In account-disabled mode, mutating routes must still enforce a stronger runtime gate: accept only same-origin browser requests from a local/whitelisted ST deployment, or requests with a valid `DISCORD_BRIDGE_PLUGIN_AUTH_TOKEN`.
- In account-disabled mode, reject remote/public mutating requests even if `request.user` is populated with the default user.
- Never return raw secrets.

## 14. UI Extension

Create `src/ui-extension/manifest.json`:

```json
{
  "display_name": "Discord Bridge",
  "loading_order": 100,
  "requires": [],
  "optional": [],
  "js": "index.js",
  "css": "styles.css",
  "author": "WyrmKeep",
  "version": "0.1.0",
  "homePage": "https://github.com/WyrmKeep/sillytavern-discord-bridge",
  "auto_update": false,
  "minimum_client_version": "1.17.0"
}
```

Settings panel sections:

- Status:
  - Plugin reachable.
  - Bot ready.
  - Discord guild/forum valid.
  - ST Claude settings valid.
- SillyTavern user:
  - Target user handle.
  - Character count.
- Discord:
  - Client ID.
  - Guild ID.
  - Forum channel ID.
  - Forum creation button.
  - Command registration button.
  - Bot restart button.
- Secret:
  - Discord bot token write-only field.
- Access:
  - Allowlisted Discord user IDs.
  - Admin Discord user IDs.
- Profiles:
  - Discord user ID.
  - Prompt name.
  - Display name.
  - Persona.
  - Enabled flag.
- Defaults:
  - Default character.
  - Max history messages.
  - Max reply characters.
  - Include creator notes.
  - Include post-history instructions.
- Diagnostics:
  - `GET /st-settings/status`.
  - `POST /model/smoke` with confirmation.
  - Redacted error output.

## 15. Testing Plan

Unit tests:

- `tests/unit/config.schema.test.ts`
  - Valid config parses.
  - Missing Discord guild fails.
  - Duplicate allowlist entries normalize.
  - Secrets redact.
- `tests/unit/st-settings.test.ts`
  - Reads `settings.oai_settings`.
  - Reads legacy root-level settings.
  - Rejects non-Chat Completion `main_api`.
  - Rejects non-Claude source.
  - Rejects missing reverse proxy.
  - Rejects non-`claude-sonnet-4-6` model.
  - Forces streaming off.
- `tests/unit/claude-reverse-proxy.test.ts`
  - Joins `/messages` correctly.
  - Sends Anthropic-compatible request body.
  - Adds `x-api-key` only when proxy password exists.
  - Parses Anthropic response.
  - Parses OpenAI-style fallback response.
  - Redacts failed response previews.
- `tests/unit/characters.test.ts`
  - Normalizes V2 card fixture.
  - Normalizes legacy V1 card fixture.
  - Handles missing optional fields.
- `tests/unit/chats.test.ts`
  - Creates JSONL header.
  - Appends user message.
  - Appends assistant message.
  - Appends swipe and updates `swipe_id`.
  - Atomic save writes valid JSONL.
- `tests/unit/prompt-builder.test.ts`
  - Includes character fields.
  - Includes mapped Discord profiles.
  - Uses selected assistant swipe.
  - Trims old history by message count.
- `tests/unit/discord-components.test.ts`
  - Encodes component custom IDs.
  - Rejects malformed IDs.
  - Rejects mismatched thread IDs.

Integration tests:

- `tests/integration/new-conversation.test.ts`
  - Fake `/st new` creates thread state, chat file, and first message payload.
- `tests/integration/message-generation.test.ts`
  - Fake Discord message from allowed user saves user turn, calls fake Claude client, saves assistant turn, and returns Discord reply payload.
- `tests/integration/allowlist.test.ts`
  - Non-allowlisted user does not call model and does not mutate chat.
- `tests/integration/regenerate.test.ts`
  - Regenerate button appends swipe, updates selected text, saves JSONL, edits same Discord message.
- `tests/integration/restart-recovery.test.ts`
  - Reloads `state.json` and continues a tracked thread after bot restart.

Additional required tests:

- `tests/unit/st-settings.test.ts`
  - Reads `assistant_prefill`, `use_sysprompt`, `reasoning_effort`, `verbosity`, `proxy_password`, and current Chat Completion Claude keys from `settings.oai_settings`.
  - Treats `proxy_password` as optional.
  - Documents that `stream_openai` is intentionally overridden to `stream: false`.
- `tests/unit/characters.test.ts`
  - Parses PNG V3 cards and prefers V3 metadata over older embedded metadata when both exist.
  - Derives `chatFolderName` from the avatar filename stem, not display name or a bridge-defined internal name.
  - Covers v1 alternate-greetings behavior.
- `tests/unit/chats.test.ts`
  - Keeps `swipes.length === swipe_info.length`.
  - Keeps `mes === swipes[swipe_id]` after regenerate, previous, and next.
  - Persists and resolves a stable bridge assistant message ID in `extra.discord_bridge`.
- `tests/unit/claude-reverse-proxy.test.ts`
  - Forwards `assistant_prefill`, `use_sysprompt`, `stop_sequences`, and `top_k`; verifies `reasoning_effort` and `verbosity` are not sent to native Anthropic `/messages` without a supported mapping.
  - Applies Claude 4.6 request-shaping rules for `temperature` versus `top_p`.
  - Redacts failed response previews without leaking secrets or chat content.
- `tests/unit/prompt-builder.test.ts`
  - Honors `includeCreatorNotes` and `includePostHistoryInstructions`.
  - Uses the documented policy for empty `firstMes`.
  - Uses the documented policy for `maxReplyCharacters`.
- `tests/unit/discord-permissions.test.ts`
  - Computes the minimal invite permission set.
  - Detects forum channels with `REQUIRE_TAG`.
  - Rejects unsupported forum configurations with a clear admin-facing error.
- `tests/unit/route-auth.test.ts`
  - Verifies mutating routes are not authorized by `request.user` alone when SillyTavern user accounts are disabled.
  - Verifies non-UI/script mutations require `DISCORD_BRIDGE_PLUGIN_AUTH_TOKEN`.
  - Verifies account-disabled mutating routes reject requests that are neither same-origin local/whitelisted UI calls nor valid plugin-token calls.
- `tests/integration/chat-visibility-in-st.test.ts`
  - Bridge-created chats are stored under the selected character's avatar-derived chat folder.
- `tests/integration/chat-save-collision.test.ts`
  - Defines and verifies behavior when SillyTavern and the bridge attempt to modify the same chat concurrently.
- `tests/integration/forum-required-tags.test.ts`
  - `/st new` succeeds when tags are configured and fails clearly when tags are required but unavailable.
- `tests/integration/message-length-policy.test.ts`
  - Handles starter messages, thread titles, and assistant replies that exceed Discord limits.
- `tests/integration/concurrent-actions.test.ts`
  - Serializes repeated regenerate clicks and overlapping user messages in the same thread.
- `tests/integration/recovery-edge-cases.test.ts`
  - Handles archived/deleted Discord threads and missing chat files on restart.
- `tests/contract/sillytavern-imports.contract.test.ts`
  - Pins the supported SillyTavern release and validates all internal imports used by the bridge.
- `tests/contract/chat-folder-visibility.contract.test.ts`
  - Verifies the avatar-derived folder rule that makes bridge-created chats visible under the selected character.
- `tests/contract/chat-shape.contract.test.ts`
  - Verifies JSONL header/message shape needed for ST chat loading and swipe handling.
- `tests/contract/character-shape.contract.test.ts`
  - Verifies required character metadata fields, including V3 card data.
- `tests/contract/claude-request-parity.contract.test.ts`
  - Verifies supported Claude request fields sent through the reverse proxy.

Smoke tests:

- `npm run smoke:claude-proxy`
  - Requires `DISCORD_BRIDGE_SMOKE=1`.
  - Reads real ST settings for configured user.
  - Sends low-token `POST {reverse_proxy}/messages`.
- `npm run smoke:discord`
  - Requires bot token and guild ID.
  - Checks login, guild, forum, and permissions.

Required local verification:

```bash
npm run typecheck
npm run lint
npm test -- --coverage
npm run build
npm audit --audit-level=high
```

Required manual verification:

- Install server plugin into `SillyTavern/plugins/discord-bridge`.
- Install UI extension into the target user's extensions folder or global third-party extension folder.
- Set `enableServerPlugins: true`.
- Start SillyTavern.
- Confirm plugin appears in server logs.
- Confirm UI panel appears.
- Confirm ST settings diagnostic reads Chat Completion > Claude > reverse proxy > `claude-sonnet-4-6`.
- Register Discord commands.
- Create a forum conversation from Discord.
- Create a forum conversation with required tags enabled, or verify the configured forum has no required tags.
- Send a normal message.
- Confirm the reply appears in Discord.
- Confirm the chat JSONL appears under the character's ST chats folder.
- Open the saved conversation in SillyTavern.
- Regenerate from Discord and confirm ST `swipes` persist.
- Restart the bridge and continue the same Discord thread.
- Verify normal logs do not contain prompts, completions, proxy passwords, Discord tokens, or private chat content.

## 16. Implementation Tasks

### Task 0: Upstream Contract Capture

**Files:**

- Create `src/server-plugin/sillytavern/imports.ts`
- Create `src/server-plugin/sillytavern/versions.ts`
- Create `tests/contract/sillytavern-imports.contract.test.ts`
- Create `tests/contract/chat-folder-visibility.contract.test.ts`
- Create `tests/contract/chat-shape.contract.test.ts`
- Create `tests/contract/character-shape.contract.test.ts`
- Create `tests/contract/claude-request-parity.contract.test.ts`

Steps:

- [ ] Pin supported SillyTavern version to `1.17.0` in docs and contract tests.
- [ ] Record and test imports for `getUserDirectories`, `character-card-parser`, `getChatData`, `trySaveChat`, and any prompt-conversion helpers used by the bridge.
- [ ] Resolve SillyTavern internal imports relative to the ST install/plugin location, not `process.cwd()`.
- [ ] Capture and test the avatar-derived chat-folder rule that makes bridge-created chats visible under the selected character before implementing chat persistence.
- [ ] Confirm v1 treats simultaneous ST + Discord editing of the same bridge-owned chat as unsupported.
- [ ] Confirm v1 targets ST-compatible Claude request shaping, not full browser Prompt Manager parity.
- [ ] Run contract tests and commit as `test: capture sillytavern integration contracts`.

### Task 1: Repository Foundation

**Files:**

- Create `package.json`
- Create `tsconfig.json`
- Create `tsconfig.server.json`
- Create `tsconfig.ui.json`
- Create `vite.config.ts`
- Create `eslint.config.js`
- Create `.prettierrc.json`
- Create `.gitignore`
- Create `.env.example`
- Create `.github/workflows/ci.yml`
- Create `.github/dependabot.yml`
- Create `.github/pull_request_template.md`
- Create `.github/CODEOWNERS`
- Create `README.md`
- Create `SECURITY.md`
- Create `LICENSE`
- Create `AGENTS.md`

Steps:

- [ ] Initialize npm package with ESM and Node 20 engine.
- [ ] Add runtime dependencies: `discord.js`, `zod`, `write-file-atomic`.
- [ ] Add dev dependencies: `typescript`, `vite`, `vitest`, `@vitest/coverage-v8`, `eslint`, `typescript-eslint`, `prettier`.
- [ ] Add scripts: `build`, `build:server`, `build:ui`, `typecheck`, `lint`, `test`, `test:coverage`, `smoke:claude-proxy`, `smoke:discord`, `pack`, `install-local`.
- [ ] Add GitHub Actions CI for install, typecheck, lint, tests with coverage, build, and audit.
- [ ] Add private-repo safety docs and PR template.
- [ ] Commit as `chore: initialize bridge repository`.

### Task 2: Config, Secrets, And State Stores

**Files:**

- Create `src/server-plugin/config/schema.ts`
- Create `src/server-plugin/config/paths.ts`
- Create `src/server-plugin/config/store.ts`
- Create `src/server-plugin/config/redact.ts`
- Create `src/server-plugin/state/schema.ts`
- Create `src/server-plugin/state/store.ts`
- Create `src/server-plugin/state/locks.ts`
- Create `tests/unit/config.schema.test.ts`
- Create `tests/unit/state.store.test.ts`

Steps:

- [ ] Write failing tests for config defaults, validation, redaction, and atomic persistence.
- [ ] Implement config and secrets schemas.
- [ ] Implement data-root path resolver.
- [ ] Implement atomic JSON read/write.
- [ ] Implement state schema and conversation map helpers.
- [ ] Implement a per-chat-file promise queue in `locks.ts`, keyed by normalized chat file path.
- [ ] Run targeted tests and commit as `feat: add bridge config and state stores`.

### Task 3: SillyTavern Internal Adapter

**Files:**

- Create `src/server-plugin/sillytavern/imports.ts`
- Create `src/server-plugin/sillytavern/users.ts`
- Create `src/server-plugin/sillytavern/settings.ts`
- Create `src/server-plugin/sillytavern/versions.ts`
- Create `tests/fixtures/settings/st-claude-reverse-proxy.json`
- Create `tests/fixtures/settings/st-not-claude.json`
- Create `tests/fixtures/settings/st-legacy-openai-root.json`
- Create `tests/unit/st-settings.test.ts`

Steps:

- [ ] Write failing tests for ST settings normalization.
- [ ] Implement dynamic imports resolved relative to the SillyTavern install/plugin location.
- [ ] Resolve target user directories with configured `sillyTavernUserHandle`.
- [ ] Read and parse `{userRoot}/settings.json`.
- [ ] Normalize `settings.oai_settings` and legacy root-level settings.
- [ ] Validate Claude reverse-proxy source/model.
- [ ] Normalize `assistant_prefill`, `use_sysprompt`, stop strings, `reasoning_effort`, `verbosity`, optional `proxy_password`, and the bridge's `stream: false` override.
- [ ] Add ST version check for package version `1.17.0` and fail clearly outside supported versions until contract tests are updated.
- [ ] Run targeted tests and commit as `feat: read sillytavern claude settings`.

### Task 4: Character And Chat Storage

**Files:**

- Create `src/server-plugin/sillytavern/characters.ts`
- Create `src/server-plugin/sillytavern/chats.ts`
- Create `tests/fixtures/characters/character-v2.json`
- Create `tests/fixtures/characters/character-v1.json`
- Create `tests/fixtures/characters/character-v3.png`
- Create `tests/fixtures/chats/simple-chat.jsonl`
- Create `tests/unit/characters.test.ts`
- Create `tests/unit/chats.test.ts`

Steps:

- [ ] Write failing tests for V1/V2/V3 character normalization.
- [ ] Write failing tests for avatar-derived `chatFolderName`.
- [ ] Write failing tests for JSONL chat creation and assistant swipe persistence.
- [ ] Implement character card reader using ST parser when available.
- [ ] Implement fixture JSON path for tests only.
- [ ] Prefer ST `getChatData` and `trySaveChat` helpers; implement direct JSONL parser/serializer only as fallback.
- [ ] Implement create conversation chat file.
- [ ] Implement append user and assistant messages.
- [ ] Implement update assistant swipe.
- [ ] Implement stable `bridge_message_id` lookup for assistant messages.
- [ ] Run targeted tests and commit as `feat: persist discord conversations as st chats`.

### Task 5: Prompt Builder And Claude Reverse Proxy Client

**Files:**

- Create `src/server-plugin/generation/types.ts`
- Create `src/server-plugin/generation/prompt-builder.ts`
- Create `src/server-plugin/generation/token-budget.ts`
- Create `src/server-plugin/generation/claude-reverse-proxy.ts`
- Create `tests/unit/prompt-builder.test.ts`
- Create `tests/unit/claude-reverse-proxy.test.ts`
- Create `scripts/smoke-claude-proxy.mjs`

Steps:

- [ ] Write failing tests for prompt content and history trimming.
- [ ] Write failing tests for Anthropic-compatible request construction.
- [ ] Write failing tests for Claude 4.6 request shaping, including `assistant_prefill`, `use_sysprompt`, stop strings, `top_k`, omitting unsupported `reasoning_effort` / `verbosity`, and limited sampling.
- [ ] Implement prompt builder as bridge-owned intermediate ChatML-style messages.
- [ ] Implement simple message-count token budget policy.
- [ ] Implement reverse-proxy client.
- [ ] Implement smoke script guarded by `DISCORD_BRIDGE_SMOKE=1`.
- [ ] Run targeted tests and commit as `feat: generate with st claude reverse proxy settings`.

### Task 6: Discord Client And Commands

**Files:**

- Create `src/server-plugin/discord/client.ts`
- Create `src/server-plugin/discord/commands.ts`
- Create `src/server-plugin/discord/forum.ts`
- Create `src/server-plugin/discord/permissions.ts`
- Create `scripts/register-discord-commands.mjs`
- Create `tests/unit/discord-commands.test.ts`

Steps:

- [ ] Write failing tests for command definitions, minimal permission checks, and required forum tags.
- [ ] Implement Discord client lifecycle.
- [ ] Implement guild command payloads.
- [ ] Implement forum channel lookup and optional create/repair only when configured.
- [ ] Implement required-tag handling for forum posts.
- [ ] Implement permission diagnostics.
- [ ] Implement command registration script.
- [ ] Export plugin `exit()` and destroy the Discord client cleanly on server shutdown/reload.
- [ ] Run targeted tests and commit as `feat: add discord client and command registration`.

### Task 7: Conversation Flow

**Files:**

- Create `src/server-plugin/discord/message-handler.ts`
- Create `src/server-plugin/discord/interactions.ts`
- Create `src/server-plugin/discord/components.ts`
- Create `tests/integration/new-conversation.test.ts`
- Create `tests/integration/message-generation.test.ts`
- Create `tests/integration/allowlist.test.ts`

Steps:

- [ ] Write failing integration test for `/st new`.
- [ ] Write failing integration test for message-to-generation flow.
- [ ] Write failing integration test for allowlist rejection.
- [ ] Implement `/st new` interaction handler.
- [ ] Implement Discord thread state creation.
- [ ] Implement normal message handler with per-chat-file queue.
- [ ] Implement first-message injection.
- [ ] Implement title/content length handling for Discord limits.
- [ ] Run integration tests and commit as `feat: run discord conversations`.

### Task 8: Swipe Controls

**Files:**

- Modify `src/server-plugin/discord/interactions.ts`
- Modify `src/server-plugin/discord/components.ts`
- Modify `src/server-plugin/sillytavern/chats.ts`
- Create `tests/unit/discord-components.test.ts`
- Create `tests/integration/regenerate.test.ts`

Steps:

- [ ] Write failing tests for component ID encode/decode.
- [ ] Write failing integration test for regenerate.
- [ ] Implement previous/next/regenerate handlers using stable `bridge_message_id`, not chat index.
- [ ] Ensure regenerate/previous/next handlers use the same per-chat-file queue used by normal message handling.
- [ ] Persist `swipes`, `swipe_id`, and `swipe_info`.
- [ ] Edit existing Discord message instead of appending alternatives.
- [ ] Render `Swipe N/M` and disable previous/next at boundaries.
- [ ] Run targeted tests and commit as `feat: support discord swipe controls`.

### Task 9: Plugin Routes

**Files:**

- Create `src/server-plugin/routes/index.ts`
- Create `src/server-plugin/routes/status.ts`
- Create `src/server-plugin/routes/config.ts`
- Create `src/server-plugin/routes/discord.ts`
- Create `src/server-plugin/routes/characters.ts`
- Create `src/server-plugin/routes/diagnostics.ts`
- Modify `src/server-plugin/index.ts`
- Create `tests/integration/plugin-routes.test.ts`

Steps:

- [ ] Write failing route tests with fake request users.
- [ ] Write route tests for account-enabled admin checks, account-disabled local mode, and optional plugin auth token.
- [ ] Implement status route.
- [ ] Implement config and secret routes.
- [ ] Implement Discord diagnostic routes.
- [ ] Implement ST settings diagnostic route.
- [ ] Implement model smoke route.
- [ ] Wire routes from plugin `init(router)`.
- [ ] Run route tests and commit as `feat: expose bridge plugin api`.

### Task 10: UI Extension

**Files:**

- Create `src/ui-extension/manifest.json`
- Create `src/ui-extension/index.ts`
- Create `src/ui-extension/api.ts`
- Create `src/ui-extension/settings-panel.ts`
- Create `src/ui-extension/styles.css`
- Create `src/ui-extension/templates/settings.html`
- Create `tests/unit/ui-api.test.ts`

Steps:

- [ ] Write failing tests for UI API client redaction handling.
- [ ] Implement manifest.
- [ ] Implement API client.
- [ ] Use `SillyTavern.getContext()` and `renderExtensionTemplateAsync()` for UI integration; do not import frontend internals directly.
- [ ] Implement settings panel rendering.
- [ ] Add status, Discord, access, profile, defaults, diagnostics sections.
- [ ] Ensure secret fields are write-only.
- [ ] Build UI bundle and commit as `feat: add sillytavern settings panel`.

### Task 11: Packaging And Local Install

**Files:**

- Create `scripts/install-local.mjs`
- Create `scripts/pack-extension.mjs`
- Create `docs/install-local.md`
- Create `docs/operation.md`

Steps:

- [ ] Implement build output layout for ST plugin and UI extension.
- [ ] Implement install script that copies server plugin to `SillyTavern/plugins/discord-bridge`.
- [ ] Implement install script that copies UI extension to the target ST extension folder.
- [ ] Document Windows PowerShell install commands.
- [ ] Document how to enable `enableServerPlugins: true`.
- [ ] Run local pack build and commit as `build: add local install packaging`.

### Task 12: Documentation And Hardening

**Files:**

- Create `docs/architecture.md`
- Create `docs/discord-app-setup.md`
- Create `docs/testing.md`
- Create `docs/troubleshooting.md`
- Create `docs/unsupported-scope.md`
- Update `README.md`
- Update `SECURITY.md`

Steps:

- [ ] Document final architecture and source docs.
- [ ] Document Discord Developer Portal setup.
- [ ] Document ST settings requirements: Chat Completion, Claude, reverse proxy, `claude-sonnet-4-6`.
- [ ] Document private repo handling and secret policy.
- [ ] Document threat model, backup/restore, dependency update policy, and secret rotation.
- [ ] Document unsupported v1 scope: group chats, multi-character chats, simultaneous ST editing of active bridge chats, DMs, attachments, streaming, public deployment, and alternate greeting selection.
- [ ] Document smoke tests.
- [ ] Add troubleshooting for invalid ST settings, missing Message Content intent, forum permission failures, and Claude proxy failures.
- [ ] Run full verification and commit as `docs: add bridge setup and operations guide`.

## 17. CI Workflow

`.github/workflows/ci.yml` must run on pull requests and pushes to `main`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test -- --coverage
      - run: npm run build
      - run: npm audit --audit-level=high
```

CI must not run Discord or Claude proxy smoke tests because those require local/private secrets.

## 18. Acceptance Criteria

The implementation is complete when:

- The private repo builds from a clean clone with `npm ci && npm run build`.
- CI passes typecheck, lint, tests, coverage, build, and audit.
- The server plugin loads in SillyTavern with `enableServerPlugins: true`.
- The UI extension panel appears in SillyTavern.
- The UI validates that ST is configured as Chat Completion > Claude > reverse proxy > `claude-sonnet-4-6`.
- The bot connects to Discord and registers guild commands.
- `/st new` creates a forum post/thread and a matching ST JSONL chat file.
- The character's first message is injected into Discord and stored in ST.
- Normal Discord thread messages from allowlisted users are saved as ST user messages.
- Assistant replies are generated through the ST-configured Claude reverse proxy with ST-compatible Claude 4.6 request shaping and saved as ST assistant messages.
- Regenerate/previous/next controls update one Discord bot message and persist real ST swipes.
- The resulting conversation can be opened from SillyTavern under the selected character.
- Bridge-created chats are stored under the avatar-derived ST chat folder.
- Simultaneous editing of the same active bridge chat in SillyTavern and Discord is rejected or documented as unsupported.
- Logs and UI never expose Discord bot token, proxy password, or full private settings.

## 19. GPT-5 Pro Review Checklist

Ask GPT-5 Pro to review for:

- Whether the plan properly reuses SillyTavern's Claude reverse-proxy settings.
- Whether ST-compatible Claude 4.6 request shaping is complete enough for v1.
- Whether the plugin/server split is installable in current SillyTavern.
- Whether avatar-derived chat folder storage and JSONL persistence are compatible with ST chat loading.
- Whether Discord forum/thread behavior and permissions are sufficient.
- Whether the route security model is acceptable when ST user accounts are disabled.
- Whether the security model is acceptable for a private two-user bot.
- Whether tests cover failure cases before real Discord/model calls.
- Whether any implementation task is too broad or missing required files.
- Whether the project has avoidable coupling to unstable SillyTavern internals.
