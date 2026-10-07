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
  type North,
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
  lockRef,
}: {
  point?: Point;
  kind: "facing" | "sitting";
  onPreview: (
    angle: number | null,
    north?: North,
    stable?: boolean,
    status?: string,
  ) => void;
  onLock: (reading: Measurement) => void;
  locked: boolean;
  lockRef: { current: (() => void) | null };
}) {
  const app = useApp();
  const [state, setState] = useState<OrientationState>({
    active: false,
    status: "点击启动，允许方向权限，竖屏平放手机即可查看指南针。",
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
        const last = next.samples.at(-1);
        callbacks.current.onPreview(
          last && Date.now() - last.at <= 2000 ? q.angle : null,
          last?.north,
          q.stable,
          q.status,
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
      const latest = q.samples.at(-1);
      if (
        !q.stable ||
        q.angle === null ||
        !latest ||
        latest.north === "unknown"
      )
        throw new Error(q.status);
      const referenceNorth = c?.north || latest.north;
      const measurement: Measurement = {
        id: uid(),
        pointId: point.id,
        object: point.object,
        kind,
        rawAngle: q.angle,
        rawNorth: referenceNorth,
        angle: q.angle,
        north: referenceNorth,
        source: `${c ? "人工参考校准" : "设备指南针"} · ${latest.source}`,
        calibration: c ? structuredClone(c) : undefined,
        createdAt: nowISO(),
        timezone: timezone(),
        ruleVersion: RULE_VERSION,
        samples: structuredClone(q.samples),
        quality: {
          status: `${c ? "人工参考校准" : "设备报告北向"} · ` + q.status,
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
  lockRef.current = lock;
  return (
    <section className="card device-panel">
      <h2>手机指南针</h2>
      <p
        role="status"
        className={quality.stable ? "success-text" : "warning-text"}
      >
        {state.status}
      </p>
      <p className="muted">
        手机顶部指向测量方向。支持罗盘的设备直接显示读数；只有相对姿态的设备需先校准。设备报告的北向与精度建议用实体罗盘复核。
      </p>
      <div className="button-row">
        {!active ? (
          <button
            className="primary"
            disabled={locked || state.status === "等待设备权限"}
            onClick={() => void session.current?.start()}
          >
            启动设备检测
          </button>
        ) : (
          <>
            <button onClick={() => session.current?.stop()}>
              停止设备检测
            </button>
            {(!last || Date.now() - last.at > 2000) && (
              <button onClick={() => void session.current?.start()}>
                重新启动指南针
              </button>
            )}
          </>
        )}
      </div>
      {active && (
        <>
          {last && (
            <div className="quality-card">
              <div>
                <strong>
                  {Date.now() - last.at <= 2000 && quality.angle != null
                    ? `${quality.angle.toFixed(1)}° · ${NORTH_LABEL[last.north]}`
                    : "等待新鲜方向数据"}
                </strong>
                <p>
                  {last.north === "unknown"
                    ? "当前为相对角度，校准后才能作为方位测量。"
                    : `${state.calibration ? "人工参考校准" : "设备报告北向"} · ${quality.status}`}
                </p>
              </div>
            </div>
          )}
          <details open={last?.north === "unknown"}>
            <summary>校准方向（相对姿态设备必需）</summary>
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
          </details>
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
            {state.calibration ? "锁定校准测量" : "锁定设备测量"}
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
              : `设备报告${NORTH_LABEL[last.north]}`}{" "}
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
