async function w() {
  const e = await fetch("/api/plugins/discord-bridge/status");
  if (!e.ok)
    throw new Error(`Bridge status failed: ${e.status}`);
  return await e.json();
}
async function y() {
  const e = await fetch("/api/plugins/discord-bridge/config");
  if (!e.ok)
    throw new Error(`Bridge config failed: ${e.status}`);
  return await e.json();
}
async function C(e) {
  const t = await fetch("/api/plugins/discord-bridge/config", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ config: e })
  });
  if (!t.ok)
    throw new Error(`Bridge config save failed: ${t.status}`);
  return await t.json();
}
async function F(e) {
  const t = await fetch("/api/plugins/discord-bridge/secrets", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(e)
  });
  if (!t.ok)
    throw new Error(`Bridge secrets save failed: ${t.status}`);
  return await t.json();
}
function g(e) {
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
function U(e, t) {
  return {
    ...e,
    enabled: t.enabled,
    sillyTavernUserHandle: t.sillyTavernUserHandle.trim(),
    discord: {
      ...e.discord,
      clientId: t.clientId.trim(),
      guildId: t.guildId.trim(),
      forumChannelId: t.forumChannelId.trim(),
      defaultForumTagIds: c(t.defaultForumTagIds)
    },
    access: {
      ...e.access,
      allowlistedUserIds: c(t.allowlistedUserIds),
      adminUserIds: c(t.adminUserIds)
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
function c(e) {
  return [
    ...new Set(
      e.split(/[\s,]+/u).map((t) => t.trim()).filter(Boolean)
    )
  ];
}
const S = "extensions_settings2";
async function k(e = {}) {
  const t = e.documentRef ?? globalThis.document, a = (t == null ? void 0 : t.getElementById(S)) ?? null;
  return a ? (await x(a, e), "mounted") : "missing-container";
}
async function x(e, t = {}) {
  const a = await D(t.renderTemplate).catch(() => {
  });
  e.insertAdjacentHTML("beforeend", a ?? B());
  const n = await (t.fetchStatus ?? w)().catch(() => ({ ok: !1 })), s = e.querySelector("[data-status]");
  s && (s.textContent = n.ok ? "Plugin reachable" : "Plugin unavailable"), A(e, t);
}
async function D(e) {
  if (e)
    return e();
}
function B() {
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
function A(e, t) {
  const a = e.querySelector("[data-config-form]"), n = e.querySelector("[data-config-status]");
  if (!a)
    return;
  let s;
  const b = t.fetchConfig ?? y, p = t.saveConfig ?? C, h = t.saveSecrets ?? F;
  b().then((l) => {
    s = l.config, m(a, g(l.config)), i(a, "discordBotToken", ""), r(n, `Token ${l.secrets.discordBotToken ?? "<missing>"}`);
  }).catch(() => {
    r(n, "Config unavailable");
  }), a.addEventListener("submit", (l) => {
    if (l.preventDefault(), !s) {
      r(n, "Config not loaded");
      return;
    }
    (async () => {
      try {
        r(n, "Saving...");
        const v = U(s, E(a)), T = await p(v), u = d(a, "discordBotToken").trim(), f = u ? await h({ discordBotToken: u }) : T;
        s = f.config, m(a, g(f.config)), i(a, "discordBotToken", ""), r(n, "Saved");
      } catch {
        r(n, "Save failed");
      }
    })();
  });
}
function m(e, t) {
  j(e, "enabled", t.enabled), i(e, "sillyTavernUserHandle", t.sillyTavernUserHandle), i(e, "clientId", t.clientId), i(e, "guildId", t.guildId), i(e, "forumChannelId", t.forumChannelId), i(e, "defaultForumTagIds", t.defaultForumTagIds), i(e, "allowlistedUserIds", t.allowlistedUserIds), i(e, "adminUserIds", t.adminUserIds), i(e, "defaultCharacterAvatarFile", t.defaultCharacterAvatarFile), i(e, "conversationTitleFormat", t.conversationTitleFormat);
}
function E(e) {
  return {
    enabled: H(e, "enabled"),
    sillyTavernUserHandle: d(e, "sillyTavernUserHandle"),
    clientId: d(e, "clientId"),
    guildId: d(e, "guildId"),
    forumChannelId: d(e, "forumChannelId"),
    defaultForumTagIds: d(e, "defaultForumTagIds"),
    allowlistedUserIds: d(e, "allowlistedUserIds"),
    adminUserIds: d(e, "adminUserIds"),
    defaultCharacterAvatarFile: d(e, "defaultCharacterAvatarFile"),
    conversationTitleFormat: d(e, "conversationTitleFormat")
  };
}
function o(e, t) {
  return e.querySelector(`[data-field="${t}"]`);
}
function d(e, t) {
  var a;
  return ((a = o(e, t)) == null ? void 0 : a.value) ?? "";
}
function i(e, t, a) {
  const n = o(e, t);
  n && (n.value = a);
}
function H(e, t) {
  const a = o(e, t);
  return a instanceof HTMLInputElement ? a.checked : !1;
}
function j(e, t, a) {
  const n = o(e, t);
  n instanceof HTMLInputElement && (n.checked = a);
}
function r(e, t) {
  e && (e.textContent = t);
}
function I() {
  k();
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", I, { once: !0 }) : I();
