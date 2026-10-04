import { usePwa } from "./pwa/usePwa";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useWorkspace } from "./storage/useWorkspace";
import { Icon } from "./components/Icon";
import { CompassPage } from "./features/compass/CompassPage";
import { ProjectsPage } from "./features/surveys/ProjectsPage";
import { KnowledgePage } from "./features/knowledge/KnowledgePage";
import { SettingsPage } from "./features/settings/SettingsPage";
import type { Project } from "./domain/model";
type Context = ReturnType<typeof useWorkspace> & {
  activity: (key: string, active: boolean) => void;
  busy: boolean;
  pwa: ReturnType<typeof usePwa>;
  selectedId: string;
  select: (id: string) => void;
  project: Project | undefined;
  notice: string;
  announce: (message: string) => void;
};
const WorkspaceContext = createContext<Context | null>(null);
export function useApp() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("工作区尚未初始化");
  return value;
}
export function useActivity(key: string, active: boolean) {
  const app = useApp();
  useEffect(() => {
    app.activity(key, active);
    return () => app.activity(key, false);
  }, [app.activity, key, active]);
}
export default function App() {
  const workspace = useWorkspace();
  const [activities, setActivities] = useState<Record<string, boolean>>({});
  const activity = useCallback(
    (key: string, active: boolean) =>
      setActivities((previous) =>
        previous[key] === active ? previous : { ...previous, [key]: active },
      ),
    [],
  );
  const busy =
    workspace.pending > 0 ||
    !!workspace.error ||
    Object.values(activities).some(Boolean);
  const pwa = usePwa(busy);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (busy) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [busy]);
  const [selectedId, select] = useState("");
  const [notice, announce] = useState("");
  const [route, setRoute] = useState(location.hash.slice(1) || "/compass");
  const [theme, setTheme] = useState("system");
  useEffect(() => {
    try {
      setTheme(
        localStorage.getItem(`fengshui:${import.meta.env.BASE_URL}:theme`) ||
          "system",
      );
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    const update = () => setRoute(location.hash.slice(1) || "/compass");
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const project =
    workspace.data.projects.find((p) => p.id === selectedId && !p.archivedAt) ||
    workspace.data.projects.find((p) => !p.archivedAt);
  const paths = [
    ["/compass", "罗盘", "compass"],
    ["/projects", "项目", "projects"],
    ["/knowledge", "资料", "knowledge"],
    ["/settings", "设置", "settings"],
  ];
  const context = {
    ...workspace,
    activity,
    busy,
    pwa,
    selectedId: project?.id || "",
    select,
    project,
    notice,
    announce,
  };
  function chooseTheme(next: string) {
    setTheme(next);
    try {
      localStorage.setItem(`fengshui:${import.meta.env.BASE_URL}:theme`, next);
    } catch {
      announce("主题已切换，偏好未能保存");
    }
  }
  return (
    <WorkspaceContext.Provider value={context}>
      <div className="app-shell">
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        <aside className="sidebar">
          <a className="brand" href="#/compass">
            <span className="brand-mark">
              <Icon name="compass" />
            </span>
            <span>
              堪舆手记<small>记录方位 · 复核坐向</small>
            </span>
          </a>
          <nav aria-label="主要导航">
            {paths.map(([path, label, icon]) => (
              <a
                key={path}
                href={`#${path}`}
                aria-current={route.startsWith(path) ? "page" : undefined}
              >
                <Icon name={icon} />
                <span>{label}</span>
              </a>
            ))}
          </nav>
          <div className="sidebar-foot">
            <span className="tiny-label">现场工具</span>
            <p>方位有据，记录有序。</p>
            <small>地盘正针 · 本地保存</small>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <a className="mobile-brand" href="#/compass">
              堪舆手记
            </a>
            <span className="desktop-title">专业现场堪舆</span>
            <div className="topbar-meta">
              <span
                className={`save-chip ${workspace.error ? "danger" : ""}`}
                title={workspace.status}
              >
                <span className="status-dot" />
                {workspace.pending
                  ? "保存中"
                  : workspace.mode === "memory"
                    ? "仅内存"
                    : workspace.mode === "readonly"
                      ? "只读"
                      : "本地记录"}
              </span>
              <button
                className="icon-button"
                aria-label={theme === "dark" ? "切换瓷白主题" : "切换墨黑主题"}
                onClick={() => chooseTheme(theme === "dark" ? "light" : "dark")}
              >
                <Icon name="sun" />
              </button>
            </div>
          </header>
          <main id="main-content">
            {(notice || workspace.error) && (
              <div
                className={`notice ${workspace.error ? "error" : ""}`}
                role="status"
              >
                {workspace.error || notice}
                {workspace.error && (
                  <div className="button-row">
                    <button
                      onClick={() => void workspace.retry().catch(() => {})}
                    >
                      重试保存
                    </button>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            "当前草稿会被本地最新记录替换。请先导出草稿。继续读取？",
                          )
                        )
                          void workspace.reload();
                      }}
                    >
                      读取最新记录
                    </button>
                  </div>
                )}
                <button
                  className="text-button"
                  aria-label="关闭提示"
                  onClick={() => announce("")}
                >
                  ×
                </button>
              </div>
            )}
            {!workspace.ready ? (
              <section className="card">读取本地资料…</section>
            ) : route === "/compass" ? (
              <CompassPage />
            ) : route.startsWith("/projects") ? (
              <ProjectsPage route={route} />
            ) : route.startsWith("/knowledge") ? (
              <KnowledgePage route={route} />
            ) : route === "/settings" ? (
              <SettingsPage theme={theme} chooseTheme={chooseTheme} />
            ) : (
              <section className="card">
                <h1>页面不存在</h1>
                <a href="#/compass">返回罗盘</a>
              </section>
            )}
          </main>
          <footer className="page-footer">
            <span>堪舆手记 · {__APP_VERSION__}</span>
            <span>现场资料保存在本机</span>
          </footer>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
