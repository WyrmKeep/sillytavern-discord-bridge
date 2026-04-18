async function F() {
  const e = await fetch("/api/plugins/discord-bridge/status");
  if (!e.ok)
    throw new Error(`Bridge status failed: ${e.status}`);
  return await e.json();
}
async function U() {
  const e = await fetch("/api/plugins/discord-bridge/config");
  if (!e.ok)
    throw new Error(`Bridge config failed: ${e.status}`);
  return f(await e.json());
}
async function S(e) {
  const t = await fetch("/api/plugins/discord-bridge/config", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ config: e })
  });
  if (!t.ok)
    throw new Error(await v(t, "Bridge config save failed"));
  return f(await t.json());
}
async function k(e) {
  const t = await fetch("/api/plugins/discord-bridge/secrets", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(e)
  });
  if (!t.ok)
    throw new Error(await v(t, "Bridge secrets save failed"));
  return f(await t.json());
}
function f(e) {
  if (typeof e != "object" || e === null || !("config" in e) || typeof e.config != "object" || e.config === null)
    throw new Error("Server plugin needs update: /config did not return bridge settings.");
  return e;
}
async function v(e, t) {
  try {
    const a = await e.json();
    if (typeof a.reason == "string" && a.reason)
      return a.reason;
  } catch {
  }
  return `${t}: ${e.status}`;
}
function I(e) {
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
function x(e, t) {
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
const B = "extensions_settings2";
async function D(e = {}) {
  const t = e.documentRef ?? globalThis.document, a = (t == null ? void 0 : t.getElementById(B)) ?? null;
  return a ? (await E(a, e), "mounted") : "missing-container";
}
async function E(e, t = {}) {
  const a = await j(t.renderTemplate).catch(() => {
  });
  e.insertAdjacentHTML("beforeend", a ?? A());
  const n = await (t.fetchStatus ?? F)().catch(() => ({ ok: !1 })), d = e.querySelector("[data-status]");
  d && (d.textContent = n.ok ? "Plugin reachable" : "Plugin unavailable"), H(e, t);
}
async function j(e) {
  if (e)
    return e();
}
function A() {
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
          <form class="discord-bridge-form" data-config-form>
            <label>
              <input type="checkbox" data-field="enabled" />
              Enable Discord bridge
            </label>
            <label>
              SillyTavern user handle
              <input type="text" data-field="sillyTavernUserHandle" autocomplete="off" />
            </label>
            <label>
              Discord client ID
              <input type="text" data-field="clientId" autocomplete="off" />
            </label>
            <label>
              Discord guild ID
              <input type="text" data-field="guildId" autocomplete="off" />
            </label>
            <label>
              Discord forum channel ID
              <input type="text" data-field="forumChannelId" autocomplete="off" />
            </label>
            <label>
              Required/default forum tag IDs
              <textarea data-field="defaultForumTagIds" rows="2"></textarea>
            </label>
            <label>
              Allowed Discord user IDs
              <textarea data-field="allowlistedUserIds" rows="2"></textarea>
            </label>
            <label>
              Admin Discord user IDs
              <textarea data-field="adminUserIds" rows="2"></textarea>
            </label>
            <label>
              Default character avatar file
              <input type="text" data-field="defaultCharacterAvatarFile" autocomplete="off" />
            </label>
            <label>
              Conversation title format
              <input type="text" data-field="conversationTitleFormat" autocomplete="off" />
            </label>
            <label>
              Discord bot token
              <input type="password" data-field="discordBotToken" autocomplete="new-password" placeholder="Leave blank to keep existing token" />
            </label>
            <div class="discord-bridge-actions">
              <button type="submit" class="menu_button">Save</button>
              <span data-config-status>Loading config...</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}
function H(e, t) {
  const a = e.querySelector("[data-config-form]"), n = e.querySelector("[data-config-status]");
  if (!a)
    return;
  let d;
  const w = t.fetchConfig ?? U, T = t.saveConfig ?? S, y = t.saveSecrets ?? k;
  w().then((s) => {
    d = s.config, b(a, I(s.config)), i(a, "discordBotToken", ""), o(n, `Token ${s.secrets.discordBotToken ?? "<missing>"}`);
  }).catch((s) => {
    o(n, p(s));
  }), a.addEventListener("submit", (s) => {
    if (s.preventDefault(), !d) {
      o(n, "Config not loaded");
      return;
    }
    (async () => {
      try {
        o(n, "Saving...");
        const c = x(d, L(a)), C = await T(c), g = r(a, "discordBotToken").trim(), m = g ? await y({ discordBotToken: g }) : C;
        d = m.config, b(a, I(m.config)), i(a, "discordBotToken", ""), o(n, "Saved");
      } catch (c) {
        o(n, p(c));
      }
    })();
  });
}
function b(e, t) {
  M(e, "enabled", t.enabled), i(e, "sillyTavernUserHandle", t.sillyTavernUserHandle), i(e, "clientId", t.clientId), i(e, "guildId", t.guildId), i(e, "forumChannelId", t.forumChannelId), i(e, "defaultForumTagIds", t.defaultForumTagIds), i(e, "allowlistedUserIds", t.allowlistedUserIds), i(e, "adminUserIds", t.adminUserIds), i(e, "defaultCharacterAvatarFile", t.defaultCharacterAvatarFile), i(e, "conversationTitleFormat", t.conversationTitleFormat);
}
function L(e) {
  return {
    enabled: P(e, "enabled"),
    sillyTavernUserHandle: r(e, "sillyTavernUserHandle"),
    clientId: r(e, "clientId"),
    guildId: r(e, "guildId"),
    forumChannelId: r(e, "forumChannelId"),
    defaultForumTagIds: r(e, "defaultForumTagIds"),
    allowlistedUserIds: r(e, "allowlistedUserIds"),
    adminUserIds: r(e, "adminUserIds"),
    defaultCharacterAvatarFile: r(e, "defaultCharacterAvatarFile"),
    conversationTitleFormat: r(e, "conversationTitleFormat")
  };
}
function l(e, t) {
  return e.querySelector(`[data-field="${t}"]`);
}
function r(e, t) {
  var a;
  return ((a = l(e, t)) == null ? void 0 : a.value) ?? "";
}
function i(e, t, a) {
  const n = l(e, t);
  n && (n.value = a);
}
function P(e, t) {
  const a = l(e, t);
  return a instanceof HTMLInputElement ? a.checked : !1;
}
function M(e, t, a) {
  const n = l(e, t);
  n instanceof HTMLInputElement && (n.checked = a);
}
function o(e, t) {
  e && (e.textContent = t);
}
function p(e) {
  return e instanceof Error ? e.message : "Config unavailable";
}
function h() {
  D();
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", h, { once: !0 }) : h();
