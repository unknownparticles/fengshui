import { useState } from "react";
import { KNOWLEDGE, SOURCES } from "../../data/knowledge";
export function KnowledgePage({ route }: { route: string }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const selected = KNOWLEDGE.find(
    (k) => k.id === decodeURIComponent(route.split("/")[2] || ""),
  );
  if (selected)
    return (
      <>
        <a className="back-link" href="#/knowledge">
          ← 资料目录
        </a>
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              FIELD REFERENCE <span>{selected.category}</span>
            </p>
            <h1>{selected.title}</h1>
          </div>
        </div>
        <article className="card knowledge-article">
          <span
            className={`pill ${selected.status === "candidate" ? "warning" : ""}`}
          >
            {selected.status === "approved"
              ? "原创说明 · 已核验"
              : "参考线索 · 待复核"}
          </span>
          <p>{selected.text}</p>
          <h2>来源与版本</h2>
          <p className="muted">
            内容版本：{selected.version} · 整理日期：2026-10-04
          </p>
          <p>原文：未收录 · 现代注释：未收录 · 本页为原创说明或核查摘要。</p>
          {selected.sourceIds.map((id) => {
            const source = SOURCES.find((s) => s.id === id)!;
            return (
              <section key={id} className="source-card">
                <h3>{source.title}</h3>
                <p>
                  {source.acquired} · {source.license} · {source.review}
                </p>
                {source.commit && (
                  <p className="mono">
                    固定提交：{source.commit}
                    <br />
                    文件：{source.path}
                  </p>
                )}
                <a
                  href={
                    source.commit
                      ? `${source.url}/blob/${source.commit}/${source.path}`
                      : source.url
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  查阅来源 ↗（需要联网）
                </a>
              </section>
            );
          })}
        </article>
      </>
    );
  const entries = KNOWLEDGE.filter(
    (k) =>
      (category === "全部" || k.category === category) &&
      `${k.title}${k.text}`.includes(query),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            FIELD REFERENCE <span>方位有据</span>
          </p>
          <h1>堪舆资料</h1>
          <p className="subtitle">查规则、看来源，保留每次解释的版本。</p>
        </div>
        <span className="pill">地盘正针</span>
      </div>
      <section className="search-bar">
        <label>
          搜索资料
          <input
            placeholder="搜索山名、坐向、磁北…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          资料分类
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {["全部", ...new Set(KNOWLEDGE.map((k) => k.category))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </section>
      <div className="knowledge-grid">
        {entries.map((k) => (
          <a
            className="card knowledge-card"
            href={`#/knowledge/${encodeURIComponent(k.id)}`}
            key={k.id}
          >
            <span className="tiny-label">
              {k.category} · {k.status === "candidate" ? "待复核" : "原创说明"}
            </span>
            <h2>{k.title}</h2>
            <p>{k.text}</p>
            <span className="muted">查看详情与来源 →</span>
          </a>
        ))}
      </div>
      {!entries.length && (
        <section className="card empty-state">
          <h2>没有匹配的资料</h2>
          <p>试试“子”“坐向”或“磁北”。</p>
        </section>
      )}
    </>
  );
}
