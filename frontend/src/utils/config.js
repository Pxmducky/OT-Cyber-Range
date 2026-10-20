/**
 * config.js — Base de API/WebSocket + sesión aislada por participante.
 *
 *  · API_URL/WS_URL: en dev apuntan al backend local; en producción usan el
 *    mismo origen (relativo), así funciona detrás de Cloudflare sin tocar código.
 *  · SID: id único por navegador. Se envía como cabecera X-Session-Id en TODAS
 *    las llamadas a /api (vía un interceptor global de fetch) y como ?sid= en el
 *    WebSocket. Así cada participante tiene su propia planta aislada en el backend.
 *
 *  IMPORTANTE: importa este archivo lo antes posible (en src/main.jsx) para que
 *  el interceptor de fetch quede instalado antes de cualquier petición.
 */
const PROD = import.meta.env.PROD;

export const API_URL = PROD ? "" : "http://127.0.0.1:8000";

export const WS_URL = (() => {
  if (!PROD) return "ws://127.0.0.1:8000";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}`;
})();

/* ── Id de sesión persistente por navegador ── */
function getSid() {
  try {
    let s = localStorage.getItem("ot_sid");
    if (!s) {
      s = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("ot_sid", s);
    }
    return s;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}
export const SID = getSid();

/* ── Interceptor global: añade X-Session-Id a toda llamada a /api ── */
if (typeof window !== "undefined" && !window.__otFetchPatched) {
  window.__otFetchPatched = true;
  const _fetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const isApi = url.includes("/api/") || (API_URL && url.startsWith(API_URL));
    if (isApi) {
      const headers = new Headers(
        (init && init.headers) ||
        (typeof input !== "string" && input && input.headers) ||
        {}
      );
      headers.set("X-Session-Id", SID);
      init = { ...init, headers };
    }
    return _fetch(input, init);
  };
}