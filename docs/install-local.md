# SillyTavern Setup Guide

This bridge has two SillyTavern-side pieces:

- a server plugin, loaded by SillyTavern at startup from `plugins/discord-bridge`
- a UI extension, loaded from `public/scripts/extensions/third-party/discord-bridge`

The UI extension alone is not enough. The Discord bot, local file access, character/chat discovery, and plugin API routes require the server plugin.

## Requirements

- SillyTavern `1.17.0`, matching the version pinned by the bridge contract tests.
- Node.js `20` or newer.
- npm, using the committed `package-lock.json`.
- A local or private SillyTavern deployment. Do not expose SillyTavern or this bridge to the public internet without an explicit authentication plan.
- SillyTavern configured for Chat Completion with Claude through your reverse proxy:
  - API: `Chat Completion`
  - source: `Claude`
  - reverse proxy: your local/private proxy base URL
  - model: `claude-sonnet-4-6`

## Enable Server Plugins

SillyTavern only loads server plugins when `enableServerPlugins` is enabled in the root `config.yaml`.

1. Open the copy of `config.yaml` in your SillyTavern root directory.
2. Set:

   ```yaml
   enableServerPlugins: true
   ```

3. Restart SillyTavern after changing this value.

Do not edit SillyTavern's default config template directly. Edit the active `config.yaml` in the SillyTavern root.

## Build The Bridge

From this repository:

```powershell
npm ci
npm run build
```

Optional packaging check:

```powershell
npm run pack
```

This creates a local package under `packaged/discord-bridge`.

## Install Into SillyTavern

Use the install script so the server plugin and UI extension go to the expected locations.

```powershell
$env:SILLYTAVERN_ROOT = "C:\Path\To\SillyTavern"
npm run install-local
```

The script copies:

- `dist/server-plugin` to `%SILLYTAVERN_ROOT%\plugins\discord-bridge`
- `dist/ui-extension` to `%SILLYTAVERN_ROOT%\public\scripts\extensions\third-party\discord-bridge`
- the UI extension `manifest.json`
- the UI extension templates

Restart SillyTavern after installing.

## Optional UI Extension Install From Git

SillyTavern's built-in Git installer installs UI extensions. It does not install the Node.js server plugin that this bridge needs for Discord, file access, and `/api/plugins/discord-bridge/*` routes.

You can use the installer screen for the UI extension only:

```text
Git URL: https://github.com/WyrmKeep/sillytavern-discord-bridge
Branch or tag: st-ui-extension
```

After that, still install the server plugin with:

```powershell
npm run build
$env:SILLYTAVERN_ROOT = "C:\Path\To\SillyTavern"
npm run install-local
```

If you leave the branch field blank, SillyTavern will use the repository default branch. The default branch is the development repository layout and is not a root-level UI extension package.

## Confirm SillyTavern Loaded It

After restart:

1. Check the SillyTavern console logs for the Discord Bridge plugin startup message.
2. Open SillyTavern in the browser.
3. Open the Extensions panel from the top bar.
4. Confirm the Discord Bridge UI extension is present.
5. Open:

   ```text
   http://127.0.0.1:8000/api/plugins/discord-bridge/status
   ```

   Adjust the host/port if your SillyTavern server uses a different local address.

## Configure Bridge Data

The bridge stores its runtime files under the SillyTavern data root:

```text
{DATA_ROOT}/_discord-bridge/
```

Expected files:

- `config.json`: non-secret bridge settings
- `secrets.json`: local secret values, such as the Discord bot token
- `state.json`: Discord thread to SillyTavern chat mappings

These files are runtime/local data and must not be committed.

Minimum config values for a private two-user setup:

- `sillyTavernUserHandle`: the SillyTavern user handle to read settings and character data from
- `discord.clientId`: Discord application/client ID
- `discord.guildId`: private Discord server ID
- `discord.forumChannelId`: target Discord forum channel ID
- `discord.defaultForumTagIds`: required only when the forum requires tags
- `access.allowlistedUserIds`: the two Discord user IDs allowed to use the bridge
- `access.adminUserIds`: Discord users allowed to run admin/status commands
- `profiles`: fixed Discord-to-persona mappings

Minimum secret:

- `discordBotToken`

Environment variables are only for local scripts and machine-local setup. Keep `.env` files and any real config dumps out of git.

## Validate SillyTavern Claude Settings

The bridge reads SillyTavern's configured Chat Completion settings instead of owning a separate Claude endpoint. Before using Discord, confirm SillyTavern itself is set to:

- `main_api = openai`
- Chat Completion source `claude`
- reverse proxy configured
- model `claude-sonnet-4-6`

Run the guarded Claude smoke test only from a trusted local shell:

```powershell
npm run build
$env:DISCORD_BRIDGE_SMOKE = "1"
$env:SILLYTAVERN_SETTINGS_FILE = "C:\Path\To\SillyTavern\data\default-user\settings.json"
npm run smoke:claude-proxy
```

The reverse proxy may return `404` for `GET /` or `GET /models`. That does not prove failure. The bridge smoke test uses `POST {reverse_proxy}/messages`.

## Update Flow

When bridge code changes:

```powershell
npm ci
npm run build
$env:SILLYTAVERN_ROOT = "C:\Path\To\SillyTavern"
npm run install-local
```

Then restart SillyTavern.

## Troubleshooting

Server plugin does not load:

- Confirm `enableServerPlugins: true`.
- Confirm the plugin directory is `%SILLYTAVERN_ROOT%\plugins\discord-bridge`.
- Restart SillyTavern after copying files.
- Remember server plugins are loaded on startup.

UI extension does not appear:

- Confirm files exist under `%SILLYTAVERN_ROOT%\public\scripts\extensions\third-party\discord-bridge`.
- Confirm `manifest.json` was copied.
- Hard-refresh the SillyTavern browser tab.

Claude smoke test fails:

- Confirm SillyTavern is configured for Chat Completion, not another API mode.
- Confirm the Claude source and model are selected.
- Confirm your reverse proxy accepts `POST /messages`.
- Do not commit the real proxy URL or live probe output.

Bridge-created chats are not visible in SillyTavern:

- Chat folders must be derived from the character card avatar filename stem.
- The expected path is:

  ```text
  {DATA_ROOT}/{handle}/chats/{chatFolderName}/{chatFileName}
  ```

  where `chatFileName` already includes `.jsonl`.

## Source Docs

- SillyTavern Extensions: https://docs.sillytavern.app/extensions/
- SillyTavern Server Plugins: https://docs.sillytavern.app/for-contributors/server-plugins/
- SillyTavern Configuration File: https://docs.sillytavern.app/administration/config-yaml/
