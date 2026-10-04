import { useState } from "react";
import { useApp } from "../../App";
import { createReport, reportHTML } from "../../domain/report";
import { download } from "../../domain/backup";
import {
  DEFAULT_PRIVACY,
  nowISO,
  type Project,
  type Report,
} from "../../domain/model";
export function ReportsPanel({ project: p }: { project: Project }) {
  const app = useApp();
  const [privacy, setPrivacy] = useState({ ...DEFAULT_PRIVACY });
  const [selected, setSelected] = useState<string | null>(null);
  const report = p.reports.find((r) => r.id === selected);
  async function generate() {
    try {
      const r = createReport(p, privacy);
      await app.mutate((data) => {
        const next = data.projects.find((x) => x.id === p.id)!;
        next.reports.push(r);
        next.updatedAt = nowISO();
      });
      setSelected(r.id);
      app.announce("报告快照已保存，后续编辑不会改变它");
    } catch (e) {
      app.announce((e as Error).message);
    }
  }
  function exportReport(r: Report) {
    download(reportHTML(r), `现场报告-${r.id}.html`, "text/html;charset=utf-8");
  }
  function print(r: Report) {
    const url = URL.createObjectURL(
      new Blob([reportHTML(r)], { type: "text/html;charset=utf-8" }),
    );
    const popup = window.open(url, "_blank");
    if (!popup)
      app.announce("浏览器阻止了预览窗口，请下载 HTML 后打开并使用打印菜单。");
    else popup.addEventListener("load", () => popup.print(), { once: true });
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  return (
    <section className="card reports-panel">
      <div className="section-title">
        <h2>现场报告</h2>
        <span className="pill">历史快照</span>
      </div>
      <p className="muted">
        默认省略详细地址、坐标和照片。完整备份与脱敏报告是不同文件。
      </p>
      <details>
        <summary>生成报告的脱敏设置</summary>
        {(["location", "coordinates", "photos"] as const).map((key, i) => (
          <label className="check-label" key={key}>
            <input
              type="checkbox"
              checked={privacy[key]}
              onChange={(e) =>
                setPrivacy((v) => ({ ...v, [key]: e.target.checked }))
              }
            />
            包含{["详细地址", "坐标", "照片"][i]}
          </label>
        ))}
      </details>
      <p>
        将省略：
        {[
          !privacy.location ? "详细地址" : "",
          !privacy.coordinates ? "坐标" : "",
          !privacy.photos ? "照片" : "",
        ]
          .filter(Boolean)
          .join("、") || "未省略"}
      </p>
      <button
        className="primary"
        disabled={app.pending > 0 || app.mode === "readonly"}
        onClick={() => void generate()}
      >
        生成报告快照
      </button>
      <div className="report-list">
        {[...p.reports].reverse().map((r) => (
          <article className="record-card" key={r.id}>
            <strong>{new Date(r.createdAt).toLocaleString("zh-CN")}</strong>
            <p>
              {r.timezone} · {r.ruleVersion}
            </p>
            <div className="button-row">
              <button
                onClick={() => setSelected(selected === r.id ? null : r.id)}
              >
                查看报告
              </button>
              <button onClick={() => exportReport(r)}>下载脱敏报告</button>
              <button onClick={() => print(r)}>打印报告</button>
            </div>
          </article>
        ))}
      </div>
      {report && (
        <iframe
          className="report-preview"
          title="报告快照预览"
          sandbox=""
          srcDoc={reportHTML(report)}
        />
      )}
    </section>
  );
}
