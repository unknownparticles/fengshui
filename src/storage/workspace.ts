import { openDB, type IDBPDatabase } from "idb";
import {
  emptyWorkspace,
  SCHEMA_VERSION,
  type Workspace,
} from "../domain/model";

export const NAMESPACE = `fengshui:${import.meta.env.BASE_URL}`;
export class WorkspaceStore {
  private db: IDBPDatabase | null = null;
  private memory = emptyWorkspace();
  mode: "persistent" | "memory" | "readonly" = "memory";
  raw: unknown = null;
  constructor(private readonly name = `${NAMESPACE}:workspace`) {}
  async open(): Promise<Workspace> {
    try {
      this.db = await openDB(this.name, undefined, {
        upgrade(db) {
          if (!db.objectStoreNames.contains("workspace"))
            db.createObjectStore("workspace");
        },
        blocking: () => {
          this.db?.close();
          this.mode = "readonly";
        },
      });
      if (!this.db.objectStoreNames.contains("workspace")) {
        this.mode = "readonly";
        return this.memory;
      }
      const raw = await this.db.get("workspace", "current");
      this.raw = raw;
      if (
        this.db.version > SCHEMA_VERSION ||
        (raw && raw.schemaVersion !== SCHEMA_VERSION)
      ) {
        this.mode = "readonly";
        this.memory =
          raw && Array.isArray(raw.projects) ? raw : emptyWorkspace();
      } else {
        this.mode = "persistent";
        this.memory = raw || emptyWorkspace();
      }
    } catch {
      this.mode = "memory";
    }
    return structuredClone(this.memory);
  }
  async save(value: Workspace, expectedRevision: number): Promise<number> {
    if (this.mode === "readonly")
      throw new Error(
        "数据版本较新或其他页面正在升级，当前只读。请导出原始备份后更新应用。",
      );
    if (this.mode === "memory") {
      this.memory = structuredClone({
        ...value,
        revision: expectedRevision + 1,
      });
      return this.memory.revision;
    }
    if (!this.db) throw new Error("本地数据库不可用");
    const tx = this.db.transaction("workspace", "readwrite");
    try {
      const current = await tx.store.get("current");
      if ((current?.revision ?? 0) !== expectedRevision) {
        tx.abort();
        await tx.done.catch(() => {});
        throw new Error(
          "另一页面已修改项目。请导出当前草稿，再读取本地最新记录。",
        );
      }
      const revision = expectedRevision + 1;
      await tx.store.put(
        { ...value, schemaVersion: SCHEMA_VERSION, revision },
        "current",
      );
      await tx.done;
      this.memory = structuredClone({ ...value, revision });
      this.raw = this.memory;
      return revision;
    } catch (error) {
      await tx.done.catch(() => {});
      throw error;
    }
  }
  async rawExport() {
    if (!this.db) return this.memory;
    const stores: Record<string, unknown> = {};
    for (const name of this.db.objectStoreNames) {
      const tx = this.db.transaction(name);
      stores[name] = {
        keys: await tx.store.getAllKeys(),
        values: await tx.store.getAll(),
      };
    }
    return { databaseVersion: this.db.version, stores };
  }
  close() {
    this.db?.close();
  }
}
