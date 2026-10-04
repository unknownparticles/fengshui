import { useMemo, useState } from "react";
import { useApp, useActivity } from "../../App";
import {
  parseAngle,
  NORTH_LABEL,
  RULE_VERSION,
  type KnownNorth,
} from "../../domain/direction";
import { prepareImage, imageDataURL } from "../../domain/images";
import { nowISO, uid, type Project, type Overlay } from "../../domain/model";
import { overlaySVG } from "../../domain/report";
export function PlanEditor({ project: p }: { project: Project }) {
  const app = useApp();
  const image = [...p.attachments].reverse().find((a) => a.kind === "plan");
  const prior = [...p.overlays]
    .reverse()
    .find((o) => o.attachmentId === image?.id);
  const adoption = p.adoptions.find((a) => a.id === p.activeAdoptionId);
  const [center, setCenter] = useState<{ x: number; y: number } | null>(
    prior?.center || null,
  );
  const [top, setTop] = useState(prior?.topAngle.toString() || "");
  const [north, setNorth] = useState<KnownNorth>(
    prior?.north || adoption?.north || "magnetic",
  );
  const [mode, setMode] = useState<Overlay["mode"]>(prior?.mode || "eight");
  const [opacity, setOpacity] = useState(prior?.opacity ?? 0.75);
  const [zoom, setZoom] = useState(prior?.zoom || 1);
  const [pan, setPan] = useState(prior?.pan || { x: 0, y: 0 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(!!prior);
  const url = useMemo(() => (image ? imageDataURL(image) : ""), [image?.id]);
  const stale = prior && prior.adoptionId !== p.activeAdoptionId;
  useActivity("plan-editor", loading || (!!image && !confirmed));
  const edit = async (fn: (p: Project) => void) => {
    await app.mutate((data) => {
      const project = data.projects.find((x) => x.id === p.id)!;
      fn(project);
      project.updatedAt = nowISO();
    });
  };
  async function upload(file: File) {
    setLoading(true);
    try {
      const prepared = await prepareImage(file, "plan");
      await edit((project) => {
        project.attachments.push(prepared);
      });
      setCenter(null);
      setTop("");
      setPan({ x: 0, y: 0 });
      setZoom(1);
      setConfirmed(false);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  let draft: Overlay | null = null;
  try {
    if (image && center && top.trim())
      draft = {
        id: uid(),
        attachmentId: image.id,
        center,
        topAngle: parseAngle(top),
        north,
        mode,
        opacity,
        zoom,
        pan,
        adoptionId: p.activeAdoptionId,
        createdAt: nowISO(),
        ruleVersion: RULE_VERSION,
      };
  } catch {}
  async function confirm() {
    try {
      if (!draft) throw new Error("请指定图纸中心及图顶方位角");
      if (adoption && adoption.north !== north)
        throw new Error(
          "图顶方向与采用坐向的参考北不同。请先换算方向或选择相同参考北。",
        );
      await edit((project) => {
        project.overlays.push(draft!);
      });
      setConfirmed(true);
      setError("");
      app.announce("方位示意配置已保存");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="card plan-editor">
      <div className="section-title">
        <h2>平面图方位示意</h2>
        <span className="pill">人工中心</span>
      </div>
      <p className="muted">
        导入本地图纸，明确中心和图像顶部方向。PNG／JPEG／WebP，最大 10 MiB、2000
        万像素。
      </p>
      <label>
        导入平面图
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={loading || !!p.archivedAt || app.mode === "readonly"}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
      </label>
      {loading && <p role="status">正在本地处理图纸…</p>}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {image && (
        <>
          <p className={stale ? "warning-text" : "muted"}>
            {stale
              ? "旧示意待复核：采用坐向已变更。"
              : "点击图纸设置中心，或使用中心百分比输入。"}
            {!center ? " · 尚未指定中心" : ""}
          </p>
          <div className="plan-viewport">
            <div
              className="plan-transform"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              {draft ? (
                <div
                  className="plan-image"
                  dangerouslySetInnerHTML={{ __html: overlaySVG(image, draft) }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setCenter({
                      x: Math.min(
                        1,
                        Math.max(0, (e.clientX - rect.left) / rect.width),
                      ),
                      y: Math.min(
                        1,
                        Math.max(0, (e.clientY - rect.top) / rect.height),
                      ),
                    });
                    setConfirmed(false);
                  }}
                />
              ) : (
                <img
                  className="plan-image"
                  src={url}
                  alt="本地平面图，点击设置中心"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setCenter({
                      x: (e.clientX - rect.left) / rect.width,
                      y: (e.clientY - rect.top) / rect.height,
                    });
                    setConfirmed(false);
                  }}
                />
              )}
            </div>
          </div>
          <div className="form-grid">
            <label>
              中心横坐标（%）
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                value={center ? +(center.x * 100).toFixed(2) : ""}
                onChange={(e) => {
                  const x = Number(e.target.value) / 100;
                  if (x >= 0 && x <= 1)
                    setCenter((c) => ({ x, y: c?.y ?? 0.5 }));
                  setConfirmed(false);
                }}
              />
            </label>
            <label>
              中心纵坐标（%）
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                value={center ? +(center.y * 100).toFixed(2) : ""}
                onChange={(e) => {
                  const y = Number(e.target.value) / 100;
                  if (y >= 0 && y <= 1)
                    setCenter((c) => ({ y, x: c?.x ?? 0.5 }));
                  setConfirmed(false);
                }}
              />
            </label>
            <label>
              图顶方位角（度）
              <input
                type="number"
                min="0"
                max="360"
                value={top}
                onChange={(e) => {
                  setTop(e.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
            <label>
              图顶参考北
              <select
                value={north}
                onChange={(e) => {
                  setNorth(e.target.value as KnownNorth);
                  setConfirmed(false);
                }}
              >
                <option value="magnetic">磁北</option>
                <option value="true">真北</option>
              </select>
            </label>
          </div>
          {adoption && (
            <button
              onClick={() => {
                setTop(adoption.angle.toString());
                setNorth(adoption.north);
                setConfirmed(false);
              }}
            >
              图顶取采用向角（请确认图像朝向）
            </button>
          )}
          <div className="form-grid">
            <label>
              叠加模式
              <select
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value as Overlay["mode"]);
                  setConfirmed(false);
                }}
              >
                <option value="eight">后天八方</option>
                <option value="twenty-four">地盘二十四山</option>
              </select>
            </label>
            <label>
              透明度
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={opacity}
                onChange={(e) => {
                  setOpacity(Number(e.target.value));
                  setConfirmed(false);
                }}
              />
            </label>
          </div>
          <div className="button-row">
            <button
              aria-label="缩小图纸"
              onClick={() => {
                setZoom((z) => Math.max(0.25, z - 0.25));
                setConfirmed(false);
              }}
            >
              −
            </button>
            <button
              aria-label="放大图纸"
              onClick={() => {
                setZoom((z) => Math.min(4, z + 0.25));
                setConfirmed(false);
              }}
            >
              ＋
            </button>
            <button
              aria-label="向左平移图纸"
              onClick={() => {
                setPan((v) => ({ ...v, x: Math.max(-10000, v.x - 30) }));
                setConfirmed(false);
              }}
            >
              ←
            </button>
            <button
              aria-label="向右平移图纸"
              onClick={() => {
                setPan((v) => ({ ...v, x: Math.min(10000, v.x + 30) }));
                setConfirmed(false);
              }}
            >
              →
            </button>
            <button
              aria-label="向上平移图纸"
              onClick={() => {
                setPan((v) => ({ ...v, y: Math.max(-10000, v.y - 30) }));
                setConfirmed(false);
              }}
            >
              ↑
            </button>
            <button
              aria-label="向下平移图纸"
              onClick={() => {
                setPan((v) => ({ ...v, y: Math.min(10000, v.y + 30) }));
                setConfirmed(false);
              }}
            >
              ↓
            </button>
          </div>
          <p className="muted">
            图顶 {top || "未设置"}° · {NORTH_LABEL[north]} ·{" "}
            {confirmed && !stale ? "配置已保存" : "待确认配置"}
          </p>
          <button
            className="primary"
            disabled={
              loading ||
              app.pending > 0 ||
              !!p.archivedAt ||
              app.mode === "readonly"
            }
            onClick={() => void confirm()}
          >
            确认并保存方位示意
          </button>
        </>
      )}
    </section>
  );
}
