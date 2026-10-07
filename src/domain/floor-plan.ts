import { nowISO, uid } from "./model";
import { normalize, type KnownNorth } from "./direction";
export const FLOOR_PLAN_VERSION = "floor-plan-v1";
export type Wall = "north" | "east" | "south" | "west";
export type RoomUse = "客厅" | "卧室" | "厨房" | "卫生间" | "走廊" | "其他";
export const ROOM_USES: RoomUse[] = [
  "客厅",
  "卧室",
  "厨房",
  "卫生间",
  "走廊",
  "其他",
];
export const WALL_LABEL: Record<Wall, string> = {
  north: "图上侧",
  east: "图右侧",
  south: "图下侧",
  west: "图左侧",
};
export interface Room {
  id: string;
  name: string;
  use: RoomUse;
  x: number;
  y: number;
  width: number;
  height: number;
  ventilation: "unknown" | "comfortable" | "stuffy" | "drafty";
  daylight: "unknown" | "balanced" | "dark" | "glare";
  dampness: "unknown" | "dry" | "damp";
  notes: string;
}
export interface Opening {
  id: string;
  roomId: string;
  kind: "door" | "window";
  wall: Wall;
  position: number;
  width: number;
  toRoomId?: string;
  entrance: boolean;
  operable: boolean;
}
export interface Obstacle {
  id: string;
  roomId: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface FloorPlan {
  id: string;
  version: string;
  revision: number;
  parentId?: string;
  createdAt: string;
  width: number;
  height: number;
  rooms: Room[];
  openings: Opening[];
  obstacles: Obstacle[];
  topAngle?: number;
  north?: KnownNorth;
  layoutConfirmed: boolean;
  backgroundId?: string;
}
const snap = (value: number) => Math.round(value * 4) / 4;
export function makeRoom(
  name: string,
  use: RoomUse,
  x: number,
  y: number,
  width: number,
  height: number,
): Room {
  return {
    id: uid(),
    name,
    use,
    x,
    y,
    width,
    height,
    ventilation: "unknown",
    daylight: "unknown",
    dampness: "unknown",
    notes: "",
  };
}
export function templatePlan(
  template: "blank" | "one-bedroom" | "two-bedroom",
  width = 10,
  height = 8,
): FloorPlan {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 4 ||
    height < 4 ||
    width > 40 ||
    height > 40
  )
    throw new Error("户型宽深须在 4m 至 40m 之间");
  const plan: FloorPlan = {
    id: uid(),
    version: FLOOR_PLAN_VERSION,
    revision: 1,
    createdAt: nowISO(),
    width,
    height,
    rooms: [],
    openings: [],
    obstacles: [],
    layoutConfirmed: false,
  };
  if (template === "blank") return plan;
  const middle = snap(width / 2),
    lower = snap(height / 2);
  const living = makeRoom("客厅", "客厅", 0, 0, middle, height);
  const bedroom = makeRoom("卧室", "卧室", middle, 0, width - middle, lower);
  plan.rooms.push(living, bedroom);
  if (template === "two-bedroom") {
    const division = snap((width - middle) / 2);
    plan.rooms.push(
      makeRoom("次卧", "卧室", middle, lower, division, height - lower),
      makeRoom(
        "厨房",
        "厨房",
        middle + division,
        lower,
        width - middle - division,
        (height - lower) / 2,
      ),
      makeRoom(
        "卫生间",
        "卫生间",
        middle + division,
        lower + (height - lower) / 2,
        width - middle - division,
        (height - lower) / 2,
      ),
    );
  } else
    plan.rooms.push(
      makeRoom(
        "厨房",
        "厨房",
        middle,
        lower,
        (width - middle) / 2,
        height - lower,
      ),
      makeRoom(
        "卫生间",
        "卫生间",
        middle + (width - middle) / 2,
        lower,
        (width - middle) / 2,
        height - lower,
      ),
    );
  const add = (
    room: Room,
    kind: Opening["kind"],
    wall: Wall,
    position: number,
    toRoomId?: string,
    entrance = false,
  ) =>
    plan.openings.push({
      id: uid(),
      roomId: room.id,
      kind,
      wall,
      position,
      width:
        kind === "window"
          ? Math.min(
              1.4,
              (wall === "north" || wall === "south"
                ? room.width
                : room.height) * 0.6,
            )
          : 0.8,
      toRoomId,
      entrance,
      operable: true,
    });
  add(living, "door", "south", 0.5, undefined, true);
  add(living, "window", "north", 0.5);
  add(bedroom, "door", "west", 0.5, living.id);
  add(bedroom, "window", "north", 0.5);
  for (const room of plan.rooms.slice(2)) {
    const westNeighbor = plan.rooms.find(
      (other) =>
        other.id !== room.id &&
        Math.abs(other.x + other.width - room.x) < 0.01 &&
        Math.min(other.y + other.height, room.y + room.height) >
          Math.max(other.y, room.y) + 0.8,
    );
    if (westNeighbor) add(room, "door", "west", 0.5, westNeighbor.id);
    if (room.x + room.width === width) add(room, "window", "east", 0.5);
  }
  return plan;
}
export function openingGeometry(plan: FloorPlan, opening: Opening) {
  const room = plan.rooms.find((r) => r.id === opening.roomId);
  if (!room) throw new Error("门窗关联房间不存在");
  const horizontal = opening.wall === "north" || opening.wall === "south";
  const length = horizontal ? room.width : room.height;
  const coordinate = opening.position * length;
  const center = {
    x: horizontal
      ? room.x + coordinate
      : opening.wall === "west"
        ? room.x
        : room.x + room.width,
    y: horizontal
      ? opening.wall === "north"
        ? room.y
        : room.y + room.height
      : room.y + coordinate,
  };
  return {
    center,
    start: {
      x: center.x - (horizontal ? opening.width / 2 : 0),
      y: center.y - (horizontal ? 0 : opening.width / 2),
    },
    end: {
      x: center.x + (horizontal ? opening.width / 2 : 0),
      y: center.y + (horizontal ? 0 : opening.width / 2),
    },
  };
}
export function neighboringRooms(plan: FloorPlan, opening: Opening): Room[] {
  const own = plan.rooms.find((r) => r.id === opening.roomId);
  if (!own) return [];
  const { start, end, center } = openingGeometry(plan, opening);
  const epsilon = 0.01;
  return plan.rooms.filter((r) => {
    if (r.id === own.id) return false;
    if (opening.wall === "west")
      return (
        Math.abs(r.x + r.width - center.x) < epsilon &&
        start.y >= r.y - epsilon &&
        end.y <= r.y + r.height + epsilon
      );
    if (opening.wall === "east")
      return (
        Math.abs(r.x - center.x) < epsilon &&
        start.y >= r.y - epsilon &&
        end.y <= r.y + r.height + epsilon
      );
    if (opening.wall === "north")
      return (
        Math.abs(r.y + r.height - center.y) < epsilon &&
        start.x >= r.x - epsilon &&
        end.x <= r.x + r.width + epsilon
      );
    return (
      Math.abs(r.y - center.y) < epsilon &&
      start.x >= r.x - epsilon &&
      end.x <= r.x + r.width + epsilon
    );
  });
}
function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return (
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.001 &&
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.001
  );
}
export function planIssues(plan: FloorPlan): string[] {
  const issues: string[] = [];
  if (
    !Number.isFinite(plan.width) ||
    !Number.isFinite(plan.height) ||
    plan.width < 4 ||
    plan.height < 4 ||
    plan.width > 40 ||
    plan.height > 40
  )
    issues.push("户型宽深须在 4m 至 40m 之间");
  if (plan.rooms.length === 0) issues.push("请至少添加一个房间");
  if (
    plan.rooms.length > 50 ||
    plan.openings.length > 150 ||
    plan.obstacles.length > 100
  )
    issues.push("房间或门窗数量超限");
  const ids = new Set<string>();
  for (const item of [...plan.rooms, ...plan.openings, ...plan.obstacles]) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(item.id) || ids.has(item.id))
      issues.push("户型元素标识不合法或重复");
    ids.add(item.id);
  }
  for (const room of plan.rooms) {
    if (!room.name.trim() || !ROOM_USES.includes(room.use))
      issues.push("请填写房间名称与用途");
    if (
      ![room.x, room.y, room.width, room.height].every(Number.isFinite) ||
      room.x < 0 ||
      room.y < 0 ||
      room.width < (room.use === "走廊" ? 0.5 : 1) ||
      room.height < (room.use === "走廊" ? 0.5 : 1) ||
      room.x + room.width > plan.width + 0.001 ||
      room.y + room.height > plan.height + 0.001
    )
      issues.push(`${room.name}尺寸不足、越界或位置无效`);
    for (const other of plan.rooms)
      if (other.id > room.id && overlaps(room, other))
        issues.push(`${room.name}与${other.name}重叠`);
    if (
      !["unknown", "comfortable", "stuffy", "drafty"].includes(
        room.ventilation,
      ) ||
      !["unknown", "balanced", "dark", "glare"].includes(room.daylight) ||
      !["unknown", "dry", "damp"].includes(room.dampness) ||
      typeof room.notes !== "string"
    )
      issues.push(`${room.name}观察记录无效`);
  }
  for (const opening of plan.openings) {
    const room = plan.rooms.find((r) => r.id === opening.roomId);
    if (!room) {
      issues.push("门窗关联房间不存在");
      continue;
    }
    if (
      !["north", "east", "south", "west"].includes(opening.wall) ||
      !["door", "window"].includes(opening.kind) ||
      typeof opening.operable !== "boolean" ||
      typeof opening.entrance !== "boolean"
    ) {
      issues.push("门窗类型无效");
      continue;
    }
    const length =
      opening.wall === "north" || opening.wall === "south"
        ? room.width
        : room.height;
    if (
      !Number.isFinite(opening.position) ||
      !Number.isFinite(opening.width) ||
      opening.width < 0.3 ||
      opening.position * length - opening.width / 2 < -0.001 ||
      opening.position * length + opening.width / 2 > length + 0.001
    )
      issues.push(`${room.name}门窗宽度或位置超出墙面`);
    const adjacent = neighboringRooms(plan, opening);
    if (opening.toRoomId && !adjacent.some((r) => r.id === opening.toRoomId))
      issues.push(`${room.name}内门须完整连到邻接房间`);
    if (opening.kind === "window" && opening.toRoomId)
      issues.push("窗户不能用作内部门路");
    if (opening.entrance && (opening.kind !== "door" || opening.toRoomId))
      issues.push("入口必须是外门");
    if (!opening.toRoomId && adjacent.length)
      issues.push(`${room.name}开口位于内墙，请关联房间或换到外墙`);
  }
  if (plan.openings.filter((o) => o.entrance).length > 1)
    issues.push("请只标注一个评估主入口");
  for (const obstacle of plan.obstacles) {
    const room = plan.rooms.find((r) => r.id === obstacle.roomId);
    if (
      !room ||
      ![obstacle.x, obstacle.y, obstacle.width, obstacle.height].every(
        Number.isFinite,
      ) ||
      obstacle.width <= 0 ||
      obstacle.height <= 0 ||
      obstacle.x < room.x ||
      obstacle.y < room.y ||
      obstacle.x + obstacle.width > room.x + room.width + 0.001 ||
      obstacle.y + obstacle.height > room.y + room.height + 0.001
    )
      issues.push("障碍物须位于所属房间内");
  }
  if (
    plan.topAngle != null &&
    (!Number.isFinite(plan.topAngle) ||
      plan.topAngle < 0 ||
      plan.topAngle >= 360 ||
      !["magnetic", "true"].includes(plan.north || ""))
  )
    issues.push("图顶方向须有合法角度及参考北");
  return [...new Set(issues)];
}
export function validateFloorPlan(plan: FloorPlan) {
  if (
    plan.version !== FLOOR_PLAN_VERSION ||
    !Number.isInteger(plan.revision) ||
    plan.revision < 1 ||
    !Number.isFinite(Date.parse(plan.createdAt)) ||
    typeof plan.layoutConfirmed !== "boolean" ||
    !Array.isArray(plan.rooms) ||
    !Array.isArray(plan.openings) ||
    !Array.isArray(plan.obstacles)
  )
    throw new Error("户型版本或结构不完整");
  const issues = planIssues(plan);
  if (
    plan.backgroundId != null &&
    !/^[a-zA-Z0-9_-]{1,100}$/.test(plan.backgroundId)
  )
    throw new Error("底图标识不合法");
  if (issues.length) throw new Error(issues.join("；"));
}
export interface PlanPoint {
  x: number;
  y: number;
}
export function drawnRoom(
  plan: FloorPlan,
  from: PlanPoint,
  to: PlanPoint,
  name: string,
  use: RoomUse,
): Room {
  const limit = (point: PlanPoint) => ({
    x: Math.min(plan.width, snap(Math.max(0, point.x))),
    y: Math.min(plan.height, snap(Math.max(0, point.y))),
  });
  const a = limit(from),
    b = limit(to);
  const room = makeRoom(
    name,
    use,
    Math.min(a.x, b.x),
    Math.min(a.y, b.y),
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
  );
  const issues = planIssues({ ...plan, rooms: [...plan.rooms, room] });
  if (issues.length) throw new Error(issues.join("；"));
  return room;
}
export function openingAt(
  plan: FloorPlan,
  roomId: string,
  point: PlanPoint,
  kind: Opening["kind"],
  entrance = false,
): Opening {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room) throw new Error("请点选房间的墙面");
  const walls: [Wall, number][] = [
    ["north", Math.abs(point.y - room.y)],
    ["south", Math.abs(point.y - room.y - room.height)],
    ["west", Math.abs(point.x - room.x)],
    ["east", Math.abs(point.x - room.x - room.width)],
  ];
  walls.sort((a, b) => a[1] - b[1]);
  const [wall, distance] = walls[0];
  if (distance > 0.4) throw new Error("请点击房间边缘的墙线添加门窗");
  const horizontal = wall === "north" || wall === "south";
  const length = horizontal ? room.width : room.height;
  const width = Math.min(kind === "door" ? 0.8 : 1.2, length * 0.8);
  const offset = horizontal ? point.x - room.x : point.y - room.y;
  const opening: Opening = {
    id: uid(),
    roomId,
    kind,
    wall,
    width,
    position:
      Math.max(width / 2, Math.min(length - width / 2, offset)) / length,
    entrance,
    operable: true,
  };
  const neighbors = neighboringRooms(plan, opening);
  if (neighbors.length) {
    if (kind === "window") throw new Error("此处是内墙，请把窗放在外墙上");
    if (entrance) throw new Error("主入口须放在连接外部空间的墙面上");
    opening.toRoomId = neighbors[0].id;
  }
  if (
    plan.openings.some(
      (o) =>
        o.roomId === roomId &&
        o.wall === wall &&
        Math.abs(o.position - opening.position) * length <
          (o.width + width) / 2,
    )
  )
    throw new Error("此处已有门窗，请选择墙面上的其他位置");
  const next = {
    ...plan,
    openings: [
      ...plan.openings.map((o) => (entrance ? { ...o, entrance: false } : o)),
      opening,
    ],
  };
  const issues = planIssues(next);
  if (issues.length) throw new Error(issues.join("；"));
  return opening;
}
export const diagramBearing = (plan: FloorPlan, dx: number, dy: number) =>
  plan.topAngle == null
    ? null
    : normalize((Math.atan2(dx, -dy) * 180) / Math.PI + plan.topAngle);
export function moveRoom(
  plan: FloorPlan,
  id: string,
  x: number,
  y: number,
): FloorPlan {
  const next = structuredClone(plan);
  const room = next.rooms.find((r) => r.id === id);
  if (!room) return next;
  const newX = Math.max(0, Math.min(plan.width - room.width, snap(x))),
    newY = Math.max(0, Math.min(plan.height - room.height, snap(y)));
  const dx = newX - room.x,
    dy = newY - room.y;
  room.x = newX;
  room.y = newY;
  next.obstacles
    .filter((o) => o.roomId === id)
    .forEach((o) => {
      o.x += dx;
      o.y += dy;
    });
  return next;
}
