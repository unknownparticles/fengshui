import { useMemo, useState } from "react";
import { useApp, useActivity } from "../../App";
import {
  makeRoom,
  drawnRoom,
  openingAt,
  moveRoom,
  neighboringRooms,
  planIssues,
  templatePlan,
  validateFloorPlan,
  ROOM_USES,
  WALL_LABEL,
  type FloorPlan,
  type Room,
  type Opening,
  type Wall,
  type PlanPoint,
} from "../../domain/floor-plan";
import { assessIndoor, type QiAssessment } from "../../domain/indoor-qi";
import { nowISO, uid, type Project } from "../../domain/model";
import {
  normalize,
  parseAngle,
  NORTH_LABEL,
  mountain,
  type KnownNorth,
} from "../../domain/direction";
import { floorPlanPNG } from "../../domain/floor-plan-svg";
import { prepareImage, imageDataURL } from "../../domain/images";
import { FloorPlanCanvas, type PlanTool } from "./FloorPlanCanvas";
export function QuickFloorPlan({ project: p }: { project: Project }) {
  const app = useApp();
  const latest = p.floorPlans?.at(-1);
  const [draft, setDraft] = useState<FloorPlan | null>(
    latest ? structuredClone(latest) : null,
  );
  const [selected, setSelected] = useState(latest?.rooms[0]?.id || "");
  const [width, setWidth] = useState(latest?.width.toString() || "10");
  const [height, setHeight] = useState(latest?.height.toString() || "8");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [roomName, setRoomName] = useState("新房间");
  const [tool, setTool] = useState<PlanTool>("select");
  const [drawUse, setDrawUse] = useState<Room["use"]>("卧室");
  const [selectedOpening, setSelectedOpening] = useState("");
  const [opacity, setOpacity] = useState(0.65);
  const [history, setHistory] = useState<FloorPlan[]>([]);
  const backgroundImage = p.attachments.find(
    (a) => a.id === draft?.backgroundId,
  );
  const background = useMemo(
    () => (backgroundImage ? imageDataURL(backgroundImage) : undefined),
    [backgroundImage],
  );
  const existingImage = [...p.attachments]
    .reverse()
    .find((a) => a.kind === "plan");
  const [top, setTop] = useState(latest?.topAngle?.toString() || "");
  const [north, setNorth] = useState<KnownNorth>(latest?.north || "magnetic");
  const [assessmentId, setAssessmentId] = useState(
    p.qiAssessments?.at(-1)?.id || "",
  );
  const [live, setLive] = useState<QiAssessment | null>(null);
  const readOnly = !!p.archivedAt || app.mode === "readonly";
  const room = draft?.rooms.find((r) => r.id === selected) || draft?.rooms[0];
  const lastAssessment =
    p.qiAssessments?.find((a) => a.id === assessmentId) ||
    p.qiAssessments?.at(-1);
  const result = live || lastAssessment;
  useActivity("quick-floor-plan", dirty || working);
  const change = (edit: (plan: FloorPlan) => void, remember = true) => {
    if (!draft || readOnly) return;
    const next = structuredClone(draft);
    edit(next);
    if (remember) setHistory((prev) => [...prev.slice(-29), draft]);
    setDraft(next);
    setDirty(true);
    setLive(null);
    setError("");
  };
  function make(template: "blank" | "one-bedroom" | "two-bedroom") {
    try {
      if (dirty && !confirm("用模板替换当前未保存示意？已保存修订会保留。"))
        return;
      const plan = templatePlan(template, Number(width), Number(height));
      setDraft(plan);
      setHistory([]);
      setTool("room");
      setSelected(plan.rooms[0]?.id || "");
      setTop("");
      setDirty(true);
      setLive(null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function importImage(file: File) {
    if (
      draft?.rooms.length &&
      !confirm("导入新底图并重新描画？已保存的户型修订会保留。")
    )
      return;
    setWorking(true);
    try {
      const image = await prepareImage(file, "plan");
      const plan = templatePlan("blank", Number(width), Number(height));
      plan.backgroundId = image.id;
      await app.mutate((data) => {
        const project = data.projects.find((x) => x.id === p.id)!;
        project.attachments.push(image);
        project.updatedAt = nowISO();
      });
      beginTracing(plan);
      app.announce("底图已导入，拖框即可建立房间或过道");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  function beginTracing(plan: FloorPlan) {
    setDraft(plan);
    setSelected("");
    setSelectedOpening("");
    setTop("");
    setHistory([]);
    setTool("room");
    setDirty(true);
    setLive(null);
    setError("");
  }
  function draw(from: PlanPoint, to: PlanPoint) {
    if (!draft || readOnly) return;
    try {
      const use = tool === "corridor" ? "走廊" : drawUse;
      const name = tool === "corridor" ? "过道" : use;
      const count = draft.rooms.filter((r) => r.use === use).length;
      const created = drawnRoom(
        draft,
        from,
        to,
        `${name}${count ? count + 1 : ""}`,
        use,
      );
      change((plan) => plan.rooms.push(created));
      setSelected(created.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function place(roomId: string, point: PlanPoint) {
    if (!draft || readOnly) return;
    try {
      const created = openingAt(
        draft,
        roomId,
        point,
        tool === "window" ? "window" : "door",
        tool === "entrance",
      );
      change((plan) => {
        if (created.entrance)
          plan.openings.forEach((o) => (o.entrance = false));
        plan.openings.push(created);
      });
      setSelected(roomId);
      setSelectedOpening(created.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function resize(id: string, width: number, height: number) {
    if (!draft || readOnly) return;
    const next = structuredClone(draft);
    const room = next.rooms.find((r) => r.id === id)!;
    const minimum = room.use === "走廊" ? 0.5 : 1;
    room.width = Math.max(
      minimum,
      Math.min(next.width - room.x, Math.round(width * 4) / 4),
    );
    room.height = Math.max(
      minimum,
      Math.min(next.height - room.y, Math.round(height * 4) / 4),
    );
    if (planIssues(next).length) return;
    change(
      (plan) =>
        Object.assign(
          plan.rooms.find((r) => r.id === id)!,
          room,
        ),
      false,
    );
  }
  function applySize() {
    if (!draft) return;
    try {
      const next = structuredClone(draft);
      const dimensions = templatePlan("blank", Number(width), Number(height));
      const sx = dimensions.width / draft.width,
        sy = dimensions.height / draft.height;
      next.width = dimensions.width;
      next.height = dimensions.height;
      next.rooms.forEach((r) => {
        r.x *= sx;
        r.y *= sy;
        r.width *= sx;
        r.height *= sy;
      });
      next.obstacles.forEach((o) => {
        o.x *= sx;
        o.y *= sy;
        o.width *= sx;
        o.height *= sy;
      });
      next.openings.forEach((o) => {
        o.width *= o.wall === "north" || o.wall === "south" ? sx : sy;
      });
      validateFloorPlan(next);
      change((plan) => Object.assign(plan, next));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setDraft(previous);
    setHistory(history.slice(0, -1));
    setSelectedOpening("");
    setDirty(true);
    setLive(null);
    setError("");
  }
  function updateRoom(update: Partial<Room>) {
    if (!room) return;
    change((plan) => {
      const current = plan.rooms.find((r) => r.id === room.id)!;
      Object.assign(current, update);
    });
  }
  function addRoom(use: Room["use"] = "其他") {
    if (!draft) return;
    let placed: Room | null = null;
    for (let y = 0; y <= draft.height - 2 && !placed; y += 0.25)
      for (let x = 0; x <= draft.width - 2 && !placed; x += 0.25) {
        const candidate = makeRoom(
          use === "走廊" ? "过道" : roomName.trim() || "新房间",
          use,
          x,
          y,
          2,
          2,
        );
        if (
          !planIssues({ ...draft, rooms: [...draft.rooms, candidate] }).some(
            (issue) => issue.includes("重叠") || issue.includes("越界"),
          )
        )
          placed = candidate;
      }
    if (!placed) {
      setError("没有可放置 2m × 2m 新房间的空白空间；请先缩小或移动已有房间。");
      return;
    }
    const newRoom = placed;
    change((plan) => plan.rooms.push(newRoom));
    setSelected(newRoom.id);
    setTool("select");
  }
  function opening(kind: Opening["kind"]) {
    if (!room || !draft) return;
    for (const point of [
      { x: room.x + room.width / 2, y: room.y },
      { x: room.x + room.width, y: room.y + room.height / 2 },
      { x: room.x + room.width / 2, y: room.y + room.height },
      { x: room.x, y: room.y + room.height / 2 },
    ]) {
      try {
        const candidate = openingAt(draft, room.id, point, kind);
        change((plan) => plan.openings.push(candidate));
        setSelectedOpening(candidate.id);
        return;
      } catch {
        // 尝试下一面墙，所有墙均不可用时引导图上指定位置。
      }
    }
    setError("没有可用的墙面中点，请用点墙工具选择具体位置。");
  }
  async function save(): Promise<FloorPlan | null> {
    try {
      if (!draft) throw new Error("请先建立户型");
      const plan = structuredClone(draft);
      if (top.trim()) {
        plan.topAngle = parseAngle(top);
        plan.north = north;
      } else {
        delete plan.topAngle;
        delete plan.north;
      }
      validateFloorPlan(plan);
      plan.id = uid();
      plan.revision = (latest?.revision || 0) + 1;
      plan.parentId = latest?.id;
      plan.createdAt = nowISO();
      await app.mutate((data) => {
        const project = data.projects.find((x) => x.id === p.id)!;
        project.floorPlans = [...(project.floorPlans || []), plan];
        project.updatedAt = nowISO();
      });
      setDraft(plan);
      setDirty(false);
      setError("");
      app.announce("户型修订已保存");
      return plan;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }
  async function evaluate() {
    if (!draft) return;
    try {
      if (dirty || !latest) {
        setLive(
          assessIndoor({
            ...draft,
            topAngle: top.trim() ? parseAngle(top) : undefined,
            north: top.trim() ? north : undefined,
          }),
        );
        setError("当前为草稿评估，请先保存户型修订后再保存评估快照。");
        return;
      }
      const assessment = assessIndoor(latest);
      await app.mutate((data) => {
        const project = data.projects.find((x) => x.id === p.id)!;
        project.qiAssessments = [...(project.qiAssessments || []), assessment];
        project.updatedAt = nowISO();
      });
      setAssessmentId(assessment.id);
      setLive(null);
      setError("");
      app.announce("室内气评估快照已保存");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function exportPNG() {
    setWorking(true);
    try {
      const plan = dirty ? await save() : latest;
      if (!plan) return;
      const blob = await floorPlanPNG(plan);
      const attachment = await prepareImage(blob, "plan");
      await app.mutate((data) => {
        const project = data.projects.find((x) => x.id === p.id)!;
        project.attachments.push(attachment);
        if (plan.topAngle != null && plan.north) {
          const imageWidth = plan.width + 0.6 * 2,
            imageHeight = plan.height + 1.2;
          project.overlays.push({
            id: uid(),
            attachmentId: attachment.id,
            center: {
              x: (0.6 + plan.width / 2) / imageWidth,
              y: (0.6 + plan.height / 2) / imageHeight,
            },
            topAngle: plan.topAngle,
            north: plan.north,
            adoptionId: project.activeAdoptionId,
            mode: "eight",
            opacity: 0.75,
            zoom: 1,
            pan: { x: 0, y: 0 },
            createdAt: nowISO(),
            ruleVersion: "earth-plate-v1",
          });
        }
        project.updatedAt = nowISO();
      });
      app.announce("已生成本地 PNG 图纸，可在下方查看方位叠加");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  function move(id: string, x: number, y: number) {
    if (!draft || readOnly) return;
    const next = moveRoom(draft, id, x, y);
    if (planIssues(next).length) return;
    setDraft(next);
    setDirty(true);
    setLive(null);
  }
  const issues = draft ? planIssues(draft) : [];
  return (
    <section id="quick-floor-plan" className="card quick-floor-plan">
      <div className="section-title">
        <h2>导入户型图，快速建立房间</h2>
        <span className="pill">可编辑示意</span>
      </div>
      <p className="muted">
        ① 导入底图　② 拖框画房间／过道　③ 点墙加门窗，保存户型。
      </p>
      <fieldset disabled={readOnly || working} className="plan-import">
        <legend>第一步 · 导入户型图</legend>
        <label>
          导入户型图作为底图
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void importImage(file);
            }}
          />
        </label>
        <p className="muted">
          支持 PNG／JPEG／WebP。先用默认尺寸描画，也可填写图纸的实际总宽、总深。
        </p>
        {!draft && existingImage && (
          <button
            onClick={() => {
              try {
                const plan = templatePlan(
                  "blank",
                  Number(width),
                  Number(height),
                );
                plan.backgroundId = existingImage.id;
                beginTracing(plan);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            用已导入图纸建房间
          </button>
        )}
        {working && <p role="status">正在处理户型图…</p>}
      </fieldset>
      <details className="plan-start-options" open={!draft}>
        <summary>户型尺寸与无图模板</summary>
        <fieldset disabled={readOnly || working}>
          <legend>一键户型模板</legend>
          <div className="form-grid">
            <label>
              户型总宽（m）
              <input
                type="number"
                min="4"
                max="40"
                step=".25"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
            </label>
            <label>
              户型总深（m）
              <input
                type="number"
                min="4"
                max="40"
                step=".25"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </label>
          </div>
          {draft && <button onClick={applySize}>应用尺寸到当前户型</button>}
          <div className="button-row">
            <button onClick={() => make("blank")}>空白户型</button>
            <button onClick={() => make("one-bedroom")}>一室一厅</button>
            <button onClick={() => make("two-bedroom")}>两室一厅</button>
          </div>
        </fieldset>
      </details>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {draft && (
        <>
          <div className="sketch-layout">
            <div>
              <fieldset className="plan-tools" disabled={readOnly || working}>
                <legend>第二步 · 画房间，再点墙加门窗</legend>
                <div
                  className="button-row"
                  role="group"
                  aria-label="户型绘图工具"
                >
                  {(
                    [
                      ["select", "选择／移动"],
                      ["room", "画房间"],
                      ["corridor", "画过道"],
                      ["door", "点墙加门"],
                      ["window", "点墙加窗"],
                      ["entrance", "主入口"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      aria-pressed={tool === value}
                      className={tool === value ? "primary" : ""}
                      onClick={() => {
                        setTool(value);
                        setError("");
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  <button disabled={!history.length} onClick={undo}>
                    撤销上一步
                  </button>
                </div>
                {tool === "room" && (
                  <label>
                    绘制房间用途
                    <select
                      value={drawUse}
                      onChange={(e) =>
                        setDrawUse(e.target.value as Room["use"])
                      }
                    >
                      {ROOM_USES.filter((use) => use !== "走廊").map((use) => (
                        <option key={use}>{use}</option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="tool-hint" role="status">
                  {tool === "select"
                    ? "点击选中房间，拖动移动；拖动右下角金色方块调整大小。"
                    : tool === "room"
                      ? "在底图上从一个角拖到另一个角，松开即可建立房间，可连续绘制。"
                      : tool === "corridor"
                        ? "拖框画出过道范围，再用“点墙加门”连接两侧房间。"
                        : `点击房间边缘的墙线添加${tool === "window" ? "窗" : tool === "entrance" ? "主入口" : "门"}。内门会自动连接邻接房间。`}
                </p>
                <div className="button-row">
                  <button
                    className="primary"
                    disabled={app.pending > 0}
                    onClick={() => void save()}
                  >
                    保存户型
                  </button>
                  <span className="muted">
                    {draft.rooms.length} 个房间／过道 · {draft.openings.length}{" "}
                    处门窗{dirty ? " · 未保存" : " · 已保存"}
                  </span>
                </div>
              </fieldset>
              <FloorPlanCanvas
                plan={draft}
                selected={room?.id}
                onSelect={setSelected}
                onMove={readOnly ? undefined : move}
                onResize={readOnly ? undefined : resize}
                onDraw={readOnly ? undefined : draw}
                onPlace={readOnly ? undefined : place}
                onOpeningSelect={setSelectedOpening}
                onEditStart={() =>
                  setHistory((prev) => [...prev.slice(-29), draft])
                }
                tool={readOnly ? "select" : tool}
                background={background}
                backgroundOpacity={opacity}
                findings={
                  result && result.planId === latest?.id && !dirty
                    ? result.findings
                    : []
                }
              />
              {background && (
                <label>
                  底图透明度
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step=".05"
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                  />
                </label>
              )}
              <p className="diagram-legend">
                <span>绿线：门</span>
                <span>蓝线：窗</span>
                <span>棕线：入口</span>
                <span>虚线：结构示意</span>
              </p>
              <p className="muted">
                图上方不自动代表北。触控拖动房间按 0.25m
                网格移动，尺寸也可在表单中填写。
              </p>
            </div>
            <fieldset disabled={readOnly}>
              <legend>房间与尺寸</legend>
              <label>
                选中房间
                <select
                  value={room?.id || ""}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  <option value="" disabled>
                    选择房间
                  </option>
                  {draft.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              {room && (
                <>
                  <label>
                    房间名称
                    <input
                      value={room.name}
                      onChange={(e) => updateRoom({ name: e.target.value })}
                    />
                  </label>
                  <label>
                    房间用途
                    <select
                      value={room.use}
                      onChange={(e) =>
                        updateRoom({ use: e.target.value as Room["use"] })
                      }
                    >
                      {ROOM_USES.map((use) => (
                        <option key={use}>{use}</option>
                      ))}
                    </select>
                  </label>
                  <div className="form-grid">
                    {(["x", "y", "width", "height"] as const).map((key) => (
                      <label key={key}>
                        {
                          {
                            x: "房间横位置（m）",
                            y: "房间纵位置（m）",
                            width: "房间宽（m）",
                            height: "房间深（m）",
                          }[key]
                        }
                        <input
                          type="number"
                          step=".25"
                          value={room[key]}
                          onChange={(e) =>
                            updateRoom({ [key]: Number(e.target.value) })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    className="danger-button"
                    onClick={() => {
                      if (
                        !confirm(
                          `移除“${room.name}”及关联门窗、障碍？保存过的修订仍保留。`,
                        )
                      )
                        return;
                      change((plan) => {
                        plan.rooms = plan.rooms.filter((r) => r.id !== room.id);
                        plan.openings = plan.openings.filter(
                          (o) => o.roomId !== room.id && o.toRoomId !== room.id,
                        );
                        plan.obstacles = plan.obstacles.filter(
                          (o) => o.roomId !== room.id,
                        );
                      });
                      setSelected("");
                    }}
                  >
                    移除选中房间
                  </button>
                </>
              )}
              <label>
                新增房间名称
                <input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </label>
              <div className="button-row">
                <button onClick={() => addRoom()}>添加房间</button>
                <button onClick={() => addRoom("走廊")}>添加过道</button>
              </div>
            </fieldset>
          </div>
          {room && (
            <fieldset disabled={readOnly}>
              <legend>{room.name} · 门窗与障碍</legend>
              <div className="button-row">
                <button onClick={() => opening("door")}>添加门</button>
                <button onClick={() => opening("window")}>添加窗</button>
                <button
                  onClick={() =>
                    change((plan) =>
                      plan.obstacles.push({
                        id: uid(),
                        roomId: room.id,
                        name: "家具／屏风",
                        x: room.x + room.width / 2 - 0.25,
                        y: room.y + room.height / 2 - 0.25,
                        width: 0.5,
                        height: 0.5,
                      }),
                    )
                  }
                >
                  添加障碍物
                </button>
              </div>
              {draft.openings
                .filter((o) => o.roomId === room.id)
                .map((o) => (
                  <details
                    className="opening-editor"
                    key={o.id}
                    open={selectedOpening === o.id}
                  >
                    <summary>
                      {o.kind === "door" ? "门" : "窗"} · {WALL_LABEL[o.wall]} ·{" "}
                      {o.width}m{o.entrance ? " · 主入口" : ""}
                    </summary>
                    <strong>{o.kind === "door" ? "门" : "窗"}</strong>
                    <div className="form-grid">
                      <label>
                        所在墙面
                        <select
                          value={o.wall}
                          onChange={(e) =>
                            change((plan) => {
                              const current = plan.openings.find(
                                (x) => x.id === o.id,
                              )!;
                              current.wall = e.target.value as Wall;
                              delete current.toRoomId;
                            })
                          }
                        >
                          {Object.entries(WALL_LABEL).map(([wall, label]) => (
                            <option key={wall} value={wall}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        墙面位置（%）
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={o.position * 100}
                          onChange={(e) =>
                            change((plan) => {
                              plan.openings.find(
                                (x) => x.id === o.id,
                              )!.position = Number(e.target.value) / 100;
                            })
                          }
                        />
                      </label>
                      <label>
                        门窗宽度（m）
                        <input
                          type="number"
                          min=".3"
                          step=".1"
                          value={o.width}
                          onChange={(e) =>
                            change((plan) => {
                              plan.openings.find((x) => x.id === o.id)!.width =
                                Number(e.target.value);
                            })
                          }
                        />
                      </label>
                      {o.kind === "door" && (
                        <label>
                          门路连接
                          <select
                            value={o.toRoomId || ""}
                            onChange={(e) =>
                              change((plan) => {
                                const current = plan.openings.find(
                                  (x) => x.id === o.id,
                                )!;
                                current.toRoomId = e.target.value || undefined;
                                if (current.toRoomId) current.entrance = false;
                              })
                            }
                          >
                            <option value="">外部空间</option>
                            {neighboringRooms(draft, o).map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    {o.kind === "door" && !o.toRoomId && (
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={o.entrance}
                          onChange={(e) =>
                            change((plan) => {
                              plan.openings.forEach(
                                (x) => (x.entrance = false),
                              );
                              plan.openings.find(
                                (x) => x.id === o.id,
                              )!.entrance = e.target.checked;
                            })
                          }
                        />
                        设为主入口
                      </label>
                    )}
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={o.operable}
                        onChange={(e) =>
                          change((plan) => {
                            plan.openings.find((x) => x.id === o.id)!.operable =
                              e.target.checked;
                          })
                        }
                      />
                      {o.kind === "door" ? "可通行" : "可开启"}
                    </label>
                    <button
                      onClick={() =>
                        change((plan) => {
                          plan.openings = plan.openings.filter(
                            (x) => x.id !== o.id,
                          );
                        })
                      }
                    >
                      移除{o.kind === "door" ? "门" : "窗"}
                    </button>
                  </details>
                ))}
              {draft.obstacles
                .filter((o) => o.roomId === room.id)
                .map((o) => (
                  <details className="opening-editor" key={o.id}>
                    <summary>{o.name} · 障碍物</summary>
                    <label>
                      障碍物名称
                      <input
                        value={o.name}
                        onChange={(e) =>
                          change((plan) => {
                            plan.obstacles.find((x) => x.id === o.id)!.name =
                              e.target.value;
                          })
                        }
                      />
                    </label>
                    <div className="form-grid">
                      {(["x", "y", "width", "height"] as const).map((key) => (
                        <label key={key}>
                          {
                            {
                              x: "障碍横位置（m）",
                              y: "障碍纵位置（m）",
                              width: "障碍宽（m）",
                              height: "障碍深（m）",
                            }[key]
                          }
                          <input
                            type="number"
                            step=".25"
                            value={o[key]}
                            onChange={(e) =>
                              change((plan) => {
                                plan.obstacles.find((x) => x.id === o.id)![
                                  key
                                ] = Number(e.target.value);
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={() =>
                        change((plan) => {
                          plan.obstacles = plan.obstacles.filter(
                            (x) => x.id !== o.id,
                          );
                        })
                      }
                    >
                      移除障碍物
                    </button>
                  </details>
                ))}
            </fieldset>
          )}
          <fieldset disabled={readOnly}>
            <legend>方位与布局确认</legend>
            <div className="form-grid">
              <label>
                户型图顶方位角（度，可选）
                <input
                  type="number"
                  min="0"
                  max="360"
                  value={top}
                  onChange={(e) => {
                    setTop(e.target.value);
                    setDirty(true);
                    setLive(null);
                  }}
                />
              </label>
              <label>
                户型参考北
                <select
                  value={north}
                  onChange={(e) => {
                    setNorth(e.target.value as KnownNorth);
                    setDirty(true);
                    setLive(null);
                  }}
                >
                  <option value="magnetic">磁北</option>
                  <option value="true">真北</option>
                </select>
              </label>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={draft.layoutConfirmed}
                onChange={(e) =>
                  change((plan) => {
                    plan.layoutConfirmed = e.target.checked;
                  })
                }
              />
              已按现场确认房间、门窗、入口和障碍物
            </label>
          </fieldset>
          {issues.length > 0 && (
            <div className="boundary-warning">
              <strong>保存前需修正</strong>
              <ul>
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="button-row">
            <button
              className="primary"
              disabled={readOnly || working || app.pending > 0}
              onClick={() => void save()}
            >
              保存户型修订
            </button>
            <button
              disabled={readOnly || working || app.pending > 0}
              onClick={() => void exportPNG()}
            >
              生成 PNG 并用于方位叠加
            </button>
          </div>
          <p className="muted">
            {dirty
              ? "未保存的户型草稿"
              : `已保存修订 ${latest?.revision || draft.revision}`}{" "}
            · 尺寸为用户绘制示意
          </p>
          <section className="qi-section">
            <h3>室内的气 · 藏风聚气与使用环境</h3>
            <p>
              结合门路、外窗和遮挡判断图示结构，再填写实际通风采光感受。示意线不代表真实气流或不可观测能量。
            </p>
            {room && (
              <fieldset disabled={readOnly}>
                <legend>{room.name} · 现场感受</legend>
                <div className="form-grid">
                  <label>
                    通风感受
                    <select
                      value={room.ventilation}
                      onChange={(e) =>
                        updateRoom({
                          ventilation: e.target.value as Room["ventilation"],
                        })
                      }
                    >
                      <option value="unknown">未观察</option>
                      <option value="comfortable">舒适</option>
                      <option value="stuffy">闷滞</option>
                      <option value="drafty">直吹明显</option>
                    </select>
                  </label>
                  <label>
                    采光感受
                    <select
                      value={room.daylight}
                      onChange={(e) =>
                        updateRoom({
                          daylight: e.target.value as Room["daylight"],
                        })
                      }
                    >
                      <option value="unknown">未观察</option>
                      <option value="balanced">均衡</option>
                      <option value="dark">偏暗</option>
                      <option value="glare">眩光明显</option>
                    </select>
                  </label>
                  <label>
                    潮湿感受
                    <select
                      value={room.dampness}
                      onChange={(e) =>
                        updateRoom({
                          dampness: e.target.value as Room["dampness"],
                        })
                      }
                    >
                      <option value="unknown">未观察</option>
                      <option value="dry">无明显潮湿</option>
                      <option value="damp">明显潮湿</option>
                    </select>
                  </label>
                </div>
                <label>
                  房间观察备注
                  <textarea
                    value={room.notes}
                    onChange={(e) => updateRoom({ notes: e.target.value })}
                  />
                </label>
              </fieldset>
            )}
            <button
              className="primary"
              disabled={readOnly || working || app.pending > 0}
              onClick={() => void evaluate()}
            >
              评估室内的气
            </button>
            {result && (
              <div className="qi-results">
                <p role="status">
                  <strong>{result.summary}</strong>
                </p>
                {(dirty || result.planId !== latest?.id) && (
                  <p className="warning-text">
                    当前展示草稿或旧户型评估，请按保存后的最新修订重新评估。
                  </p>
                )}
                <FloorPlanCanvas
                  plan={result.plan}
                  findings={result.findings}
                />
                <div className="qi-findings">
                  {result.findings.map((f) => (
                    <article
                      className={`record-card qi-finding ${f.level}`}
                      key={f.id}
                    >
                      <span className="pill">
                        {f.type === "structure"
                          ? "图示结构"
                          : f.type === "observation"
                            ? "人员观察"
                            : "待补充"}
                      </span>
                      <h4>{f.title}</h4>
                      <details>
                        <summary>依据与改善建议</summary>
                        <p>
                          <strong>依据：</strong>
                          {f.evidence}
                        </p>
                        <p>
                          <strong>解释：</strong>
                          {f.interpretation}
                        </p>
                        <p>
                          <strong>建议：</strong>
                          {f.advice}
                        </p>
                      </details>
                    </article>
                  ))}
                </div>
              </div>
            )}
            {p.qiAssessments?.length ? (
              <label>
                历史室内评估
                <select
                  value={assessmentId || lastAssessment?.id || ""}
                  onChange={(e) => {
                    setAssessmentId(e.target.value);
                    setLive(null);
                  }}
                >
                  {[...p.qiAssessments].reverse().map((a) => (
                    <option key={a.id} value={a.id}>
                      修订 {a.planRevision} ·{" "}
                      {new Date(a.createdAt).toLocaleString("zh-CN")}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </section>
        </>
      )}
    </section>
  );
}
