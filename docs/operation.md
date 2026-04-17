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
5. Register slash commands after command-shape changes:

   ```powershell
   npm run register:discord
   ```

6. Use `/st status` in the private guild.

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

Then send normal messages inside the thread. Those messages are appended to the mapped SillyTavern chat and sent to Claude through SillyTavern's configured Chat Completion reverse-proxy settings.

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
- full SillyTavern Prompt Manager parity
