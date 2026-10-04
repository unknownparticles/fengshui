import { afterEach, describe, expect, it, vi } from "vitest";
import { OrientationSession, type OrientationEnvironment } from "./orientation";
describe("传感器能力与权限降级", () => {
  afterEach(() => vi.useRealTimers());
  const setup = (override: Partial<OrientationEnvironment> = {}) => {
    const target = new EventTarget();
    const session = new OrientationSession(
      {
        target,
        supported: true,
        secure: true,
        portrait: () => true,
        now: () => Date.now(),
        ...override,
      },
      () => {},
    );
    return { session, target };
  };
  it("拒绝权限、缺接口与非安全页面保持手录可用", async () => {
    for (const env of [
      { permission: async () => "denied" },
      { supported: false },
      { secure: false },
    ]) {
      const { session } = setup(env);
      await session.start();
      expect(session.state.active).toBe(false);
      expect(session.state.status).toMatch(/手录/);
    }
  });
  it("无数据超时并在停止后移除监听器", async () => {
    vi.useFakeTimers();
    const { session, target } = setup();
    await session.start();
    vi.advanceTimersByTime(5000);
    expect(session.state.status).toContain("5 秒");
    session.stop();
    const event = new Event("deviceorientation");
    Object.assign(event, {
      alpha: 0,
      beta: 0,
      gamma: 0,
      absolute: true,
      webkitCompassHeading: 0,
    });
    target.dispatchEvent(event);
    expect(session.state.samples).toHaveLength(0);
  });
  it("扩展存在仍保持未知参考北，相对 alpha 不当罗盘", async () => {
    const { session, target } = setup();
    await session.start();
    const relative = new Event("deviceorientation");
    Object.assign(relative, { alpha: 20, beta: 0, gamma: 0, absolute: false });
    target.dispatchEvent(relative);
    expect(session.state.status).toContain("相对姿态");
    const heading = new Event("deviceorientation");
    Object.assign(heading, {
      alpha: 0,
      beta: 0,
      gamma: 0,
      absolute: true,
      webkitCompassHeading: 359,
      webkitCompassAccuracy: 10,
    });
    target.dispatchEvent(heading);
    expect(session.state.samples[0].north).toBe("unknown");
    expect(session.state.status).toContain("北向");
    session.stop();
  });
  it("权限仍在等待时停止，稍后授予也不重新采集", async () => {
    let grant!: (value: string) => void;
    const { session } = setup({
      permission: () =>
        new Promise((resolve) => {
          grant = resolve;
        }),
    });
    const pending = session.start();
    session.stop();
    grant("granted");
    await pending;
    expect(session.state.active).toBe(false);
  });
});
