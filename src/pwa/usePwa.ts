import { useCallback, useEffect, useRef, useState } from "react";
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function usePwa(busy: boolean) {
  const activity = useRef(busy);
  activity.current = busy;
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [offline, setOffline] = useState("正在检查离线资源");
  const [waiting, setWaiting] = useState(false);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [standalone, setStandalone] = useState(
    matchMedia("(display-mode: standalone)").matches,
  );
  const check = useCallback(async (repair = false) => {
    if (!("serviceWorker" in navigator)) {
      setOffline("浏览器不支持离线缓存，可联网使用");
      return;
    }
    const controller = navigator.serviceWorker.controller;
    if (!controller) {
      setOffline("离线尚未就绪，请联网完成准备");
      return;
    }
    setOffline(repair ? "正在准备离线资源" : "正在检查离线资源");
    const result = await new Promise<{ ready: boolean }>((resolve) => {
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => resolve({ ready: false }), 10000);
      channel.port1.onmessage = (event) => {
        clearTimeout(timeout);
        channel.port1.close();
        resolve(event.data);
      };
      controller.postMessage(
        { type: repair ? "REPAIR_OFFLINE" : "CHECK_OFFLINE" },
        [channel.port2],
      );
    });
    setOffline(result.ready ? "离线就绪" : "离线尚未就绪，请联网重试");
  }, []);
  useEffect(() => {
    const network = () => setOnline(navigator.onLine);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    const prompt = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", prompt);
    const installed = () => {
      setInstall(null);
      setStandalone(true);
    };
    window.addEventListener("appinstalled", installed);
    if (!("serviceWorker" in navigator)) {
      setOffline("浏览器不支持离线缓存，可联网使用");
      return () => {
        window.removeEventListener("online", network);
        window.removeEventListener("offline", network);
        window.removeEventListener("beforeinstallprompt", prompt);
        window.removeEventListener("appinstalled", installed);
      };
    }
    let active = true;
    let refreshing = false;
    const changed = () => {
      if (refreshing) location.reload();
      else void check();
    };
    const message = (event: MessageEvent) => {
      if (
        !event.source ||
        !("scriptURL" in event.source) ||
        new URL((event.source as ServiceWorker).scriptURL).pathname !==
          `${import.meta.env.BASE_URL}sw.js`
      )
        return;
      if (event.data?.type === "ACTIVITY_REQUEST") {
        const locallyBusy =
          activity.current ||
          document.querySelector("input:focus,textarea:focus") != null;
        event.source?.postMessage({
          type: "ACTIVITY_REPLY",
          requestId: event.data.requestId,
          busy: locallyBusy,
        });
      }
      if (event.data?.type === "UPDATE_RESULT") {
        if (event.data.safe) refreshing = true;
        else setOffline("更新已延后：请先保存所有页面中的编辑和测量");
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", changed);
    navigator.serviceWorker.addEventListener("message", message);
    void navigator.serviceWorker
      .getRegistration(import.meta.env.BASE_URL)
      .then(
        (existing) =>
          existing ||
          navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
            scope: import.meta.env.BASE_URL,
          }),
      )
      .then((reg) => {
        if (!active) return;
        setRegistration(reg);
        setWaiting(!!reg.waiting);
        if (navigator.onLine) void reg.update().catch(() => {});
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed") {
              if (navigator.serviceWorker.controller) setWaiting(true);
              else void check();
            }
          });
        });
        void check();
      })
      .catch(() => {
        if (navigator.serviceWorker.controller) void check();
        else setOffline("离线注册失败，请联网重试");
      });
    return () => {
      active = false;
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      window.removeEventListener("beforeinstallprompt", prompt);
      window.removeEventListener("appinstalled", installed);
      navigator.serviceWorker.removeEventListener("controllerchange", changed);
      navigator.serviceWorker.removeEventListener("message", message);
    };
  }, [check]);
  const update = () => {
    if (activity.current) {
      setOffline("更新已延后：请先保存编辑或停止测量");
      return;
    }
    registration?.waiting?.postMessage({ type: "ACTIVATE_REQUEST" });
  };
  const prepare = async () => {
    if (!navigator.onLine) {
      setOffline("当前离线，请联网准备资源");
      return;
    }
    try {
      if (!registration?.active && !registration?.installing) {
        const reg = await navigator.serviceWorker.register(
          `${import.meta.env.BASE_URL}sw.js`,
          { scope: import.meta.env.BASE_URL },
        );
        setRegistration(reg);
      } else await registration.update();
      await check(true);
    } catch {
      setOffline("离线准备失败，请联网重试");
    }
  };
  return {
    offline,
    waiting,
    online,
    standalone,
    prepare,
    update,
    install: install
      ? async () => {
          await install.prompt();
          await install.userChoice;
          setInstall(null);
        }
      : null,
  };
}
