async function d() {
  const t = await fetch("/api/plugins/discord-bridge/status");
  if (!t.ok)
    throw new Error(`Bridge status failed: ${t.status}`);
  return await t.json();
}
const r = "extensions_settings2";
async function c(t = {}) {
  const e = t.documentRef ?? globalThis.document, n = (e == null ? void 0 : e.getElementById(r)) ?? null;
  return n ? (await o(n, t), "mounted") : "missing-container";
}
async function o(t, e = {}) {
  const n = await l(e.renderTemplate).catch(() => {
  });
  t.insertAdjacentHTML("beforeend", n ?? u());
  const a = await (e.fetchStatus ?? d)().catch(() => ({ ok: !1 })), i = t.querySelector("[data-status]");
  i && (i.textContent = a.ok ? "Plugin reachable" : "Plugin unavailable");
}
async function l(t) {
  if (t)
    return t();
}
function u() {
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
function s() {
  c();
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", s, { once: !0 }) : s();
