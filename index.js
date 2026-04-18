async function U() {
  const e = await fetch("/api/plugins/discord-bridge/status");
  if (!e.ok)
    throw new Error(`Bridge status failed: ${e.status}`);
  return await e.json();
}
async function k() {
  const e = await fetch("/api/plugins/discord-bridge/config");
  if (!e.ok)
    throw new Error(`Bridge config failed: ${e.status}`);
  return f(await e.json());
}
async function x(e) {
  const t = await fetch("/api/plugins/discord-bridge/config", {
    method: "PUT",
    headers: await w(),
    body: JSON.stringify({ config: e })
  });
  if (!t.ok)
    throw new Error(await y(t, "Bridge config save failed"));
  return f(await t.json());
}
async function H(e) {
  const t = await fetch("/api/plugins/discord-bridge/secrets", {
    method: "PUT",
    headers: await w(),
    body: JSON.stringify(e)
  });
  if (!t.ok)
    throw new Error(await y(t, "Bridge secrets save failed"));
  return f(await t.json());
}
function f(e) {
  if (typeof e != "object" || e === null || !("config" in e) || typeof e.config != "object" || e.config === null)
    throw new Error("Server plugin needs update: /config did not return bridge settings.");
  return e;
}
async function w() {
  const e = new Headers(await D());
  return e.set("content-type", "application/json"), e;
}
async function D() {
  const e = globalThis.getRequestHeaders;
  if (typeof e == "function")
    return e();
  try {
    const a = await import("../../../../script.js");
    return typeof a.getRequestHeaders == "function" ? a.getRequestHeaders() : {};
  } catch {
    return {};
  }
}
async function y(e, t) {
  try {
    const a = await e.json();
    if (typeof a.reason == "string" && a.reason)
      return a.reason;
  } catch {
  }
  return `${t}: ${e.status}`;
}
function m(e) {
  return {
    enabled: e.enabled,
    sillyTavernUserHandle: e.sillyTavernUserHandle,
    clientId: e.discord.clientId,
    guildId: e.discord.guildId,
    forumChannelId: e.discord.forumChannelId,
    defaultForumTagIds: e.discord.defaultForumTagIds.join(", "),
    allowlistedUserIds: e.access.allowlistedUserIds.join(", "),
    adminUserIds: e.access.adminUserIds.join(", "),
    defaultCharacterAvatarFile: e.defaults.defaultCharacterAvatarFile,
    conversationTitleFormat: e.behavior.conversationTitleFormat
  };
}
function B(e, t) {
  return {
    ...e,
    enabled: t.enabled,
    sillyTavernUserHandle: t.sillyTavernUserHandle.trim(),
    discord: {
      ...e.discord,
      clientId: t.clientId.trim(),
      guildId: t.guildId.trim(),
      forumChannelId: t.forumChannelId.trim(),
      defaultForumTagIds: u(t.defaultForumTagIds)
    },
    access: {
      ...e.access,
      allowlistedUserIds: u(t.allowlistedUserIds),
      adminUserIds: u(t.adminUserIds)
    },
    defaults: {
      ...e.defaults,
      defaultCharacterAvatarFile: t.defaultCharacterAvatarFile.trim()
    },
    behavior: {
      ...e.behavior,
      conversationTitleFormat: t.conversationTitleFormat.trim() || "{{character}} - {{date}}"
    }
  };
}
function u(e) {
  return [
    ...new Set(
      e.split(/[\s,]+/u).map((t) => t.trim()).filter(Boolean)
    )
  ];
}
const E = "extensions_settings2";
async function j(e = {}) {
  const t = e.documentRef ?? globalThis.document, a = (t == null ? void 0 : t.getElementById(E)) ?? null;
  return a ? (await A(a, e), "mounted") : "missing-container";
}
async function A(e, t = {}) {
  const a = await q(t.renderTemplate).catch(() => {
  });
  e.insertAdjacentHTML("beforeend", a ?? P());
  const i = await (t.fetchStatus ?? U)().catch(() => ({ ok: !1 })), r = e.querySelector("[data-status]");
  r && (r.textContent = i.ok ? "Plugin reachable" : "Plugin unavailable"), L(e, t);
}
async function q(e) {
  if (e)
    return e();
}
function P() {
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
function L(e, t) {
  const a = e.querySelector("[data-config-form]"), i = e.querySelector("[data-config-status]");
  if (!a)
    return;
  const r = a.querySelector("[data-save-config]");
  let o;
  const T = t.fetchConfig ?? k, C = t.saveConfig ?? x, F = t.saveSecrets ?? H;
  T().then((d) => {
    o = d.config, I(a, m(d.config)), n(a, "discordBotToken", ""), l(i, `Token ${d.secrets.discordBotToken ?? "<missing>"}`);
  }).catch((d) => {
    l(i, p(d));
  });
  const g = () => {
    if (!o) {
      l(i, "Config not loaded");
      return;
    }
    (async () => {
      try {
        l(i, "Saving...");
        const d = B(o, M(a)), S = await C(d), b = s(a, "discordBotToken").trim(), v = b ? await F({ discordBotToken: b }) : S;
        o = v.config, I(a, m(v.config)), n(a, "discordBotToken", ""), l(i, "Saved");
      } catch (d) {
        l(i, p(d));
      }
    })();
  };
  a.addEventListener("submit", (d) => {
    d.preventDefault(), g();
  }), r == null || r.addEventListener("click", () => {
    g();
  });
}
function I(e, t) {
  V(e, "enabled", t.enabled), n(e, "sillyTavernUserHandle", t.sillyTavernUserHandle), n(e, "clientId", t.clientId), n(e, "guildId", t.guildId), n(e, "forumChannelId", t.forumChannelId), n(e, "defaultForumTagIds", t.defaultForumTagIds), n(e, "allowlistedUserIds", t.allowlistedUserIds), n(e, "adminUserIds", t.adminUserIds), n(e, "defaultCharacterAvatarFile", t.defaultCharacterAvatarFile), n(e, "conversationTitleFormat", t.conversationTitleFormat);
}
function M(e) {
  return {
    enabled: R(e, "enabled"),
    sillyTavernUserHandle: s(e, "sillyTavernUserHandle"),
    clientId: s(e, "clientId"),
    guildId: s(e, "guildId"),
    forumChannelId: s(e, "forumChannelId"),
    defaultForumTagIds: s(e, "defaultForumTagIds"),
    allowlistedUserIds: s(e, "allowlistedUserIds"),
    adminUserIds: s(e, "adminUserIds"),
    defaultCharacterAvatarFile: s(e, "defaultCharacterAvatarFile"),
    conversationTitleFormat: s(e, "conversationTitleFormat")
  };
}
function c(e, t) {
  return e.querySelector(`[data-field="${t}"]`);
}
function s(e, t) {
  var a;
  return ((a = c(e, t)) == null ? void 0 : a.value) ?? "";
}
function n(e, t, a) {
  const i = c(e, t);
  i && (i.value = a);
}
function R(e, t) {
  const a = c(e, t);
  return a instanceof HTMLInputElement ? a.checked : !1;
}
function V(e, t, a) {
  const i = c(e, t);
  i instanceof HTMLInputElement && (i.checked = a);
}
function l(e, t) {
  e && (e.textContent = t);
}
function p(e) {
  return e instanceof Error ? e.message : "Config unavailable";
}
function h() {
  j();
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", h, { once: !0 }) : h();
