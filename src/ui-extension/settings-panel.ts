import {
  fetchBridgeConfig,
  fetchBridgeStatus,
  saveBridgeConfig,
  saveBridgeSecrets,
  type BridgeConfig,
  type BridgeConfigPayload,
} from './api.js';
import {
  configToFormValues,
  formValuesToConfig,
  type SettingsFormValues,
} from './settings-form.js';

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
  fetchConfig?: () => Promise<BridgeConfigPayload>;
  saveConfig?: (config: BridgeConfig) => Promise<BridgeConfigPayload>;
  saveSecrets?: (input: { discordBotToken?: string }) => Promise<BridgeConfigPayload>;
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

  bindSettingsForm(container, options);
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
          <form class="discord-bridge-form" data-config-form onsubmit="return false">
            <div class="discord-bridge-checkbox">
              <input type="checkbox" data-field="enabled" />
              <label>Enable Discord bridge</label>
            </div>
            <div class="discord-bridge-field">
              <label class="discord-bridge-field-label">SillyTavern user handle</label>
              <input type="text" data-field="sillyTavernUserHandle" autocomplete="off" />
            </div>
            <div class="discord-bridge-field">
              <label class="discord-bridge-field-label">Discord client ID</label>
              <input type="text" data-field="clientId" autocomplete="off" />
            </div>
            <div class="discord-bridge-field">
              <label class="discord-bridge-field-label">Discord guild ID</label>
              <input type="text" data-field="guildId" autocomplete="off" />
            </div>
            <div class="discord-bridge-field">
              <label class="discord-bridge-field-label">Discord forum channel ID</label>
              <input type="text" data-field="forumChannelId" autocomplete="off" />
            </div>
            <div class="discord-bridge-field">
              <label class="discord-bridge-field-label">Required/default forum tag IDs</label>
              <textarea data-field="defaultForumTagIds" rows="2"></textarea>
            </div>
            <div class="discord-bridge-field">
              <label class="discord-bridge-field-label">Allowed Discord user IDs</label>
              <textarea data-field="allowlistedUserIds" rows="2"></textarea>
            </div>
            <div class="discord-bridge-field">
              <label class="discord-bridge-field-label">Admin Discord user IDs</label>
              <textarea data-field="adminUserIds" rows="2"></textarea>
            </div>
            <div class="discord-bridge-field">
              <label class="discord-bridge-field-label">Default character avatar file</label>
              <input type="text" data-field="defaultCharacterAvatarFile" autocomplete="off" />
            </div>
            <div class="discord-bridge-field">
              <label class="discord-bridge-field-label">Conversation title format</label>
              <input type="text" data-field="conversationTitleFormat" autocomplete="off" />
            </div>
            <div class="discord-bridge-field">
              <label class="discord-bridge-field-label">Discord bot token</label>
              <input type="password" data-field="discordBotToken" autocomplete="new-password" placeholder="Leave blank to keep existing token" />
            </div>
            <div class="discord-bridge-actions">
              <button type="button" class="menu_button" data-save-config>Save</button>
              <span data-config-status>Loading config...</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

function bindSettingsForm(
  container: SettingsPanelContainer,
  options: SettingsPanelOptions,
): void {
  const form = container.querySelector('[data-config-form]') as HTMLFormElement | null;
  const status = container.querySelector('[data-config-status]');
  if (!form) {
    return;
  }
  const saveButton = form.querySelector('[data-save-config]') as HTMLButtonElement | null;

  let currentConfig: BridgeConfig | undefined;
  const fetchConfig = options.fetchConfig ?? fetchBridgeConfig;
  const saveConfig = options.saveConfig ?? saveBridgeConfig;
  const saveSecrets = options.saveSecrets ?? saveBridgeSecrets;

  void fetchConfig()
    .then((payload) => {
      currentConfig = payload.config;
      populateForm(form, configToFormValues(payload.config));
      setInputValue(form, 'discordBotToken', '');
      setStatus(status, `Token ${payload.secrets.discordBotToken ?? '<missing>'}`);
    })
    .catch((error: unknown) => {
      setStatus(status, errorMessage(error));
    });

  const saveCurrentConfig = (): void => {
    if (!currentConfig) {
      setStatus(status, 'Config not loaded');
      return;
    }

    void (async () => {
      try {
        setStatus(status, 'Saving...');
        const nextConfig = formValuesToConfig(currentConfig, readFormValues(form));
        const saved = await saveConfig(nextConfig);
        const token = getInputValue(form, 'discordBotToken').trim();
        const finalPayload = token ? await saveSecrets({ discordBotToken: token }) : saved;
        currentConfig = finalPayload.config;
        populateForm(form, configToFormValues(finalPayload.config));
        setInputValue(form, 'discordBotToken', '');
        setStatus(status, 'Saved');
      } catch (error) {
        setStatus(status, errorMessage(error));
      }
    })();
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    saveCurrentConfig();
  });

  saveButton?.addEventListener('click', () => {
    saveCurrentConfig();
  });
}

function populateForm(form: HTMLFormElement, values: SettingsFormValues): void {
  setCheckedValue(form, 'enabled', values.enabled);
  setInputValue(form, 'sillyTavernUserHandle', values.sillyTavernUserHandle);
  setInputValue(form, 'clientId', values.clientId);
  setInputValue(form, 'guildId', values.guildId);
  setInputValue(form, 'forumChannelId', values.forumChannelId);
  setInputValue(form, 'defaultForumTagIds', values.defaultForumTagIds);
  setInputValue(form, 'allowlistedUserIds', values.allowlistedUserIds);
  setInputValue(form, 'adminUserIds', values.adminUserIds);
  setInputValue(form, 'defaultCharacterAvatarFile', values.defaultCharacterAvatarFile);
  setInputValue(form, 'conversationTitleFormat', values.conversationTitleFormat);
}

function readFormValues(form: HTMLFormElement): SettingsFormValues {
  return {
    enabled: getCheckedValue(form, 'enabled'),
    sillyTavernUserHandle: getInputValue(form, 'sillyTavernUserHandle'),
    clientId: getInputValue(form, 'clientId'),
    guildId: getInputValue(form, 'guildId'),
    forumChannelId: getInputValue(form, 'forumChannelId'),
    defaultForumTagIds: getInputValue(form, 'defaultForumTagIds'),
    allowlistedUserIds: getInputValue(form, 'allowlistedUserIds'),
    adminUserIds: getInputValue(form, 'adminUserIds'),
    defaultCharacterAvatarFile: getInputValue(form, 'defaultCharacterAvatarFile'),
    conversationTitleFormat: getInputValue(form, 'conversationTitleFormat'),
  };
}

function getField(form: HTMLFormElement, field: string): HTMLInputElement | HTMLTextAreaElement | null {
  return form.querySelector(`[data-field="${field}"]`);
}

function getInputValue(form: HTMLFormElement, field: string): string {
  return getField(form, field)?.value ?? '';
}

function setInputValue(form: HTMLFormElement, field: string, value: string): void {
  const input = getField(form, field);
  if (input) {
    input.value = value;
  }
}

function getCheckedValue(form: HTMLFormElement, field: string): boolean {
  const input = getField(form, field);
  return input instanceof HTMLInputElement ? input.checked : false;
}

function setCheckedValue(form: HTMLFormElement, field: string, value: boolean): void {
  const input = getField(form, field);
  if (input instanceof HTMLInputElement) {
    input.checked = value;
  }
}

function setStatus(status: StatusNode | null, text: string): void {
  if (status) {
    status.textContent = text;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Config unavailable';
}
