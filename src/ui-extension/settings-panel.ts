import { fetchBridgeStatus } from './api.js';

declare global {
  interface Window {
    SillyTavern?: {
      getContext?: () => unknown;
      renderExtensionTemplateAsync?: (extensionName: string, templateId: string) => Promise<string>;
    };
  }
}

export async function mountSettingsPanel(container: HTMLElement): Promise<void> {
  window.SillyTavern?.getContext?.();
  const template =
    (await window.SillyTavern?.renderExtensionTemplateAsync?.(
      'third-party/discord-bridge',
      'settings',
    )) ?? '<section id="discord-bridge-settings"><h3>Discord Bridge</h3><p data-status></p></section>';

  container.insertAdjacentHTML('beforeend', template);
  const status = await fetchBridgeStatus().catch(() => ({ ok: false }));
  const statusNode = container.querySelector('[data-status]');
  if (statusNode) {
    statusNode.textContent = status.ok ? 'Plugin reachable' : 'Plugin unavailable';
  }
}
