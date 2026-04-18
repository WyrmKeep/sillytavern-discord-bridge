async function r() {
  const e = await fetch("/api/plugins/discord-bridge/status");
  if (!e.ok)
    throw new Error(`Bridge status failed: ${e.status}`);
  return await e.json();
}
const o = "third-party/discord-bridge", c = "extensions_settings2";
async function l(e = {}) {
  const n = e.documentRef ?? globalThis.document, t = (n == null ? void 0 : n.getElementById(c)) ?? null;
  return t ? (await u(t, e), "mounted") : "missing-container";
}
async function u(e, n = {}) {
  const t = await g(n.renderTemplate).catch(() => {
  });
  e.insertAdjacentHTML("beforeend", t ?? f());
  const i = await (n.fetchStatus ?? r)().catch(() => ({ ok: !1 })), s = e.querySelector("[data-status]");
  s && (s.textContent = i.ok ? "Plugin reachable" : "Plugin unavailable");
}
async function g(e) {
  var t, i, s, a;
  if (e)
    return e();
  const n = (s = (i = (t = globalThis.window) == null ? void 0 : t.SillyTavern) == null ? void 0 : i.getContext) == null ? void 0 : s.call(i);
  return (a = n == null ? void 0 : n.renderExtensionTemplateAsync) == null ? void 0 : a.call(n, o, "settings");
}
function f() {
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
function d() {
  l();
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", d, { once: !0 }) : d();
