export type BotPermission =
  | 'ViewChannel'
  | 'SendMessages'
  | 'SendMessagesInThreads'
  | 'ReadMessageHistory'
  | 'UseApplicationCommands'
  | 'ManageChannels'
  | 'ManageThreads';

export const REQUIRED_BOT_PERMISSIONS: BotPermission[] = [
  'ViewChannel',
  'SendMessages',
  'SendMessagesInThreads',
  'ReadMessageHistory',
  'UseApplicationCommands',
];

export type OptionalPermissionFlags = {
  ensureForum: boolean;
  manageThreads: boolean;
};

export function optionalBotPermissions(flags: OptionalPermissionFlags): BotPermission[] {
  const permissions: BotPermission[] = [];
  if (flags.ensureForum) {
    permissions.push('ManageChannels');
  }
  if (flags.manageThreads) {
    permissions.push('ManageThreads');
  }
  return permissions;
}

export function assertForumTagConfiguration(input: {
  requireTag: boolean;
  configuredTagIds: string[];
}): void {
  if (input.requireTag && input.configuredTagIds.length === 0) {
    throw new Error('Forum has required tag flag but no default forum tag IDs are configured.');
  }
}
