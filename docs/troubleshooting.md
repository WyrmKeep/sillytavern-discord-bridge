# Troubleshooting

- Invalid ST settings: confirm Chat Completion > Claude > reverse proxy > `claude-sonnet-4-6`.
- Discord failures: confirm Message Content Intent and forum permissions.
- Proxy failures: run the guarded smoke test with local settings.
- Slash commands missing: restart SillyTavern or save bridge config so the plugin reconciles guild command registration; then use `npm run register:discord` only as a manual fallback.
- No bot replies: confirm the Discord bot status is `ready`, the message is inside a bridge-created thread, and the sending Discord user ID is allowlisted.
- Swipe buttons fail: avoid editing the same active chat in SillyTavern while Discord is mutating it, and confirm the bot can edit its own messages in the thread.
