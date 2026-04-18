import { describe, expect, test } from 'vitest';
import { mountSettingsPanelInExtensionsMenu } from '../../src/ui-extension/settings-panel.js';

class FakeStatusNode {
  textContent = '';
}

class FakeElement {
  html = '';
  readonly statusNode = new FakeStatusNode();

  insertAdjacentHTML(_position: InsertPosition, html: string): void {
    this.html += html;
  }

  querySelector(selector: string): FakeStatusNode | null {
    return selector === '[data-status]' ? this.statusNode : null;
  }
}

class FakeDocument {
  constructor(private readonly target: FakeElement | null) {}

  getElementById(id: string): FakeElement | null {
    return id === 'extensions_settings2' ? this.target : null;
  }
}

describe('UI settings panel', () => {
  test('mounts into SillyTavern extension settings container', async () => {
    const settingsRoot = new FakeElement();

    const result = await mountSettingsPanelInExtensionsMenu({
      documentRef: new FakeDocument(settingsRoot),
      renderTemplate: async () => '<section id="discord-bridge-settings"><p data-status></p></section>',
      fetchStatus: async () => ({ ok: true }),
    });

    expect(result).toBe('mounted');
    expect(settingsRoot.html).toContain('discord-bridge-settings');
    expect(settingsRoot.statusNode.textContent).toBe('Plugin reachable');
  });

  test('does not mount when SillyTavern extension settings container is unavailable', async () => {
    const result = await mountSettingsPanelInExtensionsMenu({
      documentRef: new FakeDocument(null),
      renderTemplate: async () => '<section id="discord-bridge-settings"><p data-status></p></section>',
      fetchStatus: async () => ({ ok: true }),
    });

    expect(result).toBe('missing-container');
  });

  test('falls back to built-in template when SillyTavern template loading fails', async () => {
    const settingsRoot = new FakeElement();

    await mountSettingsPanelInExtensionsMenu({
      documentRef: new FakeDocument(settingsRoot),
      renderTemplate: async () => {
        throw new Error('404 Not Found');
      },
      fetchStatus: async () => ({ ok: false }),
    });

    expect(settingsRoot.html).toContain('discord-bridge-settings');
    expect(settingsRoot.html).toContain('inline-drawer');
    expect(settingsRoot.statusNode.textContent).toBe('Plugin unavailable');
  });
});
