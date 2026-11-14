// The only place the service worker is registered. Refuses dev, iframes and Lovable previews.
const PREVIEW_LABEL = /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/;

function refused(): boolean {
  if (!import.meta.env.PROD) return true;
  if (window.self !== window.top) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  const h = window.location.hostname.toLowerCase();
  const label = h.split(".")[0] ?? "";
  for (const d of ["lovable.app", "gpt-eng.com", "gptengineer.run"]) {
    if (h.endsWith(`.${d}`) && (PREVIEW_LABEL.test(label) || /^project--.+-dev$/.test(label))) return true;
  }
  for (const d of ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"]) {
    if (h === d || h.endsWith(`.${d}`)) return true;
  }
  return false;
}

export async function setupServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (refused()) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()),
    );
    return;
  }
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
}
