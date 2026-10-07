import {
  normalize,
  sampleQuality,
  type Sample,
  type KnownNorth,
} from "../domain/direction";
export interface OrientationReading {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  absolute: boolean;
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}
export interface Calibration {
  id: string;
  rawAnchor: number;
  referenceAngle: number;
  north: KnownNorth;
  offset: number;
  source: string;
  adapter: string;
  createdAt: string;
}
export interface DeviceSample extends Sample {
  deviceAngle: number;
  adapter: string;
}
export interface OrientationEnvironment {
  target: EventTarget;
  supported: boolean;
  secure: boolean;
  permission?: () => Promise<string>;
  portrait: () => boolean;
  now: () => number;
}
export interface OrientationState {
  active: boolean;
  status: string;
  samples: DeviceSample[];
  started: number;
  calibration?: Calibration;
}
export class OrientationSession {
  state: OrientationState = {
    active: false,
    status: "尚未启动设备检测",
    samples: [],
    started: 0,
  };
  private timer: ReturnType<typeof setTimeout> | undefined;
  private tick: ReturnType<typeof setInterval> | undefined;
  private generation = 0;
  private adapter: string | undefined;
  constructor(
    private readonly env: OrientationEnvironment,
    private readonly notify: (state: OrientationState) => void,
  ) {}
  private publish() {
    this.notify(structuredClone(this.state));
  }
  private event = (event: Event) => {
    if (!this.state.active) return;
    const reading = event as Event & OrientationReading;
    const webkit =
      typeof reading.webkitCompassHeading === "number" &&
      Number.isFinite(reading.webkitCompassHeading);
    const alpha =
      typeof reading.alpha === "number" && Number.isFinite(reading.alpha);
    const adapter = webkit
      ? "webkit-compass"
      : alpha
        ? reading.absolute || event.type === "deviceorientationabsolute"
          ? "absolute-alpha"
          : "relative-alpha"
        : null;
    const heading = webkit
      ? normalize(reading.webkitCompassHeading!)
      : alpha
        ? normalize(360 - reading.alpha!)
        : null;
    if (heading === null || adapter === null) return;
    // 固定会话来源；绝对事件与普通事件不混合成一个采样窗口。
    if (this.adapter && this.adapter !== adapter) {
      const priority: Record<string, number> = {
        "relative-alpha": 1,
        "absolute-alpha": 2,
        "webkit-compass": 3,
      };
      if (priority[adapter] <= priority[this.adapter]) return;
      this.state.started = this.env.now();
      if (this.state.calibration) {
        this.state.calibration = undefined;
        this.state.samples = [];
        this.state.status = "设备来源变化，原校准已失效，请重新校准";
        this.adapter = adapter;
      } else {
        this.state.samples = [];
      }
    }
    this.adapter = adapter;
    clearTimeout(this.timer);
    const now = this.env.now();
    const portrait = this.env.portrait();
    const pose =
      portrait &&
      reading.beta != null &&
      reading.gamma != null &&
      Math.abs(reading.beta) <= 15 &&
      Math.abs(reading.gamma) <= 15;
    if (this.state.calibration && !pose) {
      this.state.calibration = undefined;
      this.state.samples = [];
      this.state.status = "姿态变化，原校准已失效，请竖屏平放后重新校准";
    }
    const calibration = this.state.calibration;
    const sample: DeviceSample = {
      deviceAngle: heading,
      adapter,
      angle: calibration ? normalize(heading + calibration.offset) : heading,
      at: now,
      beta: reading.beta,
      gamma: reading.gamma,
      north:
        calibration?.north ||
        (webkit
          ? "magnetic"
          : adapter === "absolute-alpha"
            ? "true"
            : "unknown"),
      portrait,
      accuracy:
        webkit &&
        typeof reading.webkitCompassAccuracy === "number" &&
        Number.isFinite(reading.webkitCompassAccuracy) &&
        reading.webkitCompassAccuracy >= 0
          ? reading.webkitCompassAccuracy
          : null,
      source:
        adapter === "webkit-compass"
          ? "WebKit 罗盘扩展"
          : adapter === "absolute-alpha"
            ? "绝对方向事件"
            : "相对姿态事件",
    };
    this.state.samples = [
      ...this.state.samples.filter((s) => s.at >= now - 3000),
      sample,
    ].slice(-300);
    if (sample.north !== "unknown")
      this.state.status = sampleQuality(
        this.state.samples,
        now,
        this.state.started,
      ).status;
    else if (pose)
      this.state.status = "收到相对姿态。先对准已知方向校准，或手工录入";
    else this.state.status = "请竖屏平放手机，收到稳定读数后再校准";
    this.publish();
  };
  calibrate(referenceAngle: number, north: KnownNorth, source: string) {
    const last = this.state.samples.at(-1);
    const now = this.env.now();
    if (!this.state.active || !last || now - last.at > 2000)
      throw new Error("请先启动设备检测并等待新鲜读数");
    if (
      !last.portrait ||
      last.beta == null ||
      last.gamma == null ||
      Math.abs(last.beta) > 15 ||
      Math.abs(last.gamma) > 15
    )
      throw new Error("校准时请竖屏平放手机");
    if (
      !Number.isFinite(referenceAngle) ||
      referenceAngle < 0 ||
      referenceAngle > 360 ||
      !["magnetic", "true"].includes(north) ||
      !source.trim()
    )
      throw new Error("请填写已知参考角度、参考北与来源");
    if (last.accuracy != null && last.accuracy > 5)
      throw new Error("设备报告精度不足，请移开金属干扰并复测，或使用手录");
    this.state.calibration = {
      id: crypto.randomUUID(),
      rawAnchor: last.deviceAngle,
      referenceAngle: normalize(referenceAngle),
      north,
      offset: normalize(referenceAngle - last.deviceAngle),
      source: source.trim(),
      adapter: last.adapter,
      createdAt: new Date(now).toISOString(),
    };
    this.state.samples = [];
    this.state.started = now;
    this.state.status = "校准完成，正在重新采样";
    this.publish();
  }
  restartWindow() {
    if (!this.state.active) return;
    this.state.samples = [];
    this.state.started = this.env.now();
    this.state.status = this.state.calibration ? "重新采样中" : "请重新校准";
    this.publish();
  }
  async start() {
    this.stop();
    const generation = this.generation;
    if (!this.env.secure) {
      this.state.status = "设备检测需要 HTTPS 安全页面，手录仍可使用";
      this.publish();
      return;
    }
    if (!this.env.supported) {
      this.state.status = "此浏览器没有方向接口，请使用实体罗盘手录";
      this.publish();
      return;
    }
    this.state.status = "等待设备权限";
    this.publish();
    try {
      if (this.env.permission && (await this.env.permission()) !== "granted") {
        if (generation !== this.generation) return;
        this.state.status =
          "方向权限被拒绝：请在浏览器的网站设置中允许运动与方向访问，再重试；手录仍可使用";
        this.publish();
        return;
      }
    } catch {
      if (generation !== this.generation) return;
      this.state.status = "方向权限申请失败，手录仍可使用";
      this.publish();
      return;
    }
    if (generation !== this.generation) return;
    this.state = {
      active: true,
      status: "等待方向数据",
      samples: [],
      started: this.env.now(),
    };
    this.env.target.addEventListener("deviceorientation", this.event);
    this.env.target.addEventListener("deviceorientationabsolute", this.event);
    this.timer = setTimeout(() => {
      this.state.status =
        "5 秒未收到有效方向数据：请在手机 Safari 或 Chrome 中打开，检查运动传感器权限后重试；手录仍可使用";
      this.publish();
    }, 5000);
    this.tick = setInterval(() => {
      if (this.state.samples.length) {
        this.state.status = sampleQuality(
          this.state.samples,
          this.env.now(),
          this.state.started,
        ).status;
        this.publish();
      }
    }, 500);
    this.publish();
  }
  stop() {
    this.generation++;
    clearTimeout(this.timer);
    clearInterval(this.tick);
    this.env.target.removeEventListener("deviceorientation", this.event);
    this.env.target.removeEventListener(
      "deviceorientationabsolute",
      this.event,
    );
    this.adapter = undefined;
    this.state = {
      active: false,
      status: "采集已停止，重新启动后重新校准",
      samples: [],
      started: 0,
    };
    this.publish();
  }
}
