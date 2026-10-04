import { useState } from "react";
import { useApp, useActivity } from "../../App";
import {
  makeRoom,
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
import { prepareImage } from "../../domain/images";
import { FloorPlanCanvas } from "./FloorPlanCanvas";
export function QuickFloorPlan({ project: p }: { project: Project }) {
  const app = useApp();
  const latest = p.floorPlans?.at(-1);
  const [draft, setDraft] = useState<FloorPlan | null>(
    latest ? structuredClone(latest) : null,
  );
  const [selected, setSelected] = useState(latest?.rooms[0]?.id || "");
  const [width, setWidth] = useState("10");
  const [height, setHeight] = useState("8");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [roomName, setRoomName] = useState("新房间");
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
  const change = (edit: (plan: FloorPlan) => void) => {
    if (!draft || readOnly) return;
    const next = structuredClone(draft);
    edit(next);
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
      setSelected(plan.rooms[0]?.id || "");
      setTop("");
      setDirty(true);
      setLive(null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function updateRoom(update: Partial<Room>) {
    if (!room) return;
    change((plan) => {
      const current = plan.rooms.find((r) => r.id === room.id)!;
      Object.assign(current, update);
    });
  }
  function addRoom() {
    if (!draft) return;
    let placed: Room | null = null;
    for (let y = 0; y <= draft.height - 2 && !placed; y += 0.25)
      for (let x = 0; x <= draft.width - 2 && !placed; x += 0.25) {
        const candidate = makeRoom(
          roomName.trim() || "新房间",
          "其他",
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
  }
  function opening(kind: Opening["kind"]) {
    if (!room || !draft) return;
    const walls: Wall[] = ["north", "east", "south", "west"];
    let candidate: Opening = {
      id: uid(),
      roomId: room.id,
      kind,
      wall: "north",
      position: 0.5,
      width: kind === "door" ? 0.8 : Math.min(1.2, room.width * 0.6),
      entrance: false,
      operable: true,
    };
    for (const wall of walls) {
      candidate = {
        ...candidate,
        wall,
        width:
          kind === "door"
            ? 0.8
            : Math.min(
                1.2,
                (wall === "north" || wall === "south"
                  ? room.width
                  : room.height) * 0.6,
              ),
      };
      const neighbors = neighboringRooms(draft, candidate);
      if (kind === "door" || !neighbors.length) {
        if (kind === "door" && neighbors.length)
          candidate.toRoomId = neighbors[0].id;
        break;
      }
    }
    change((plan) => plan.openings.push(candidate));
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
    setDraft(moveRoom(draft, id, x, y));
    setDirty(true);
    setLive(null);
  }
  const issues = draft ? planIssues(draft) : [];
  return (
    <section id="quick-floor-plan" className="card quick-floor-plan">
      <div className="section-title">
        <h2>快捷建立户型与室内气评估</h2>
        <span className="pill">可编辑示意</span>
      </div>
      <p className="muted">
        没有图纸也能开始：选择模板，调整房间、门窗和入口，再确认实际布局。
      </p>
      <fieldset disabled={readOnly}>
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
        <div className="button-row">
          <button onClick={() => make("blank")}>空白户型</button>
          <button onClick={() => make("one-bedroom")}>一室一厅</button>
          <button onClick={() => make("two-bedroom")}>两室一厅</button>
        </div>
      </fieldset>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {draft && (
        <>
          <div className="sketch-layout">
            <div>
              <FloorPlanCanvas
                plan={draft}
                selected={room?.id}
                onSelect={setSelected}
                onMove={readOnly ? undefined : move}
                findings={
                  result && result.planId === latest?.id && !dirty
                    ? result.findings
                    : []
                }
              />
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
              <button onClick={addRoom}>添加房间</button>
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
                  <details className="opening-editor" key={o.id}><summary>{o.kind==="door"?"门":"窗"} · {WALL_LABEL[o.wall]} · {o.width}m{o.entrance?" · 主入口":""}</summary>
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
                  <details className="opening-editor" key={o.id}><summary>{o.name} · 障碍物</summary>
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
                      <details><summary>依据与改善建议</summary><p>
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
                      </p></details>
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
