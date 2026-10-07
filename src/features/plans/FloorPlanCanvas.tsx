import { useRef, useState } from "react";
import {
  openingGeometry,
  ROOM_USES,
  type FloorPlan,
  type PlanPoint,
} from "../../domain/floor-plan";
import type { QiFinding } from "../../domain/indoor-qi";
const COLORS = [
  "#edf3e9",
  "#f6eedf",
  "#edf0f7",
  "#f0e7e2",
  "#f2efe3",
  "#ecede7",
];
export type PlanTool =
  "select" | "room" | "corridor" | "door" | "window" | "entrance";
export function FloorPlanCanvas({
  plan,
  selected,
  onSelect,
  onMove,
  onResize,
  onDraw,
  onPlace,
  onOpeningSelect,
  onEditStart,
  tool = "select",
  background,
  backgroundOpacity = 0.65,
  findings = [],
}: {
  plan: FloorPlan;
  selected?: string;
  onSelect?: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onDraw?: (from: PlanPoint, to: PlanPoint) => void;
  onPlace?: (id: string, point: PlanPoint) => void;
  onOpeningSelect?: (id: string) => void;
  onEditStart?: () => void;
  tool?: PlanTool;
  background?: string;
  backgroundOpacity?: number;
  findings?: QiFinding[];
}) {
  const svg = useRef<SVGSVGElement | null>(null);
  const dragging = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const drawing = useRef<PlanPoint | null>(null);
  const resizing = useRef<string | null>(null);
  const [preview, setPreview] = useState<{
    from: PlanPoint;
    to: PlanPoint;
  } | null>(null);
  const cancel = () => {
    dragging.current = null;
    drawing.current = null;
    resizing.current = null;
    setPreview(null);
  };
  const locate = (x: number, y: number) => {
    const element = svg.current!;
    const point = element.createSVGPoint();
    point.x = x;
    point.y = y;
    const matrix = element.getScreenCTM();
    return matrix ? point.matrixTransform(matrix.inverse()) : point;
  };
  return (
    <svg
      ref={svg}
      className="floor-plan-canvas"
      style={{
        touchAction: onMove || onDraw || onPlace ? "none" : "auto",
        cursor: tool === "select" ? undefined : "crosshair",
      }}
      viewBox={`-.6 -.6 ${plan.width + 1.2} ${plan.height + 1.2}`}
      role="img"
      aria-label={`户型示意，${plan.rooms.length} 个房间，${plan.width}m × ${plan.height}m`}
      tabIndex={onDraw ? 0 : undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape") cancel();
      }}
      onPointerDown={(e) => {
        if (e.button !== 0 || !e.isPrimary) return;
        const point = locate(e.clientX, e.clientY);
        if ((tool === "room" || tool === "corridor") && onDraw) {
          drawing.current = point;
          setPreview({ from: point, to: point });
          e.currentTarget.setPointerCapture(e.pointerId);
        } else if (onPlace && ["door", "window", "entrance"].includes(tool)) {
          const room = plan.rooms.find(
            (r) =>
              point.x >= r.x - 0.05 &&
              point.x <= r.x + r.width + 0.05 &&
              point.y >= r.y - 0.05 &&
              point.y <= r.y + r.height + 0.05,
          );
          onPlace(room?.id || "", point);
        }
      }}
      onPointerMove={(e) => {
        const point = locate(e.clientX, e.clientY);
        if (drawing.current) {
          setPreview({ from: drawing.current, to: point });
          return;
        }
        if (resizing.current && onResize) {
          const room = plan.rooms.find((r) => r.id === resizing.current)!;
          onResize(room.id, point.x - room.x, point.y - room.y);
          return;
        }
        if (!dragging.current || !onMove) return;
        onMove(
          dragging.current.id,
          point.x - dragging.current.offsetX,
          point.y - dragging.current.offsetY,
        );
      }}
      onPointerUp={(e) => {
        if (drawing.current)
          onDraw?.(drawing.current, locate(e.clientX, e.clientY));
        cancel();
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
    >
      <defs>
        <pattern
          id={`grid-${plan.id}`}
          width=".25"
          height=".25"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M .25 0 H 0 V .25"
            fill="none"
            stroke="#dfe5dd"
            strokeWidth=".012"
          />
        </pattern>
      </defs>
      <rect
        x="0"
        y="0"
        width={plan.width}
        height={plan.height}
        fill={`url(#grid-${plan.id})`}
        stroke="#66796d"
        strokeWidth=".04"
      />
      {background && (
        <image
          href={background}
          x="0"
          y="0"
          width={plan.width}
          height={plan.height}
          preserveAspectRatio="none"
          opacity={backgroundOpacity}
          pointerEvents="none"
        />
      )}
      {plan.rooms.map((room) => (
        <g
          key={room.id}
          onPointerDown={(e) => {
            if (tool !== "select" || e.button !== 0 || !e.isPrimary) return;
            e.stopPropagation();
            onSelect?.(room.id);
            if (onMove) {
              onEditStart?.();
              const point = locate(e.clientX, e.clientY);
              dragging.current = {
                id: room.id,
                offsetX: point.x - room.x,
                offsetY: point.y - room.y,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }
          }}
          className={onMove ? "draggable-room" : ""}
        >
          <rect
            x={room.x}
            y={room.y}
            width={room.width}
            height={room.height}
            fill={COLORS[ROOM_USES.indexOf(room.use)] || COLORS[5]}
            fillOpacity={background ? 0.3 : 1}
            stroke={selected === room.id ? "#9c762a" : "#3f5146"}
            strokeWidth={selected === room.id ? 0.08 : 0.05}
          />
          <text
            x={room.x + room.width / 2}
            y={room.y + room.height / 2 - 0.12}
            textAnchor="middle"
            fill="#1f3528"
            fontSize=".3"
          >
            {room.name}
          </text>
          <text
            x={room.x + room.width / 2}
            y={room.y + room.height / 2 + 0.3}
            textAnchor="middle"
            fill="#4b5b51"
            fontSize=".2"
          >
            {room.width.toFixed(2)} × {room.height.toFixed(2)}m
          </text>
        </g>
      ))}
      {tool === "select" &&
        onResize &&
        plan.rooms
          .filter((r) => r.id === selected)
          .map((room) => (
            <rect
              key={`resize-${room.id}`}
              x={room.x + room.width - 0.22}
              y={room.y + room.height - 0.22}
              width=".44"
              height=".44"
              fill="#9c762a"
              stroke="white"
              strokeWidth=".04"
              style={{ cursor: "nwse-resize" }}
              aria-label="拖动调整房间大小"
              onPointerDown={(e) => {
                if (e.button !== 0 || !e.isPrimary) return;
                e.stopPropagation();
                onEditStart?.();
                resizing.current = room.id;
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
            />
          ))}
      {plan.obstacles.map((o) => (
        <g key={o.id}>
          <rect
            x={o.x}
            y={o.y}
            width={o.width}
            height={o.height}
            fill="#b8ae9a"
            stroke="#74674f"
            strokeWidth=".03"
          />
          <text
            x={o.x + o.width / 2}
            y={o.y + o.height / 2}
            fontSize=".2"
            textAnchor="middle"
            fill="#292d23"
          >
            {o.name}
          </text>
        </g>
      ))}
      {plan.openings
        .filter((o) => plan.rooms.some((r) => r.id === o.roomId))
        .map((o) => {
          const { start, end, center } = openingGeometry(plan, o);
          return (
            <g
              key={o.id}
              onPointerDown={(e) => {
                if (tool === "select" && onOpeningSelect) {
                  e.stopPropagation();
                  onSelect?.(o.roomId);
                  onOpeningSelect(o.id);
                }
              }}
            >
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke="transparent"
                strokeWidth=".4"
              />
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke="white"
                strokeWidth=".1"
              />
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={
                  o.kind === "window"
                    ? "#29738b"
                    : o.entrance
                      ? "#a35436"
                      : "#287551"
                }
                strokeWidth=".065"
                strokeDasharray={!o.operable ? ".1 .06" : undefined}
              />
              {o.entrance && (
                <text
                  x={center.x}
                  y={center.y + 0.3}
                  fontSize=".24"
                  textAnchor="middle"
                  fill="#8d3e23"
                >
                  入口
                </text>
              )}
            </g>
          );
        })}
      {findings
        .filter((f) => f.line)
        .map((f) => (
          <line
            key={f.id}
            x1={f.line!.from.x}
            y1={f.line!.from.y}
            x2={f.line!.to.x}
            y2={f.line!.to.y}
            stroke={f.line!.blocked ? "#78684b" : "#b75237"}
            strokeWidth=".06"
            strokeDasharray=".16 .1"
          />
        ))}
      {preview && (
        <rect
          x={Math.max(0, Math.min(preview.from.x, preview.to.x))}
          y={Math.max(0, Math.min(preview.from.y, preview.to.y))}
          width={Math.abs(preview.from.x - preview.to.x)}
          height={Math.abs(preview.from.y - preview.to.y)}
          fill="#9c762a"
          fillOpacity=".15"
          stroke="#9c762a"
          strokeWidth=".05"
          strokeDasharray=".12 .08"
          pointerEvents="none"
        />
      )}
      <text
        x={plan.width / 2}
        y="-.2"
        textAnchor="middle"
        fill="#3c5746"
        fontSize=".22"
      >
        {plan.width}m · 图顶
        {plan.topAngle == null ? "方向未设置" : ` ${plan.topAngle}°`}
      </text>
    </svg>
  );
}
