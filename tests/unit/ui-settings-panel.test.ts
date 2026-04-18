import { afterEach, describe, expect, test, vi } from 'vitest';
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  test('uses built-in template by default without requesting a SillyTavern template file', async () => {
    const settingsRoot = new FakeElement();
    const renderExtensionTemplateAsync = vi.fn(async () => {
      throw new Error('should not be called');
    });

    vi.stubGlobal('window', {
      SillyTavern: {
        getContext: () => ({ renderExtensionTemplateAsync }),
      },
    });

    await mountSettingsPanelInExtensionsMenu({
      documentRef: new FakeDocument(settingsRoot),
      fetchStatus: async () => ({ ok: false }),
    });

    expect(renderExtensionTemplateAsync).not.toHaveBeenCalled();
    expect(settingsRoot.html).toContain('discord-bridge-settings');
  });

  test('renders non-submitting settings form markup', async () => {
    const settingsRoot = new FakeElement();

    await mountSettingsPanelInExtensionsMenu({
      documentRef: new FakeDocument(settingsRoot),
      fetchStatus: async () => ({ ok: false }),
    });

    expect(settingsRoot.html).toContain('onsubmit="return false"');
    expect(settingsRoot.html).toContain('data-save-config');
    expect(settingsRoot.html).toContain('type="button"');
    expect(settingsRoot.html).not.toContain('type="submit"');
    expect(settingsRoot.html).toContain('discord-bridge-field');
    expect(settingsRoot.html).toContain('data-st-settings-status');
    expect(settingsRoot.html).toContain('data-field="sillyTavernPresetName"');
    expect(settingsRoot.html).toContain('data-field="exposedCharacterTags"');
    expect(settingsRoot.html).toContain('data-field="maxHistoryMessages"');
    expect(settingsRoot.html).toContain('data-field="contextBudgetTokens"');
    expect(settingsRoot.html).toContain('data-field="maxReplyCharacters"');
    expect(settingsRoot.html).toContain('data-field="profilesJson"');
  });
});
