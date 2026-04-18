import { REST, Routes } from 'discord.js';
import { buildGuildCommandData } from './commands.js';

export type RegisterGuildCommandsInput = {
  token: string;
  clientId: string;
  guildId: string;
};

export async function registerGuildCommands(input: RegisterGuildCommandsInput): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(input.token);
  await rest.put(Routes.applicationGuildCommands(input.clientId, input.guildId), {
    body: [buildGuildCommandData()],
  });
}
