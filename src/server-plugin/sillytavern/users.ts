import path from 'node:path';

export type UserDirectories = {
  root: string;
  characters: string;
  chats: string;
  settings: string;
};

export function fallbackUserDirectories(dataRoot: string, handle: string): UserDirectories {
  const root = path.join(dataRoot, handle);
  return {
    root,
    characters: path.join(root, 'characters'),
    chats: path.join(root, 'chats'),
    settings: path.join(root, 'settings.json'),
  };
}
