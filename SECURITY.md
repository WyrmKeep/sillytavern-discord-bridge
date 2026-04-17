# Security

This repository is private and intended for a trusted two-user deployment.

Do not commit real tokens, real SillyTavern settings, real character cards, real chat logs, real Discord IDs, or private proxy URLs.

Default logs must not include prompts, completions, token values, proxy passwords, Discord tokens, or private chat content. Debug logging that can include conversation text must be off by default and written only to gitignored local files.

Rotate Discord bot tokens, plugin auth tokens, and reverse proxy credentials immediately if they are exposed.
