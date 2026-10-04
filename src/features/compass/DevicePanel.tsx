import { useEffect, useRef, useState } from "react";
import { useApp, useActivity } from "../../App";
import {
  OrientationSession,
  type OrientationState,
} from "../../adapters/orientation";
import {
  sampleQuality,
  parseAngle,
  NORTH_LABEL,
  RULE_VERSION,
  type KnownNorth,
} from "../../domain/direction";
import {
  nowISO,
  timezone,
  uid,
  type Point,
  type Measurement,
} from "../../domain/model";
export function DevicePanel({
  point,
  kind,
  onPreview,
  onLock,
  locked,
}: {
  point?: Point;
  kind: "facing" | "sitting";
  onPreview: (angle: number | null, north?: KnownNorth) => void;
  onLock: (reading: Measurement) => void;
  locked: boolean;
}) {
  const app = useApp();
  const [state, setState] = useState<OrientationState>({
    active: false,
    status:
      "设备姿态角不一定以北为零。对准实体罗盘或已知方向校准后，可连续测量。",
    samples: [],
    started: 0,
  });
  const [reference, setReference] = useState("");
  const [north, setNorth] = useState<KnownNorth>("magnetic");
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const session = useRef<OrientationSession | null>(null);
  const callbacks = useRef({ onPreview, onLock });
  callbacks.current = { onPreview, onLock };
  const active = state.active;
  useActivity("device-sampling", active || state.status === "等待设备权限");
  useEffect(() => {
    const ctor =
      window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: (absolute?: boolean) => Promise<string>;
      };
    const current = new OrientationSession(
      {
        target: window,
        supported: typeof ctor !== "undefined",
        secure: isSecureContext,
        permission:
          typeof ctor?.requestPermission === "function"
            ? () => ctor.requestPermission!(true)
            : undefined,
        portrait: () => matchMedia("(orientation: portrait)").matches,
        now: () => Date.now(),
      },
      (next) => {
        setState(next);
        const q = sampleQuality(next.samples, Date.now(), next.started);
        callbacks.current.onPreview(
          next.calibration ? q.angle : null,
          next.calibration?.north,
        );
      },
    );
    session.current = current;
    const hidden = () => {
      if (document.hidden) current.stop();
    };
    const rotated = () => {
      if (current.state.active) current.stop();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("orientationchange", rotated);
    return () => {
      current.stop();
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("orientationchange", rotated);
    };
  }, []);
  const quality = sampleQuality(state.samples, Date.now(), state.started);
  const last = state.samples.at(-1);
  function calibrate() {
    try {
      session.current?.calibrate(parseAngle(reference), north, source);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function lock() {
    try {
      if (!point) throw new Error("请先选择项目与测点");
      const q = sampleQuality(
        session.current!.state.samples,
        Date.now(),
        session.current!.state.started,
      );
      const c = session.current!.state.calibration;
      if (!q.stable || q.angle === null || !c) throw new Error(q.status);
      const measurement: Measurement = {
        id: uid(),
        pointId: point.id,
        object: point.object,
        kind,
        rawAngle: q.angle,
        rawNorth: c.north,
        angle: q.angle,
        north: c.north,
        source: `人工参考校准 · ${last?.source || c.adapter}`,
        calibration: structuredClone(c),
        createdAt: nowISO(),
        timezone: timezone(),
        ruleVersion: RULE_VERSION,
        samples: structuredClone(q.samples),
        quality: {
          status: "人工参考校准 · " + q.status,
          accuracy: q.accuracy,
          spread: q.spread,
          count: q.count,
          version: q.version,
        },
      };
      callbacks.current.onLock(measurement);
      session.current?.stop();
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="card device-panel">
      <h2>设备测量与校准</h2>
      <p
        role="status"
        className={quality.stable ? "success-text" : "warning-text"}
      >
        {state.status}
      </p>
      <p className="muted">
        先对准一个明确的已知方向，填写实体罗盘或图纸参考读数。校准基准用于本次会话，切后台或改变姿态后需重新校准。
      </p>
      <div className="button-row">
        {!active ? (
          <button
            disabled={locked}
            onClick={() => void session.current?.start()}
          >
            启动设备检测
          </button>
        ) : (
          <button onClick={() => session.current?.stop()}>停止设备检测</button>
        )}
      </div>
      {active && (
        <>
          <fieldset disabled={locked}>
            <legend>人工参考校准</legend>
            <label>
              已知参考角度（度）
              <input
                type="number"
                min="0"
                max="360"
                step="any"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="保持手机指向参考方向，例如 180°"
              />
            </label>
            <label>
              校准参考北
              <select
                value={north}
                onChange={(e) => setNorth(e.target.value as KnownNorth)}
              >
                <option value="magnetic">磁北</option>
                <option value="true">真北</option>
              </select>
            </label>
            <label>
              校准依据
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="例如：实体罗盘读数，或已确认的图纸北向"
              />
            </label>
            <button onClick={calibrate} disabled={!last}>
              对准参考方向并校准
            </button>
          </fieldset>
          {state.calibration && (
            <div className="quality-card">
              <div>
                <strong>
                  人工参考{NORTH_LABEL[state.calibration.north]} ·{" "}
                  {quality.angle == null
                    ? "等待采样"
                    : `${quality.angle.toFixed(1)}°`}
                </strong>
                <p>
                  样本 {quality.count} · 离散度{" "}
                  {quality.spread === Infinity
                    ? "未知"
                    : quality.spread.toFixed(2)}
                  ° · 精度{" "}
                  {quality.accuracy == null ? "未知" : `±${quality.accuracy}°`}
                </p>
                <p>校准来源：{state.calibration.source}</p>
              </div>
            </div>
          )}
          <button
            className="primary"
            disabled={
              !quality.stable || !point || locked || app.mode === "readonly"
            }
            onClick={lock}
          >
            锁定校准测量
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      {last && (
        <details>
          <summary>设备来源与原始采样详情</summary>
          <p>
            {last.source} · 原始设备角度 {last.deviceAngle.toFixed(1)}°
          </p>
          <p>
            参考北：
            {state.calibration
              ? `人工参考${NORTH_LABEL[state.calibration.north]}`
              : "未校准"}{" "}
            · 竖屏：{last.portrait ? "是" : "否"}
          </p>
          <p>
            倾斜 {last.beta ?? "未知"}°／{last.gamma ?? "未知"}° · 设备精度{" "}
            {last.accuracy == null ? "未知" : `±${last.accuracy}°`}
          </p>
        </details>
      )}
    </section>
  );
}
