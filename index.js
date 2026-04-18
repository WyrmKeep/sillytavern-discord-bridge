async function c() {
  const t = await fetch("/api/plugins/discord-bridge/status");
  if (!t.ok)
    throw new Error(`Bridge status failed: ${t.status}`);
  return await t.json();
}
async function u(t) {
  var e, a, n, o;
  (a = (e = window.SillyTavern) == null ? void 0 : e.getContext) == null || a.call(e);
  const d = await ((o = (n = window.SillyTavern) == null ? void 0 : n.renderExtensionTemplateAsync) == null ? void 0 : o.call(
    n,
    "third-party/discord-bridge",
    "settings"
  )) ?? '<section id="discord-bridge-settings"><h3>Discord Bridge</h3><p data-status></p></section>';
  t.insertAdjacentHTML("beforeend", d);
  const r = await c().catch(() => ({ ok: !1 })), s = t.querySelector("[data-status]");
  s && (s.textContent = r.ok ? "Plugin reachable" : "Plugin unavailable");
}
const i = document.createElement("div");
i.id = "discord-bridge-extension";
document.body.append(i);
u(i);
