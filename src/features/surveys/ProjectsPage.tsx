import { PlanEditor } from "../plans/PlanEditor";
import { ReportsPanel } from "../reports/ReportsPanel";
import { prepareImage, imageDataURL } from "../../domain/images";
import { useEffect, useRef, useState } from "react";
import { useApp, useActivity } from "../../App";
import { Icon } from "../../components/Icon";
import {
  mountain,
  NORTH_LABEL,
  opposite,
  parseAngle,
  type KnownNorth,
} from "../../domain/direction";
import {
  adopt,
  CATEGORIES,
  facingAngle,
  newProject,
  nowISO,
  OBJECTS,
  recommend,
  uid,
  type ObjectKind,
  type Observation,
  type Project,
} from "../../domain/model";
import { KNOWLEDGE } from "../../data/knowledge";
export function ProjectsPage({ route }: { route: string }) {
  const app = useApp();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  const id = route.split("/")[2];
  const project = app.data.projects.find((p) => p.id === id);
  async function create() {
    try {
      const p = newProject(name);
      await app.mutate((d) => {
        d.projects.push(p);
      });
      app.select(p.id);
      setName("");
      location.hash = `/projects/${p.id}`;
    } catch (e) {
      app.announce((e as Error).message);
    }
  }
  if (id && !project)
    return (
      <section className="card empty-state">
        <h1>本机没有这个项目</h1>
        <p>项目资料不随链接传送。请导入完整备份，或返回项目列表。</p>
        <a href="#/projects">返回项目列表</a>
      </section>
    );
  if (project) return <ProjectDetail key={project.id} project={project} />;
  const visible = app.data.projects.filter(
    (p) => !!p.archivedAt === archived && p.name.includes(query),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            FIELD WORKSPACE <span>测量与观察</span>
          </p>
          <h1>现场项目</h1>
          <p className="subtitle">把每个测点、每次复测和取向依据放在一起。</p>
        </div>
        <span className="pill">{app.data.projects.length} 个项目</span>
      </div>
      <section className="card create-project">
        <label>
          项目名称
          <input
            placeholder="例如：东院住宅现场复核"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
            }}
          />
        </label>
        <button
          className="primary"
          disabled={app.mode === "readonly" || app.pending > 0}
          onClick={() => void create()}
        >
          <Icon name="plus" />
          建立项目
        </button>
      </section>
      <div className="list-toolbar">
        <label>
          搜索项目
          <input
            placeholder="按项目名称查找"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button aria-pressed={archived} onClick={() => setArchived((v) => !v)}>
          {archived ? "查看进行中" : "查看已归档"}
        </button>
      </div>
      <div className="project-grid">
        {visible.map((p) => {
          const a = p.adoptions.find((a) => a.id === p.activeAdoptionId);
          return (
            <a
              className="card project-card"
              key={p.id}
              href={`#/projects/${p.id}`}
              onClick={() => app.select(p.id)}
            >
              <span className="project-icon">
                <Icon name="projects" />
              </span>
              <h2>{p.name}</h2>
              <p>
                {a
                  ? `坐${mountain(opposite(a.angle)).name}向${mountain(a.angle).name} · ${a.angle.toFixed(1)}° · ${NORTH_LABEL[a.north]}`
                  : "坐向尚未确认"}
              </p>
              <div className="project-stats">
                <span>{p.points.length} 测点</span>
                <span>{p.measurements.length} 次测量</span>
                <span>{p.observations.length} 条观察</span>
              </div>
              <div className="card-bottom">
                <span>
                  更新于 {new Date(p.updatedAt).toLocaleDateString("zh-CN")}
                </span>
                <Icon name="arrow" />
              </div>
            </a>
          );
        })}
      </div>
      {!visible.length && (
        <section className="card empty-state">
          <Icon name="projects" />
          <h2>{archived ? "尚无归档项目" : "从一次现场记录开始"}</h2>
          <p>填写项目名称，建立第一个测点。</p>
        </section>
      )}
    </>
  );
}
function ProjectDetail({ project: p }: { project: Project }) {
  const app = useApp();
  const [pointId, setPointId] = useState(p.points[0]?.id || "");
  const point = p.points.find((x) => x.id === pointId) || p.points[0];
  const [pointName, setPointName] = useState("");
  const [editPointName, setEditPointName] = useState(point.name);
  const [editPointDescription, setEditPointDescription] = useState(
    point.description,
  );
  useEffect(() => {
    setEditPointName(point.name);
    setEditPointDescription(point.description);
  }, [point.id]);
  useActivity(
    "point-metadata",
    editPointName !== point.name || editPointDescription !== point.description,
  );
  const [object, setObject] = useState<ObjectKind>("建筑轴线");
  const [north, setNorth] = useState<KnownNorth>("magnetic");
  const [basis, setBasis] = useState("");
  const [manual, setManual] = useState(false);
  const [angle, setAngle] = useState("");
  const [reason, setReason] = useState("");
  const [editName, setEditName] = useState(p.name);
  const [editLocation, setEditLocation] = useState(p.location);
  const [latitude, setLatitude] = useState(p.latitude?.toString() || "");
  const [longitude, setLongitude] = useState(p.longitude?.toString() || "");
  useActivity(
    "project-metadata",
    editName !== p.name ||
      editLocation !== p.location ||
      latitude !== (p.latitude?.toString() || "") ||
      longitude !== (p.longitude?.toString() || ""),
  );
  useActivity(
    "adoption-form",
    !!basis.trim() || !!reason.trim() || !!angle.trim(),
  );
  const adoption = p.adoptions.find((a) => a.id === p.activeAdoptionId);
  const measurements = p.measurements.filter(
    (m) =>
      m.pointId === point?.id &&
      m.north === north &&
      m.object === point?.object,
  );
  const advice = recommend(measurements);
  const edit = async (fn: (project: Project) => void) => {
    try {
      await app.mutate((d) => {
        const next = d.projects.find((x) => x.id === p.id)!;
        fn(next);
        next.updatedAt = nowISO();
      });
    } catch (e) {
      app.announce((e as Error).message);
      throw e;
    }
  };
  async function addPoint() {
    if (!pointName.trim()) {
      app.announce("请填写测点名称");
      return;
    }
    const at = nowISO();
    const id = uid();
    try {
      await edit((next) => {
        next.points.push({
          id,
          name: pointName.trim(),
          object,
          description: "",
          createdAt: at,
          updatedAt: at,
        });
      });
      setPointName("");
      setPointId(id);
    } catch {}
  }
  function confirmAdoption() {
    try {
      const revision = adopt(
        p,
        measurements,
        basis,
        manual ? parseAngle(angle) : undefined,
        reason,
      );
      void edit((next) => {
        next.adoptions.push(revision);
        next.activeAdoptionId = revision.id;
      })
        .then(() => {
          setBasis("");
          setReason("");
          setAngle("");
          setManual(false);
          app.announce("坐向修订已记录");
        })
        .catch(() => {});
    } catch (e) {
      app.announce((e as Error).message);
    }
  }
  function addObservation() {
    const at = nowISO();
    void edit((next) => {
      next.observations.push({
        id: uid(),
        pointId: point.id,
        category: "明堂",
        fact: "",
        judgment: "",
        attachmentIds: [],
        createdAt: at,
        updatedAt: at,
      });
    }).catch(() => {});
  }
  function saveMetadata() {
    try {
      const lat = latitude.trim() ? Number(latitude) : undefined;
      const lon = longitude.trim() ? Number(longitude) : undefined;
      if (!editName.trim()) throw new Error("项目名称不能为空");
      if (
        (lat != null && (!Number.isFinite(lat) || Math.abs(lat) > 90)) ||
        (lon != null && (!Number.isFinite(lon) || Math.abs(lon) > 180))
      )
        throw new Error("纬度须在 ±90°，经度须在 ±180°");
      void edit((next) => {
        next.name = editName.trim();
        next.location = editLocation;
        next.latitude = lat;
        next.longitude = lon;
      }).catch(() => {});
    } catch (e) {
      app.announce((e as Error).message);
    }
  }
  return (
    <>
      <a className="back-link" href="#/projects">
        ← 现场项目
      </a>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            FIELD RECORD <span>{p.archivedAt ? "已归档" : "进行中"}</span>
          </p>
          <h1>{p.name}</h1>
          <p className="subtitle">
            {p.points.length} 个测点 · {p.measurements.length} 次独立测量
          </p>
        </div>
        <a
          className="button primary"
          href="#/compass"
          onClick={() => app.select(p.id)}
        >
          <Icon name="compass" />
          继续测量
        </a>
      </div>
      <section className="card adoption-summary">
        <div>
          <span className="tiny-label">正式采用坐向</span>
          <h2>
            {adoption
              ? `坐${mountain(opposite(adoption.angle)).name}向${mountain(adoption.angle).name}`
              : "尚未确认坐向"}
          </h2>
          <p>
            {adoption
              ? `${adoption.angle.toFixed(1)}° · ${NORTH_LABEL[adoption.north]} · ${adoption.manual ? "人工选值" : "复测均值确认"}`
              : "先保存三次同一对象的测量，再明确取向依据。"}
          </p>
        </div>
        {adoption && (
          <div>
            <strong>取向依据</strong>
            <p>{adoption.basis}</p>
            {adoption.reason && <p>修订原因：{adoption.reason}</p>}
          </div>
        )}
      </section>
      <div className="project-detail-grid">
        <div>
          <section className="card">
            <h2>测点与复测</h2>
            <label>
              当前测点
              <select
                value={point?.id || ""}
                onChange={(e) => setPointId(e.target.value)}
              >
                {p.points.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.name} · {pt.object}
                  </option>
                ))}
              </select>
            </label>
            <details>
              <summary>编辑当前测点</summary>
              <label>
                当前测点名称
                <input
                  value={editPointName}
                  onChange={(e) => setEditPointName(e.target.value)}
                />
              </label>
              <label>
                测点说明
                <textarea
                  value={editPointDescription}
                  onChange={(e) => setEditPointDescription(e.target.value)}
                />
              </label>
              <button
                disabled={!!p.archivedAt || app.mode === "readonly"}
                onClick={() => {
                  if (!editPointName.trim()) {
                    app.announce("请填写测点名称");
                    return;
                  }
                  void edit((project) => {
                    const pt = project.points.find((pt) => pt.id === point.id)!;
                    pt.name = editPointName.trim();
                    pt.description = editPointDescription;
                    pt.updatedAt = nowISO();
                  }).catch(() => {});
                }}
              >
                保存测点资料
              </button>
            </details>
            <details>
              <summary>新增测点</summary>
              <label>
                测点名称
                <input
                  value={pointName}
                  onChange={(e) => setPointName(e.target.value)}
                />
              </label>
              <label>
                测量对象
                <select
                  value={object}
                  onChange={(e) => setObject(e.target.value as ObjectKind)}
                >
                  {OBJECTS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <button disabled={!!p.archivedAt} onClick={() => void addPoint()}>
                新增测点
              </button>
            </details>
            <div className="measurement-list">
              {p.measurements
                .filter((m) => m.pointId === point.id)
                .map((m) => (
                  <article className="record-card" key={m.id}>
                    <div>
                      <strong>
                        {facingAngle(m).toFixed(1)}°{" "}
                        <span>向{mountain(facingAngle(m)).name}</span>
                      </strong>
                      <span className="pill">{NORTH_LABEL[m.north]}</span>
                    </div>
                    <p>
                      {m.source} · {m.object} ·{" "}
                      {new Date(m.createdAt).toLocaleString("zh-CN")}
                    </p>
                    <details>
                      <summary>查看原始记录</summary>
                      <dl className="data-list">
                        <dt>原始角度</dt>
                        <dd>
                          {m.rawAngle}° ·{" "}
                          {m.kind === "facing" ? "测向" : "测坐"} ·{" "}
                          {NORTH_LABEL[m.rawNorth]}
                        </dd>
                        <dt>输出角度</dt>
                        <dd>
                          {m.angle}° · {NORTH_LABEL[m.north]}
                        </dd>
                        <dt>时区</dt>
                        <dd>{m.timezone}</dd>
                        <dt>质量</dt>
                        <dd>{m.quality.status}</dd>
                        <dt>规则</dt>
                        <dd>{m.ruleVersion}</dd>
                        {m.correction && (
                          <>
                            <dt>磁偏角</dt>
                            <dd>
                              {m.correction.degrees}° · {m.correction.source} ·{" "}
                              {m.correction.date} · {m.correction.place}
                            </dd>
                          </>
                        )}
                      </dl>
                    </details>
                  </article>
                ))}
            </div>
            {!p.measurements.some((m) => m.pointId === point.id) && (
              <p className="muted">该测点尚未保存测量。</p>
            )}
          </section>
          <section className="card">
            <div className="section-title">
              <h2>现场观察</h2>
              <button onClick={addObservation} disabled={!!p.archivedAt}>
                <Icon name="plus" />
                新增观察
              </button>
            </div>
            <p className="muted">事实与人员判断分别记录，空项表示未记录。</p>
            {p.observations
              .filter((o) => o.pointId === point.id)
              .map((o) => (
                <ObservationEditor
                  key={o.id}
                  observation={o}
                  archived={!!p.archivedAt}
                  project={p}
                  save={(next) =>
                    edit((project) => {
                      project.observations = project.observations.map((v) =>
                        v.id === next.id ? next : v,
                      );
                    })
                  }
                />
              ))}
          </section>
        </div>
        <div>
          <section className="card">
            <h2>确认采用坐向</h2>
            <label>
              采用参考北
              <select
                value={north}
                onChange={(e) => setNorth(e.target.value as KnownNorth)}
              >
                <option value="magnetic">磁北</option>
                <option value="true">真北</option>
              </select>
            </label>
            <p
              className={advice.angle == null ? "warning-text" : "success-text"}
            >
              {advice.reason}
              {advice.span != null
                ? ` · 最短跨度 ${advice.span.toFixed(2)}°`
                : ""}
            </p>
            {advice.angle != null && (
              <p className="recommended">
                推荐向角 <strong>{advice.angle.toFixed(1)}°</strong>
              </p>
            )}
            <label>
              建筑取向依据
              <textarea
                placeholder="说明采用的建筑轴线及现场依据"
                value={basis}
                onChange={(e) => setBasis(e.target.value)}
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={manual}
                onChange={(e) => setManual(e.target.checked)}
              />
              人工选择向角
            </label>
            {manual && (
              <label>
                人工采用向角（度）
                <input
                  type="number"
                  value={angle}
                  onChange={(e) => setAngle(e.target.value)}
                />
              </label>
            )}
            <label>
              人工选值／修订原因
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  p.activeAdoptionId
                    ? "修改已采用坐向须填原因"
                    : "人工选值时须填原因"
                }
              />
            </label>
            <button
              className="primary"
              disabled={
                measurements.length < 3 || !!p.archivedAt || app.pending > 0
              }
              onClick={confirmAdoption}
            >
              确认采用坐向
            </button>
            <details>
              <summary>历次坐向修订（{p.adoptions.length}）</summary>
              {p.adoptions.map((a) => (
                <div className="history-entry" key={a.id}>
                  <strong>
                    {a.angle.toFixed(1)}° · {NORTH_LABEL[a.north]}
                  </strong>
                  <p>
                    {a.basis} · {a.reason || "复测均值确认"}
                  </p>
                  <small>{new Date(a.createdAt).toLocaleString("zh-CN")}</small>
                </div>
              ))}
            </details>
          </section>
          <section className="card">
            <h2>项目资料</h2>
            <label>
              项目名称
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </label>
            <label>
              详细地点（可选）
              <input
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
              />
            </label>
            <div className="form-grid">
              <label>
                纬度（可选）
                <input
                  type="number"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                />
              </label>
              <label>
                经度（可选）
                <input
                  type="number"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                />
              </label>
            </div>
            <button onClick={saveMetadata}>保存项目资料</button>
            <div className="button-stack">
              <button
                onClick={() =>
                  void edit((next) => {
                    if (next.archivedAt) delete next.archivedAt;
                    else next.archivedAt = nowISO();
                  }).catch(() => {})
                }
              >
                {p.archivedAt ? "恢复项目" : "归档项目"}
              </button>
              <button
                className="danger-button"
                onClick={() => {
                  if (
                    confirm(
                      `删除“${p.name}”？将删除 ${p.points.length} 个测点、${p.measurements.length} 次测量及全部关联资料。此操作无法撤销，请先下载备份。`,
                    )
                  )
                    void app
                      .mutate((d) => {
                        d.projects = d.projects.filter((x) => x.id !== p.id);
                      })
                      .then(() => {
                        location.hash = "/projects";
                      })
                      .catch((e) => app.announce((e as Error).message));
                }}
              >
                删除项目
              </button>
            </div>
          </section>
        </div>
      </div>
      <div className="project-extras">
        <PlanEditor
          key={`${p.id}:${p.attachments.filter((a) => a.kind === "plan").length}`}
          project={p}
        />
        <ReportsPanel project={p} />
      </div>
    </>
  );
}
function ObservationEditor({
  observation: o,
  save,
  archived,
  project,
}: {
  observation: Observation;
  save: (next: Observation) => Promise<void>;
  archived: boolean;
  project: Project;
}) {
  const [draft, setDraft] = useState(o);
  const first = useRef(true);
  const latest = useRef(draft);
  const saver = useRef(save);
  const dirty = useRef(false);
  latest.current = draft;
  saver.current = save;
  useEffect(
    () => () => {
      if (dirty.current)
        void saver
          .current({ ...latest.current, updatedAt: nowISO() })
          .catch(() => {});
    },
    [],
  );
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    dirty.current = true;
    const timeout = window.setTimeout(() => {
      dirty.current = false;
      void saver
        .current({ ...latest.current, updatedAt: nowISO() })
        .catch(() => {});
    }, 0);
    return () => clearTimeout(timeout);
  }, [draft]);
  const app = useApp();
  useActivity(
    `observation-${o.id}`,
    draft.fact !== o.fact ||
      draft.judgment !== o.judgment ||
      draft.category !== o.category ||
      draft.direction !== o.direction ||
      draft.north !== o.north ||
      draft.knowledgeId !== o.knowledgeId ||
      draft.attachmentIds.join() !== o.attachmentIds.join(),
  );
  async function uploadPhoto(file: File) {
    try {
      const image = await prepareImage(file, "photo");
      await app.mutate((data) => {
        const p = data.projects.find((p) => p.id === project.id)!;
        p.attachments.push(image);
      });
      setDraft((d) => ({
        ...d,
        attachmentIds: [...d.attachmentIds, image.id],
      }));
    } catch (e) {
      app.announce((e as Error).message);
    }
  }
  return (
    <fieldset disabled={archived} className="observation-editor">
      <legend>观察记录</legend>
      <label>
        观察分类
        <select
          value={draft.category}
          onChange={(e) =>
            setDraft((d) => ({ ...d, category: e.target.value }))
          }
        >
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        现场事实
        <textarea
          placeholder="例如：东侧有沟渠，尚未判断水流方向"
          value={draft.fact}
          onChange={(e) => setDraft((d) => ({ ...d, fact: e.target.value }))}
        />
      </label>
      <label>
        人员判断
        <textarea
          placeholder="填写现场人员的判断与依据，可留空"
          value={draft.judgment}
          onChange={(e) =>
            setDraft((d) => ({ ...d, judgment: e.target.value }))
          }
        />
      </label>
      <label>
        观察方位（度，可选）
        <input
          type="number"
          min="0"
          max="360"
          step="any"
          value={draft.direction ?? ""}
          onChange={(e) => {
            try {
              setDraft((d) => ({
                ...d,
                direction: e.target.value.trim()
                  ? parseAngle(e.target.value)
                  : undefined,
                north: "magnetic",
              }));
            } catch (error) {
              app.announce((error as Error).message);
            }
          }}
        />
      </label>
      <label>
        观察参考北
        <select
          value={draft.north || "magnetic"}
          onChange={(e) =>
            setDraft((d) => ({ ...d, north: e.target.value as KnownNorth }))
          }
        >
          <option value="magnetic">磁北</option>
          <option value="true">真北</option>
        </select>
      </label>
      <label>
        添加现场照片
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadPhoto(file);
            e.target.value = "";
          }}
        />
      </label>
      <div className="photo-strip">
        {draft.attachmentIds.map((id) => {
          const image = project.attachments.find((a) => a.id === id);
          return image ? (
            <img key={id} src={imageDataURL(image)} alt="本地现场照片" />
          ) : null;
        })}
      </div>
      <label>
        关联资料（可选）
        <select
          value={draft.knowledgeId || ""}
          onChange={(e) => {
            const k = KNOWLEDGE.find((v) => v.id === e.target.value);
            setDraft((d) => ({
              ...d,
              knowledgeId: k?.id,
              knowledgeVersion: k?.version,
            }));
          }}
        >
          <option value="">未关联</option>
          {KNOWLEDGE.filter((k) => k.status === "approved").map((k) => (
            <option key={k.id} value={k.id}>
              {k.title}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}
