import { useApp } from "../../App";
export function SettingsPage({
  theme,
  chooseTheme,
}: {
  theme: string;
  chooseTheme: (value: string) => void;
}) {
  const app = useApp();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            FIELD SETTINGS <span>本机与偏好</span>
          </p>
          <h1>使用设置</h1>
          <p className="subtitle">显示、保存和离线使用各有明确状态。</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="card">
          <h2>显示主题</h2>
          <label>
            主题偏好
            <select value={theme} onChange={(e) => chooseTheme(e.target.value)}>
              <option value="system">跟随系统</option>
              <option value="light">瓷白</option>
              <option value="dark">墨黑</option>
            </select>
          </label>
          <p>切换显示不会清空测量和草稿。</p>
        </section>
        <section className="card">
          <h2>本地资料</h2>
          <p role="status">{app.status}</p>
          <p>
            {app.data.projects.length} 个项目 ·{" "}
            {app.data.projects.reduce((n, p) => n + p.measurements.length, 0)}{" "}
            次测量
          </p>
          <p className="muted">
            资料保存在浏览器内。清理浏览器、隐私窗口结束或存储回收可能移除数据，请定期下载完整备份。
          </p>
        </section>
        <section className="card">
          <h2>当前版本</h2>
          <p>应用 {__APP_VERSION__} · 地盘正针 earth-plate-v1</p>
          <p>手机北向适配尚未完成实机对照，当前正式测量采用实体罗盘手录。</p>
          <a
            href="https://github.com/unknownparticles/fengshui"
            target="_blank"
            rel="noreferrer"
          >
            项目仓库 ↗
          </a>
        </section>
        <section className="card">
          <h2>数据边界</h2>
          <p>现场资料在本机处理。页面托管方可能记录普通访问日志。</p>
          <p>传统解释、现场事实和人员判断分别记录，首版不计算吉凶评分。</p>
        </section>
      </div>
    </>
  );
}
