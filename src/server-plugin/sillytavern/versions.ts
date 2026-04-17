export const SUPPORTED_SILLYTAVERN_VERSION = '1.17.0';

export function assertSupportedSillyTavernVersion(version: string): void {
  if (version !== SUPPORTED_SILLYTAVERN_VERSION) {
    throw new Error(
      `Unsupported SillyTavern version ${version}. Expected ${SUPPORTED_SILLYTAVERN_VERSION}.`,
    );
  }
}
