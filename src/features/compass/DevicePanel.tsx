import { useEffect, useRef, useState } from "react";
import { useActivity } from "../../App";
import {
  OrientationSession,
  type OrientationState,
} from "../../adapters/orientation";
export function DevicePanel() {
  const [state, setState] = useState<OrientationState>({
    active: false,
    status: "手机来源尚未完成实机对照，正式方向请使用实体罗盘手录",
    samples: [],
    started: 0,
  });
  const session = useRef<OrientationSession | null>(null);
  useActivity(
    "device-sampling",
    state.active || state.status === "等待设备权限",
  );
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
      setState,
    );
    session.current = current;
    const hidden = () => {
      if (document.hidden) current.stop();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      current.stop();
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  const last = state.samples.at(-1);
  return (
    <section className="card device-panel">
      <h2>设备方向检测</h2>
      <p role="status" className="warning-text">
        {state.status}
      </p>
      <p className="muted">
        检测接口与采样状态。当前传感器数据不用于正式定向，磁北基准和精度须通过实机对照。
      </p>
      <div className="button-row">
        {!state.active ? (
          <button onClick={() => void session.current?.start()}>
            启动设备检测
          </button>
        ) : (
          <button onClick={() => session.current?.stop()}>停止设备检测</button>
        )}
      </div>
      {last && (
        <details>
          <summary>设备来源与采样详情</summary>
          <p>{last.source}</p>
          <p>
            参考北：未知 · 样本 {state.samples.length} · 设备精度{" "}
            {last.accuracy == null ? "未知" : `±${last.accuracy}°`}
          </p>
          <p>
            竖屏：{last.portrait ? "是" : "否"} · 倾斜 {last.beta ?? "未知"}°／
            {last.gamma ?? "未知"}°
          </p>
        </details>
      )}
    </section>
  );
}
