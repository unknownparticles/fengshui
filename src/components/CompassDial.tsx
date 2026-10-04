import { useEffect, useRef, useState } from "react";
import { MOUNTAINS, mountain, signedDelta } from "../domain/direction";
export function CompassDial({
  angle,
  locked = false,
}: {
  angle: number | null;
  locked?: boolean;
}) {
  const previous = useRef(angle ?? 0);
  const [rotation, setRotation] = useState(-(angle ?? 0));
  useEffect(() => {
    if (angle != null) {
      const difference = signedDelta(previous.current, angle);
      previous.current = angle;
      setRotation((r) => r - difference);
    }
  }, [angle]);
  const active = angle == null ? null : mountain(angle).name;
  const xy = (a: number, r: number) => [
    200 + Math.sin((a * Math.PI) / 180) * r,
    200 - Math.cos((a * Math.PI) / 180) * r,
  ];
  return (
    <svg
      className={`compass-dial ${locked ? "locked" : ""}`}
      viewBox="0 0 400 400"
      role="img"
      aria-label={
        angle == null
          ? "地盘正针，尚未录入方向"
          : `地盘正针，向${active}，${angle.toFixed(1)}度${locked ? "，已锁定" : ""}`
      }
    >
      <circle cx="200" cy="200" r="190" className="dial-outline" />
      <circle cx="200" cy="200" r="180" className="dial-bg" />
      <g
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: "200px 200px",
        }}
        className="dial-rotation"
      >
        {Array.from({ length: 72 }, (_, i) => {
          const [x1, y1] = xy(i * 5, i % 3 === 0 ? 168 : 173);
          const [x2, y2] = xy(i * 5, 180);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className="dial-tick"
            />
          );
        })}
        {MOUNTAINS.map((m) => {
          const [x, y] = xy(m.center, 147);
          const [lx, ly] = xy(m.center + 7.5, 130);
          const [ox, oy] = xy(m.center + 7.5, 164);
          return (
            <g key={m.name}>
              <line x1={lx} y1={ly} x2={ox} y2={oy} className="dial-divider" />
              <text
                x={x}
                y={y}
                dominantBaseline="central"
                textAnchor="middle"
                className={active === m.name ? "mountain active" : "mountain"}
                transform={`rotate(${m.center} ${x} ${y})`}
              >
                {m.name}
              </text>
            </g>
          );
        })}
        <circle cx="200" cy="200" r="126" className="dial-outline" />
        {["北", "东北", "东", "东南", "南", "西南", "西", "西北"].map(
          (d, i) => {
            const [x, y] = xy(i * 45, 109);
            return (
              <text
                key={d}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                className="direction"
                transform={`rotate(${i * 45} ${x} ${y})`}
              >
                {d}
              </text>
            );
          },
        )}
        <circle cx="200" cy="200" r="85" className="dial-outline" />
      </g>
      <path d="M200 15 191 33h18Z" className="dial-pointer" />
      <path d="M200 120 185 210h30Z" className="needle" />
      <path d="M200 280 185 210h30Z" className="needle-back" />
      <circle cx="200" cy="210" r="7" className="dial-pointer" />
    </svg>
  );
}
