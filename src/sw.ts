/// <reference lib="webworker" />
import { clientsClaim, setCacheNameDetails, cacheNames } from "workbox-core";
import {
  addPlugins,
  precacheAndRoute,
  getCacheKeyForURL,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision?: string | null }>;
};
const scope = new URL(self.registration.scope).pathname;
const prefix = `fengshui:${scope}`;
setCacheNameDetails({ prefix, suffix: __BUILD_REVISION__ });
const resources = self.__WB_MANIFEST;
function validResource(url: string, response: Response) {
  if (!response.ok) return false;
  const path = new URL(url).pathname;
  const type = (response.headers.get("content-type") || "").toLowerCase();
  if (path.endsWith(".js")) return type.includes("javascript");
  if (path.endsWith(".css")) return type.includes("text/css");
  if (path.endsWith(".html")) return type.includes("text/html");
  if (path.endsWith(".png")) return type.includes("image/png");
  if (path.endsWith(".svg")) return type.includes("image/svg+xml");
  if (path.endsWith(".webmanifest")) return type.includes("json");
  return false;
}
addPlugins([
  {
    cacheWillUpdate: async ({ request, response }) =>
      validResource(request.url, response) ? response : null,
  },
]);
precacheAndRoute(resources);
clientsClaim();
const escaped = scope.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), {
    allowlist: [new RegExp(`^${escaped}`)],
  }),
);
async function inspect() {
  const cache = await caches.open(cacheNames.precache);
  let complete = resources.length > 0;
  for (const resource of resources) {
    const url = new URL(
      typeof resource === "string" ? resource : resource.url,
      self.registration.scope,
    ).href;
    const key = getCacheKeyForURL(url);
    const cached = key ? await cache.match(key) : undefined;
    if (!cached || !validResource(url, cached)) complete = false;
  }
  return complete;
}
async function repair() {
  const cache = await caches.open(cacheNames.precache);
  for (const resource of resources) {
    const url = new URL(
      typeof resource === "string" ? resource : resource.url,
      self.registration.scope,
    );
    if (!url.href.startsWith(self.registration.scope))
      throw new Error("资源超出应用范围");
    const response = await fetch(url.href, { cache: "reload" });
    if (!validResource(url.href, response))
      throw new Error("离线资源下载失败或类型不正确");
    const key = getCacheKeyForURL(url.href);
    if (!key) throw new Error("资源不在清单中");
    await cache.put(key, response);
  }
  return inspect();
}
const votes = new Map<
  string,
  { pending: Set<string>; busy: boolean; resolve: (safe: boolean) => void }
>();
async function safeToActivate() {
  const windows = (
    await self.clients.matchAll({ type: "window", includeUncontrolled: true })
  ).filter((client) => client.url.startsWith(self.registration.scope));
  if (!windows.length) return true;
  const requestId = crypto.randomUUID();
  return new Promise<boolean>((resolve) => {
    const vote = {
      pending: new Set(windows.map((w) => w.id)),
      busy: false,
      resolve,
    };
    votes.set(requestId, vote);
    for (const client of windows)
      client.postMessage({ type: "ACTIVITY_REQUEST", requestId });
    setTimeout(() => {
      if (votes.has(requestId)) {
        votes.delete(requestId);
        resolve(false);
      }
    }, 2000);
  });
}
self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || typeof message.type !== "string") return;
  if (message.type === "ACTIVITY_REPLY") {
    const vote = votes.get(message.requestId);
    const source = event.source as Client | null;
    if (vote && source && vote.pending.delete(source.id)) {
      vote.busy ||= message.busy !== false;
      if (vote.pending.size === 0) {
        votes.delete(message.requestId);
        vote.resolve(!vote.busy);
      }
    }
    return;
  }
  if (message.type === "CHECK_OFFLINE" || message.type === "REPAIR_OFFLINE")
    event.waitUntil(
      (message.type === "REPAIR_OFFLINE" ? repair() : inspect())
        .then((ready) =>
          event.ports[0]?.postMessage({ ready, revision: __BUILD_REVISION__ }),
        )
        .catch(() =>
          event.ports[0]?.postMessage({
            ready: false,
            revision: __BUILD_REVISION__,
          }),
        ),
    );
  if (message.type === "ACTIVATE_REQUEST")
    event.waitUntil(
      safeToActivate().then(async (safe) => {
        if (safe) {
          for (const client of await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
          }))
            if (client.url.startsWith(self.registration.scope))
              client.postMessage({ type: "UPDATE_RESULT", safe: true });
          await self.skipWaiting();
        } else
          event.source?.postMessage({ type: "UPDATE_RESULT", safe: false });
      }),
    );
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      if (!(await inspect())) return;
      for (const name of await caches.keys())
        if (name.startsWith(prefix) && name !== cacheNames.precache)
          await caches.delete(name);
    })(),
  ),
);
