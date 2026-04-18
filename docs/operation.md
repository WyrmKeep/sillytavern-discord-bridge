# Operation Guide

Run the bridge only on a private/local SillyTavern deployment. Do not expose the bridge or SillyTavern publicly without explicit authentication.

## Normal Startup

1. Start SillyTavern.
2. Confirm the server plugin loaded.
3. Confirm the UI extension can reach:

   ```text
   /api/plugins/discord-bridge/status
   ```

4. Confirm the Discord bot token and bridge config are present in local runtime storage.
5. Confirm `ST Chat Completion preset` is set to the preset filename without `.json`.
6. Confirm that preset exists at `{DATA_ROOT}/{handle}/OpenAI Settings/{preset}.json`.
7. The server plugin logs in the Discord bot and registers guild slash commands during startup/reconcile.
8. Use `/st status` in the private guild.

## Daily Use

Start a new RP conversation from Discord:

```text
/st new character:<character>
```

The bridge should:

- resolve the selected SillyTavern character card
- derive the chat folder from the character avatar filename stem
- create one Discord forum post/thread
- create one SillyTavern JSONL chat file
- map the Discord thread ID to that chat file in bridge state

Then send normal messages inside the thread. Those messages are appended to the mapped SillyTavern chat, combined with the pinned saved Chat Completion preset, and generated through SillyTavern's Chat Completion backend route.

Slash commands available in v1:

- `/st new character:<character>` creates a Discord forum post/thread and a bridge-owned SillyTavern chat.
- `/st status` confirms the bot command handler is reachable.
- `/st character` reports the mapped SillyTavern character for the current bridge thread.
- `/st sync` reports the mapped chat folder/file for the current bridge thread.
- `/persona set name:<name> description:<persona>` stores your Discord Bridge persona and uses `name` for `{{user}}` macro replacement.

The `character` option autocompletes from the configured SillyTavern user's character cards.

## Swipe / Regenerate Flow

Assistant messages use bridge-owned message IDs in `extra.discord_bridge`.

Buttons should behave as follows:

- regenerate creates a new swipe for the same assistant message
- previous selects the previous swipe
- next selects the next swipe
- the visible counter shows the selected swipe, for example `Swipe 2/4`
- previous/next are disabled at the first/last swipe

All of those mutations must use the same per-chat-file queue as normal message handling.

## Concurrency Rule

v1 does not support simultaneous editing of the same active bridge chat in both SillyTavern and Discord.

Operationally:

- continue a bridge-created chat in Discord, or
- stop using the Discord thread and continue it in SillyTavern

Do not keep both sides actively modifying the same chat file at the same time.

## Backups

Before upgrading the bridge or changing persistence logic, back up:

- `{DATA_ROOT}/_discord-bridge/config.json`
- `{DATA_ROOT}/_discord-bridge/secrets.json`
- `{DATA_ROOT}/_discord-bridge/state.json`
- any affected SillyTavern chat folders under `{DATA_ROOT}/{handle}/chats/`

Runtime chat data, debug dumps, and local secrets must stay out of git.

## Headless Prompt Profile

The bridge does not require a SillyTavern browser tab to stay open. It reads the saved preset file directly:

```text
{DATA_ROOT}/{handle}/OpenAI Settings/{preset}.json
```

Configure `ST Chat Completion preset` with the filename stem only. For example, `Roleplay` loads:

```text
{DATA_ROOT}/{handle}/OpenAI Settings/Roleplay.json
```

If the preset is missing, generation fails clearly instead of falling back to a simplified prompt. Save jailbreak, main prompt, NSFW prompt, and prompt ordering into the preset before using it from Discord.

## Logging

Default logs must not include:

- Discord bot tokens
- plugin auth tokens
- reverse proxy credentials
- prompts
- completions
- private chat content

If debug logging is added later, it must be off by default, clearly labeled, gitignored, and easy to delete.

## Shutdown

The server plugin exports `exit()` so SillyTavern can clean up the Discord client on shutdown or reload.

If the bot appears online after shutdown:

- wait briefly for the gateway session to close
- check whether another local SillyTavern or Node process is still running
- avoid starting multiple bridge instances with the same Discord token

## Unsupported In V1

- public internet deployment
- DMs
- attachments
- streaming replies
- group chats
- multi-character chats
- alternate greeting selection
- simultaneous SillyTavern and Discord editing of the same active chat
- live browser-only extension prompt state
- exact SillyTavern frontend token-budget parity
