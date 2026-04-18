# Discord App Setup Guide

This guide sets up one private Discord application for one private guild and one forum channel.

The bridge uses:

- slash commands for `/st`
- a bot gateway connection for forum-thread messages
- message components for regenerate / previous / next swipes
- ordinary forum thread messages as RP input

Because ordinary messages are the RP input path, the bot needs Message Content Intent. It does not need Guild Members or Presence intent.

## Create The Application

1. Open the Discord Developer Portal:

   ```text
   https://discord.com/developers/applications
   ```

2. Select `New Application`.
3. Give it a private name, for example `SillyTavern Bridge`.
4. Copy the Application ID. This becomes:

   ```text
   DISCORD_CLIENT_ID
   ```

5. Keep the application private. This bridge is not designed for public app-directory distribution.

## Create The Bot User

1. Open the application's `Bot` page.
2. Create a bot user if Discord has not created one already.
3. Reset/copy the bot token.
4. Store it only in local secrets or environment variables:

   ```text
   DISCORD_BOT_TOKEN
   ```

Do not paste the token into docs, screenshots, git commits, issue bodies, PRs, logs, or Discord messages.

## Enable Intents

On the application's `Bot` page, under `Privileged Gateway Intents`:

- enable `Message Content Intent`
- leave `Server Members Intent` disabled
- leave `Presence Intent` disabled

Message Content Intent is required because the bridge reads normal forum-thread message content. Members and presences are not used by v1.

## Invite The Bot

Use Discord's OAuth2 / Installation flow for the application.

Required scopes:

- `bot`
- `applications.commands`

Required bot permissions:

- View Channels
- Send Messages
- Send Messages in Threads
- Read Message History
- Use Application Commands

Optional bot permissions:

- Manage Channels, only if `/discord/ensure-forum` or forum auto-create/repair is enabled
- Manage Threads, only if forced unarchive / locked-thread repair is enabled

Do not request `Create Public Threads` for this design. Discord forum/thread-only channel post creation uses `Send Messages`, and replies inside the created thread use `Send Messages in Threads`.

Invite the bot into the one private guild you will use for testing and daily use.

## Get Discord IDs

Enable Developer Mode in Discord:

1. Open Discord user settings.
2. Go to Advanced.
3. Enable Developer Mode.

Then right-click and copy IDs:

- server/guild ID -> `DISCORD_GUILD_ID`
- target forum channel ID -> bridge config `discord.forumChannelId`
- your user ID and your friend's user ID -> `DISCORD_ALLOWED_USER_IDS`
- admin user IDs -> bridge config `access.adminUserIds`
- forum tag IDs, if needed -> bridge config `discord.defaultForumTagIds`

## Prepare The Forum Channel

Create or choose a Discord forum channel to hold bridge conversations.

Recommended channel setup:

- private channel visibility limited to you, your friend, and the bot
- one forum post/thread per SillyTavern conversation
- no required tag while first testing

If the forum channel has a required-tag rule, configure at least one valid tag ID in `discord.defaultForumTagIds`. Discord supports `applied_tags` when creating forum posts, and the bridge must either apply configured tags or fail clearly.

## Local Environment For Scripts

The repo includes script helpers for command registration and smoke checks. In PowerShell:

```powershell
$env:DISCORD_BOT_TOKEN = "replace_with_real_token"
$env:DISCORD_CLIENT_ID = "000000000000000000"
$env:DISCORD_GUILD_ID = "000000000000000000"
$env:DISCORD_ALLOWED_USER_IDS = "000000000000000000,111111111111111111"
```

For non-UI admin route calls, also set:

```powershell
$env:DISCORD_BRIDGE_PLUGIN_AUTH_TOKEN = "replace_with_long_random_local_token"
```

Use `.env.example` only as a placeholder reference. Real `.env` files stay local and gitignored.

## Register Slash Commands

The server plugin registers commands to the configured private guild when the bot starts or when bridge config/secrets are saved. Use the manual script only after command-shape changes or when debugging registration:

```powershell
npm run build
npm run register:discord
```

Guild command registration is preferred for this private bot because it updates faster and avoids exposing commands outside the target guild.

Current command shape:

- `/st new character:<name>`: create a forum-thread conversation for a SillyTavern character
- `/st status`: show bridge status
- `/st character`: show the active character for the current tracked thread
- `/st sync`: verify that the current thread maps to a bridge chat file
- `/persona set name:<name> description:<persona>`: set the Discord user's name/persona for bridge prompts and `{{user}}` macro replacement

## Smoke Check Discord Environment

To check only that required Discord environment variables are present:

```powershell
npm run smoke:discord
```

This smoke check does not prove channel permissions by itself. After the bot is running, verify permissions by creating a bridge thread and sending a test message.

## First Manual Discord Test

1. Start or restart SillyTavern after installing the bridge.
2. Confirm the bridge status route responds.
3. Confirm `/api/plugins/discord-bridge/status` reports the Discord bot as `ready`.
4. In the target Discord guild, run:

   ```text
   /st status
   ```

5. Run:

   ```text
   /st new character:<your character>
   ```

6. Confirm the bot creates a forum post/thread.
7. Send a normal message inside the thread.
8. Confirm the bot replies and the chat file appears under the selected character in SillyTavern.

## Troubleshooting

Slash commands do not appear:

- Confirm the bot was invited to the correct guild.
- Confirm `DISCORD_CLIENT_ID` and `DISCORD_GUILD_ID` are correct.
- Save bridge config again or restart SillyTavern so the plugin reconciles command registration.
- Re-run `npm run register:discord`.
- Confirm the app was installed with `applications.commands`.

Bot cannot create a forum post:

- Confirm the bot can view the forum channel.
- Confirm the bot has Send Messages in the forum channel.
- If tags are required, configure valid `defaultForumTagIds`.
- Confirm the forum channel ID is not a normal text channel ID.

Bot cannot reply inside a thread:

- Confirm Send Messages in Threads is granted.
- Confirm the bot can read message history.
- Confirm the thread is not locked or archived in a way the bot cannot use.

Bot ignores RP messages:

- Confirm Message Content Intent is enabled in the Developer Portal.
- Confirm the bot code requests Message Content intent.
- Confirm the Discord user is allowlisted.
- Confirm the message is in a tracked bridge thread, not a random channel.

Regenerate / swipe buttons fail:

- Confirm the original assistant message belongs to a tracked bridge conversation.
- Confirm the bot can edit its own messages.
- Avoid editing the same active chat in SillyTavern while Discord is mutating it; v1 treats simultaneous ST + Discord editing as unsupported.

## Source Docs

- Discord Bots & Companion Apps: https://docs.discord.com/developers/bots
- Discord OAuth2 and Permissions: https://docs.discord.com/developers/platform/oauth2-and-permissions
- Discord Gateway Intents: https://docs.discord.com/developers/events/gateway
- Discord Threads: https://docs.discord.com/developers/topics/threads
- Discord Channel Resource: https://docs.discord.com/developers/resources/channel
