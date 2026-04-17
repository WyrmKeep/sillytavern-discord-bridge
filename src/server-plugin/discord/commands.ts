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
