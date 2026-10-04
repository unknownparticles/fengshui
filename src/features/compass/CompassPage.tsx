import { DevicePanel } from "./DevicePanel";
import { useState } from "react";
import { useApp, useActivity } from "../../App";
import { CompassDial } from "../../components/CompassDial";
import { Icon } from "../../components/Icon";
import {
  boundary,
  convertNorth,
  interval,
  mountain,
  NORTH_LABEL,
  opposite,
  parseAngle,
  RULE_VERSION,
  type Declination,
  type KnownNorth,
} from "../../domain/direction";
import { nowISO, timezone, uid, type Measurement } from "../../domain/model";

export function CompassPage() {
  const app = useApp();
  const project = app.project;
  const [pointId, setPointId] = useState("");
  const point =
    project?.points.find((p) => p.id === pointId) || project?.points[0];
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"facing" | "sitting">("facing");
  const [rawNorth, setRawNorth] = useState<KnownNorth>("magnetic");
  const [north, setNorth] = useState<KnownNorth>("magnetic");
  const [correction, setCorrection] = useState<Declination>({
    degrees: 0,
    source: "",
    date: "",
    place: "",
  });
  const [locked, setLocked] = useState<Measurement | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [device, setDevice] = useState<{
    angle: number;
    north: KnownNorth;
  } | null>(null);
  useActivity("compass-draft", (!!text.trim() || !!locked) && !saved);
  let current: number | null = null;
  let invalid = "";
  if (text.trim()) {
    try {
      current = convertNorth(parseAngle(text), rawNorth, north, correction);
    } catch (e) {
      invalid = (e as Error).message;
    }
  }
  const value = locked?.angle ?? device?.angle ?? current;
  const facing =
    value == null
      ? null
      : (locked?.kind ?? kind) === "facing"
        ? value
        : opposite(value);
  const sitting = facing == null ? null : opposite(facing);
  const edge = facing == null ? null : boundary(facing);
  const count =
    project?.measurements.filter((m) => m.pointId === point?.id).length || 0;
  function lock() {
    try {
      if (!project || !point) throw new Error("请先选择项目和测点");
      const rawAngle = parseAngle(text);
      const angle = convertNorth(rawAngle, rawNorth, north, correction);
      setLocked({
        id: uid(),
        pointId: point.id,
        object: point.object,
        kind,
        rawAngle,
        rawNorth,
        angle,
        north,
        correction:
          rawNorth !== north ? structuredClone(correction) : undefined,
        source: "手工实体罗盘",
        createdAt: nowISO(),
        timezone: timezone(),
        ruleVersion: RULE_VERSION,
        samples: [],
        quality: {
          status: "实体罗盘手录 · 设备精度未知",
          accuracy: null,
          spread: null,
          count: 0,
          version: "manual-v1",
        },
      });
      setError("");
      setSaved(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function save() {
    if (!locked || !project) return;
    try {
      await app.mutate((data) => {
        const p = data.projects.find((p) => p.id === project.id)!;
        if (!p.measurements.some((m) => m.id === locked.id))
          p.measurements.push(structuredClone(locked));
        p.updatedAt = nowISO();
      });
      setSaved(true);
      app.announce(
        app.mode === "memory"
          ? "测量已保留在本次会话，请下载备份"
          : "测量已保存到本机",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            FIELD COMPASS <span>现场定向</span>
          </p>
          <h1>现场罗盘</h1>
          <p className="subtitle">每一次取向，都留下可复核的依据。</p>
        </div>
        <a className="button secondary" href="#/projects">
          <Icon name="plus" />
          建立项目
        </a>
      </div>
      <section className="context-bar">
        <label>
          当前项目
          <select
            aria-label="当前项目"
            disabled={!!locked}
            value={project?.id || ""}
            onChange={(e) => {
              app.select(e.target.value);
              setPointId("");
            }}
          >
            <option value="" disabled>
              请选择项目
            </option>
            {app.data.projects
              .filter((p) => !p.archivedAt)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          测点
          <select
            aria-label="测点"
            disabled={!!locked}
            value={point?.id || ""}
            onChange={(e) => setPointId(e.target.value)}
          >
            <option value="" disabled>
              请选择测点
            </option>
            {project?.points.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.object}
              </option>
            ))}
          </select>
        </label>
        <span className="context-count">
          已保存 <strong>{count}</strong> 次测量
        </span>
      </section>
      <div className="compass-layout">
        <section className="card instrument">
          <div className="card-header">
            <span className="pill">地盘正针</span>
            <span className="muted">
              {NORTH_LABEL[locked?.north ?? device?.north ?? north]} ·{" "}
              {locked ? "已锁定" : device ? "人工校准测量" : "手工测量"}
            </span>
          </div>
          <div className="reading-summary">
            <div className="angle">
              {facing == null ? (
                <span className="empty-angle">— —</span>
              ) : (
                <>
                  {facing.toFixed(1)}
                  <span className="degree">°</span>
                </>
              )}
            </div>
            <p className="sitting-facing">
              {facing == null
                ? "等待方位读数"
                : `坐${mountain(sitting!).name} · 向${mountain(facing).name}`}
            </p>
            <span className="muted">
              {facing == null
                ? "输入实体罗盘读数"
                : `${mountain(facing).palace}宫 · ${mountain(facing).direction}方`}
            </span>
          </div>
          <CompassDial angle={facing} locked={!!locked} />
          <div className="instrument-foot">
            <span>二十四山</span>
            <span>后天八方</span>
            <a href="#/knowledge/boundary">查看山界规则 ↗</a>
          </div>
        </section>
        <div className="compass-side">
          <section className="card">
            <div className="section-title">
              <h2>记录方向</h2>
              <span className="tiny-label">
                {locked?.calibration ? "人工参考校准" : "实体罗盘手录"}
              </span>
            </div>
            <div className="segmented">
              <button
                aria-pressed={kind === "facing"}
                disabled={!!locked}
                onClick={() => setKind("facing")}
              >
                测向
              </button>
              <button
                aria-pressed={kind === "sitting"}
                disabled={!!locked}
                onClick={() => setKind("sitting")}
              >
                测坐
              </button>
            </div>
            <label>
              方位角（度）
              <input
                aria-label="方位角（度）"
                inputMode="decimal"
                type="number"
                min="0"
                max="360"
                step="any"
                placeholder="0° — 360°"
                disabled={!!locked}
                value={text}
                onChange={(e) => {
                  setDevice(null);
                  setText(e.target.value);
                  setError("");
                }}
              />
            </label>
            <div className="form-grid">
              <label>
                原始参考北
                <select
                  disabled={!!locked}
                  value={rawNorth}
                  onChange={(e) => {
                    setRawNorth(e.target.value as KnownNorth);
                    setNorth(e.target.value as KnownNorth);
                  }}
                >
                  <option value="magnetic">磁北</option>
                  <option value="true">真北</option>
                </select>
              </label>
              <label>
                输出参考北
                <select
                  disabled={!!locked}
                  value={north}
                  onChange={(e) => setNorth(e.target.value as KnownNorth)}
                >
                  <option value="magnetic">磁北</option>
                  <option value="true">真北</option>
                </select>
              </label>
            </div>
            {rawNorth !== north && (
              <fieldset disabled={!!locked}>
                <legend>人工磁偏角</legend>
                <label>
                  偏角（东偏为正）
                  <input
                    type="number"
                    min="-180"
                    max="180"
                    step="any"
                    value={correction.degrees}
                    onChange={(e) =>
                      setCorrection((c) => ({
                        ...c,
                        degrees: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  偏角来源
                  <input
                    value={correction.source}
                    onChange={(e) =>
                      setCorrection((c) => ({ ...c, source: e.target.value }))
                    }
                  />
                </label>
                <label>
                  适用日期
                  <input
                    type="date"
                    value={correction.date}
                    onChange={(e) =>
                      setCorrection((c) => ({ ...c, date: e.target.value }))
                    }
                  />
                </label>
                <label>
                  适用地点
                  <input
                    value={correction.place}
                    onChange={(e) =>
                      setCorrection((c) => ({ ...c, place: e.target.value }))
                    }
                  />
                </label>
              </fieldset>
            )}
            {(error || invalid) && (
              <p className="inline-error" role="alert">
                {error || invalid}
              </p>
            )}
            {!project && (
              <p className="warning-text">
                先建立一个项目，就能保存独立测量记录。
              </p>
            )}
            <div className="quality-card">
              <Icon name={locked ? "check" : "compass"} />
              <div>
                <strong>{locked ? "读数已锁定" : "手工输入 · 精度未知"}</strong>
                <p>
                  {locked
                    ? "图形和原始读数已冻结，可保存或重新测量。"
                    : "小数位是显示分辨率，建议使用实体罗盘复测。"}
                </p>
              </div>
            </div>
            {edge && edge.distance <= 2 && (
              <p className="boundary-warning" role="status">
                临近{edge.left}／{edge.right}山界 · 距离{" "}
                {edge.distance.toFixed(2)}°，建议复测
              </p>
            )}
            <div className="button-stack">
              {!locked ? (
                <button
                  className="primary"
                  disabled={!project || app.mode === "readonly"}
                  onClick={lock}
                >
                  <Icon name="pin" />
                  锁定读数
                </button>
              ) : (
                <>
                  <button
                    className="primary"
                    disabled={saved || app.pending > 0}
                    onClick={() => void save()}
                  >
                    <Icon name="check" />
                    {saved ? "本次测量已记录" : "保存测量"}
                  </button>
                  <button
                    onClick={() => {
                      setDevice(null);
                      setLocked(null);
                      setSaved(false);
                      setText("");
                      setError("");
                    }}
                  >
                    重新测量
                  </button>
                </>
              )}
            </div>
            <details>
              <summary>原始读数与规则详情</summary>
              <dl className="data-list">
                <dt>测量对象</dt>
                <dd>{locked?.object || point?.object || "未选择"}</dd>
                <dt>原始读数</dt>
                <dd>
                  {locked
                    ? `${locked.rawAngle}° · ${NORTH_LABEL[locked.rawNorth]}`
                    : "尚未锁定"}
                </dd>
                <dt>向山区间</dt>
                <dd>{facing == null ? "未记录" : interval(facing)}</dd>
                <dt>规则版本</dt>
                <dd>{RULE_VERSION}</dd>
                <dt>精度</dt>
                <dd>设备精度未知</dd>
              </dl>
            </details>
          </section>
          <DevicePanel
            point={point}
            kind={kind}
            locked={!!locked}
            onPreview={(angle, north) => {
              if (!locked)
                setDevice(angle != null && north ? { angle, north } : null);
            }}
            onLock={(reading) => {
              setLocked(reading);
              setSaved(false);
              setError("");
              setDevice(null);
            }}
          />
          <section className="card field-note">
            <span className="tiny-label">现场提示</span>
            <h3>先明确对象，再确定坐向</h3>
            <p>
              门向、窗口与建筑轴线分别记录。至少保存三次同一对象的测量，在项目中确认取向依据。
            </p>
            <a
              href={
                project ? `#/projects/${project.id}` : "#/knowledge/workflow"
              }
            >
              查看{project ? "项目与复测" : "现场流程"} <Icon name="arrow" />
            </a>
          </section>
        </div>
      </div>
      <div className="mobile-measure-dock" aria-label="测量快捷操作">
        <span>
          {error
            ? "保存失败 · 草稿保留"
            : locked
              ? "读数已锁定 · 精度未知"
              : "手录 · 精度未知"}
          {edge && edge.distance <= 2 ? " · 临近山界" : ""}
        </span>
        {!locked ? (
          <button
            className="primary"
            disabled={!project || app.mode === "readonly"}
            onClick={lock}
          >
            锁定读数
          </button>
        ) : (
          <button
            className="primary"
            disabled={saved || app.pending > 0}
            onClick={() => void save()}
          >
            {saved ? "本次测量已记录" : "保存测量"}
          </button>
        )}
      </div>
    </>
  );
}
