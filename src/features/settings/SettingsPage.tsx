import { useState } from "react";
import { useApp, useActivity } from "../../App";
import {
  createBackup,
  readBackup,
  remapConflicts,
  download,
} from "../../domain/backup";
import { prepareImage } from "../../domain/images";
import { NAMESPACE } from "../../storage/workspace";
import type { Attachment, Project } from "../../domain/model";
export function SettingsPage({
  theme,
  chooseTheme,
}: {
  theme: string;
  chooseTheme: (value: string) => void;
}) {
  const app = useApp();
  const [preview, setPreview] = useState<Project[] | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [storage, setStorage] = useState("尚未检查");
  const [persisted, setPersisted] = useState("尚未检查");
  useActivity("backup-operation", working);
  const allAttachments = app.data.projects.reduce(
    (n, p) => n + p.attachments.length,
    0,
  );
  async function exportBackup() {
    setWorking(true);
    try {
      download(
        await createBackup(app.data),
        `堪舆完整备份-${new Date().toISOString().slice(0, 10)}.zip`,
      );
      setError("");
      app.announce(
        "完整备份已生成，包含项目地点、照片、图纸与报告，请妥善保存。",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function exportRaw() {
    try {
      const raw = await app.rawExport();
      download(
        JSON.stringify(
          {
            type: "fengshui-raw-database",
            exportedAt: new Date().toISOString(),
            data: raw,
          },
          (_key, value) =>
            value instanceof Uint8Array
              ? { type: "Uint8Array", bytes: Array.from(value) }
              : value,
        ),
        "堪舆原始数据备份.json",
        "application/json",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function importFile(file: File) {
    setWorking(true);
    setPreview(null);
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error("备份超过 100 MiB");
      const projects = await readBackup(
        new Uint8Array(await file.arrayBuffer()),
      );
      const clean = new Map<string, Attachment>();
      for (const p of projects) {
        for (const source of [p, ...p.reports.map((r) => r.snapshot)])
          for (const a of source.attachments) {
            if (!clean.has(a.id)) {
              const decoded = await prepareImage(
                new Blob([new Uint8Array(a.bytes)], { type: a.mime }),
                a.kind,
              );
              clean.set(a.id, { ...decoded, id: a.id, createdAt: a.createdAt });
            }
            Object.assign(a, clean.get(a.id));
          }
      }
      setPreview(projects);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function confirmImport() {
    if (!preview) return;
    setWorking(true);
    try {
      await app.mutate((next) => {
        next.projects.push(...remapConflicts(preview, next.projects));
      });
      setPreview(null);
      app.announce("备份已完整导入，冲突记录已另建副本。");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function inspect() {
    try {
      if (!navigator.storage) throw new Error("浏览器不支持存储估计");
      const value = await navigator.storage.estimate();
      setStorage(
        `同源使用约 ${((value.usage || 0) / 1024 / 1024).toFixed(1)} MiB ／ 配额约 ${((value.quota || 0) / 1024 / 1024).toFixed(0)} MiB`,
      );
      setPersisted(
        (await navigator.storage.persisted())
          ? "已获准持久存储"
          : "尚未获准，浏览器仍可能回收",
      );
    } catch (e) {
      setStorage((e as Error).message);
    }
  }
  async function persist() {
    try {
      if (!navigator.storage?.persist) {
        setPersisted("浏览器不支持持久存储申请");
        return;
      }
      setPersisted(
        (await navigator.storage.persist())
          ? "已获准持久存储"
          : "未获准，功能仍可使用，请下载备份",
      );
    } catch {
      setPersisted("申请失败，功能仍可使用");
    }
  }
  async function clearCache() {
    if (
      !confirm(
        "仅清理本应用离线资源缓存，现场项目不会删除。清理后需联网重新准备。继续？",
      )
    )
      return;
    try {
      if ("caches" in window)
        for (const name of await caches.keys())
          if (name.startsWith(NAMESPACE)) await caches.delete(name);
      app.announce("应用缓存已清理，请联网重新准备离线资源。");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            FIELD SETTINGS <span>本机与偏好</span>
          </p>
          <h1>使用设置</h1>
          <p className="subtitle">显示、保存、备份与离线各有明确状态。</p>
        </div>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="settings-grid">
        <section className="card">
          <h2>离线与安装</h2>
          <p role="status">{app.pwa.offline}</p>
          <p>
            {app.pwa.online ? "当前联网" : "当前离线"} ·{" "}
            {app.pwa.standalone ? "已安装为应用" : "浏览器中使用"}
          </p>
          <p className="muted">
            离线就绪表示核心资源已缓存，不代表项目已备份或设备测向已验证。
          </p>
          <div className="button-row">
            <button
              disabled={!app.pwa.online || working}
              onClick={() => void app.pwa.prepare()}
            >
              重新准备离线资源
            </button>
            {app.pwa.install && (
              <button onClick={() => void app.pwa.install?.()}>
                安装到设备
              </button>
            )}
            {app.pwa.waiting && (
              <button disabled={app.busy} onClick={app.pwa.update}>
                保存后更新应用
              </button>
            )}
          </div>
          {app.pwa.waiting && (
            <p>新版本已准备好，可稍后更新；所有页面保存或停止测量后才刷新。</p>
          )}
          {!app.pwa.install && !app.pwa.standalone && (
            <p>
              iPhone／iPad：在支持的浏览器分享菜单中选择“添加到主屏幕”。其他浏览器可在菜单中查找安装入口；不支持安装时仍可作为网页使用。
            </p>
          )}
        </section>
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
          <h2>本地资料与存储</h2>
          <p role="status">{app.status}</p>
          <p>
            {app.data.projects.length} 个项目 ·{" "}
            {app.data.projects.reduce((n, p) => n + p.measurements.length, 0)}{" "}
            次测量 · {allAttachments} 个附件
          </p>
          <p className="muted">
            本地保存不等于备份。浏览器回收、清理或隐私窗口结束可能移除资料。
          </p>
          <p>{storage}</p>
          <p>{persisted}</p>
          <div className="button-row">
            <button onClick={() => void inspect()}>检查存储状态</button>
            <button onClick={() => void persist()}>申请持久存储</button>
          </div>
        </section>
        <section className="card">
          <h2>完整备份与恢复</h2>
          <p>
            完整 ZIP
            包含详细地点、坐标、照片、图纸、原始测量与历史报告，支持迁移到其他浏览器。
          </p>
          <button
            className="primary"
            disabled={working || app.mode === "readonly"}
            onClick={() => void exportBackup()}
          >
            {working ? "正在本地处理…" : "下载完整备份"}
          </button>
          <button disabled={working} onClick={() => void exportRaw()}>
            导出原始数据备份
          </button>
          <label>
            导入完整备份
            <input
              type="file"
              accept=".zip,application/zip"
              disabled={working || app.mode === "readonly"}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f);
                e.target.value = "";
              }}
            />
          </label>
          {preview && (
            <div className="import-preview">
              <h3>导入预览</h3>
              <p>
                {preview.length} 个项目 ·{" "}
                {preview.reduce((n, p) => n + p.attachments.length, 0)} 个附件
              </p>
              {preview.map((p) => (
                <p key={p.id}>
                  {p.name} ·{" "}
                  {app.data.projects.some((v) => v.id === p.id)
                    ? "将创建副本"
                    : "将创建项目"}
                </p>
              ))}
              <div className="button-row">
                <button
                  className="primary"
                  disabled={working || app.pending > 0}
                  onClick={() => void confirmImport()}
                >
                  确认导入备份
                </button>
                <button onClick={() => setPreview(null)}>取消导入</button>
              </div>
            </div>
          )}
        </section>
        <section className="card">
          <h2>清理范围</h2>
          <p>
            仅操作本应用的项目和缓存，不清理其他同源应用。删除前请下载完整备份。
          </p>
          <div className="button-stack">
            <button onClick={() => void clearCache()}>仅清理应用缓存</button>
            <button
              className="danger-button"
              disabled={app.mode === "readonly"}
              onClick={() => {
                if (
                  confirm(
                    `清空本应用 ${app.data.projects.length} 个项目及 ${allAttachments} 个附件？此操作无法撤销，请先备份。`,
                  )
                )
                  void app
                    .mutate((next) => {
                      next.projects = [];
                    })
                    .then(() => app.announce("本应用现场资料已清空"))
                    .catch((e) => setError((e as Error).message));
              }}
            >
              清空全部现场资料
            </button>
          </div>
        </section>
        <section className="card">
          <h2>当前版本</h2>
          <p>
            应用 {__APP_VERSION__} · 构建 {__BUILD_REVISION__} · 地盘正针
            earth-plate-v1
          </p>
          <p>
            设备北向尚未自动验证；可用实体罗盘手录，或对准已知方向人工校准后连续测量。
          </p>
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
