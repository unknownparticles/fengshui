import { normalize, sampleQuality, type Sample } from "../domain/direction";
export interface OrientationReading {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  absolute: boolean;
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
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
  samples: Sample[];
  started: number;
}
/** 无实机验证记录的适配器只提供待复核数据，不能声明磁北。 */
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
  constructor(
    private readonly env: OrientationEnvironment,
    private readonly notify: (state: OrientationState) => void,
  ) {}
  private publish() {
    this.notify(structuredClone(this.state));
  }
  private event = (event: Event) => {
    const reading = event as Event & OrientationReading;
    const heading = Number.isFinite(reading.webkitCompassHeading)
      ? reading.webkitCompassHeading
      : reading.absolute && Number.isFinite(reading.alpha)
        ? normalize(360 - reading.alpha!)
        : null;
    if (heading == null) {
      if (Number.isFinite(reading.alpha)) {
        this.state.status = "仅收到相对姿态，北向未知，建议手录";
        this.publish();
      }
      return;
    }
    clearTimeout(this.timer);
    const now = this.env.now();
    const sample: Sample = {
      angle: normalize(heading!),
      at: now,
      beta: reading.beta,
      gamma: reading.gamma,
      north: "unknown",
      portrait: this.env.portrait(),
      accuracy:
        reading.webkitCompassAccuracy != null &&
        Number.isFinite(reading.webkitCompassAccuracy) &&
        reading.webkitCompassAccuracy >= 0
          ? reading.webkitCompassAccuracy
          : null,
      source: Number.isFinite(reading.webkitCompassHeading)
        ? "WebKit 罗盘扩展（未实机验证）"
        : "绝对方向事件（未实机验证）",
    };
    this.state.samples = [
      ...this.state.samples.filter((s) => s.at >= now - 3000),
      sample,
    ].slice(-300);
    this.state.status = sampleQuality(
      this.state.samples,
      now,
      this.state.started,
    ).status;
    this.publish();
  };
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
        this.state.status = "方向权限被拒绝，手录仍可使用";
        this.publish();
        return;
      }
    } catch {
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
      this.state.status = "5 秒未收到有效方向数据，请使用手录";
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
    this.state = {
      active: false,
      status: "采集已停止，重新启动后重新采样",
      samples: [],
      started: 0,
    };
    this.publish();
  }
}
