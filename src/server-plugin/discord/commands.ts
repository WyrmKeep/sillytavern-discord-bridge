export type DiscordCommandOption = {
  type: number;
  name: string;
  description: string;
  options?: DiscordCommandOption[];
  required?: boolean;
  autocomplete?: boolean;
};

export type DiscordCommandData = {
  name: string;
  description: string;
  options: DiscordCommandOption[];
};

const SUB_COMMAND = 1;
const STRING = 3;

export function buildGuildCommandData(): DiscordCommandData {
  return {
    name: 'st',
    description: 'SillyTavern Discord Bridge',
    options: [
      {
        type: SUB_COMMAND,
        name: 'new',
        description: 'Create a new SillyTavern conversation thread.',
        options: [
          {
            type: STRING,
            name: 'character',
            description: 'SillyTavern character card.',
            required: true,
            autocomplete: true,
          },
        ],
      },
      {
        type: SUB_COMMAND,
        name: 'status',
        description: 'Show bridge status.',
      },
      {
        type: SUB_COMMAND,
        name: 'character',
        description: 'Show the active character for this thread.',
      },
      {
        type: SUB_COMMAND,
        name: 'sync',
        description: 'Verify this thread maps to a bridge chat file.',
      },
    ],
  };
}

export function buildPersonaCommandData(): DiscordCommandData {
  return {
    name: 'persona',
    description: 'Manage your Discord Bridge persona.',
    options: [
      {
        type: SUB_COMMAND,
        name: 'set',
        description: 'Set the name and persona used for SillyTavern user macros.',
        options: [
          {
            type: STRING,
            name: 'name',
            description: 'Name used for {{user}}.',
            required: true,
          },
          {
            type: STRING,
            name: 'description',
            description: 'Persona description sent in the prompt.',
            required: true,
          },
        ],
      },
    ],
  };
}

export function buildGuildCommandsData(): DiscordCommandData[] {
  return [buildGuildCommandData(), buildPersonaCommandData()];
}
