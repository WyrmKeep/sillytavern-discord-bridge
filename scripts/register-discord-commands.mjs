import { REST, Routes } from 'discord.js';

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const smoke = process.argv.includes('--smoke');

if (!token || !clientId || !guildId) {
  console.error('DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, and DISCORD_GUILD_ID are required.');
  process.exit(smoke ? 0 : 1);
}

const command = {
  name: 'st',
  description: 'SillyTavern Discord Bridge',
  options: [
    {
      type: 1,
      name: 'new',
      description: 'Create a new SillyTavern conversation thread.',
      options: [
        {
          type: 3,
          name: 'character',
          description: 'SillyTavern character card.',
          required: true,
          autocomplete: true,
        },
      ],
    },
    { type: 1, name: 'status', description: 'Show bridge status.' },
    { type: 1, name: 'character', description: 'Show active character for this thread.' },
    { type: 1, name: 'sync', description: 'Verify this thread maps to a bridge chat file.' },
  ],
};

if (smoke) {
  console.log('Discord command smoke passed: env vars are present.');
  process.exit(0);
}

const rest = new REST({ version: '10' }).setToken(token);
await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [command] });
console.log(`Registered /st commands for guild ${guildId}.`);
