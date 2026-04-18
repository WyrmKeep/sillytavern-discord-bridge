import { fetchBridgeStatus } from './api.js';

type StatusNode = {
  textContent: string | null;
};

type SettingsPanelContainer = {
  insertAdjacentHTML(position: InsertPosition, html: string): void;
  querySelector(selector: string): StatusNode | null;
};

type SettingsDocument = {
  getElementById(id: string): SettingsPanelContainer | null;
};

type BridgeStatus = Awaited<ReturnType<typeof fetchBridgeStatus>>;

type SettingsPanelOptions = {
  fetchStatus?: () => Promise<BridgeStatus>;
  renderTemplate?: () => Promise<string | undefined>;
};

type MenuMountOptions = SettingsPanelOptions & {
  documentRef?: SettingsDocument;
};

export type SettingsPanelMountResult = 'mounted' | 'missing-container';

const SETTINGS_CONTAINER_ID = 'extensions_settings2';

export async function mountSettingsPanelInExtensionsMenu(
  options: MenuMountOptions = {},
): Promise<SettingsPanelMountResult> {
  const documentRef = options.documentRef ?? globalThis.document;
  const container = documentRef?.getElementById(SETTINGS_CONTAINER_ID) ?? null;
  if (!container) {
    return 'missing-container';
  }

  await mountSettingsPanel(container, options);
  return 'mounted';
}

export async function mountSettingsPanel(
  container: SettingsPanelContainer,
  options: SettingsPanelOptions = {},
): Promise<void> {
  const template = await renderSettingsTemplate(options.renderTemplate).catch(() => undefined);

  container.insertAdjacentHTML('beforeend', template ?? fallbackSettingsTemplate());
  const status = await (options.fetchStatus ?? fetchBridgeStatus)().catch(() => ({ ok: false }));
  const statusNode = container.querySelector('[data-status]');
  if (statusNode) {
    statusNode.textContent = status.ok ? 'Plugin reachable' : 'Plugin unavailable';
  }
}

async function renderSettingsTemplate(
  renderTemplate: SettingsPanelOptions['renderTemplate'],
): Promise<string | undefined> {
  if (renderTemplate) {
    return renderTemplate();
  }

  return undefined;
}

function fallbackSettingsTemplate(): string {
  return `
    <div id="discord-bridge-settings" class="discord-bridge-settings">
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>Discord Bridge</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <div class="discord-bridge-row">
            <span>Server plugin</span>
            <span data-status>Checking status...</span>
          </div>
        </div>
      </div>
    </div>
  `;
}
