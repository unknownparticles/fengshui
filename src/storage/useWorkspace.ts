import { useCallback, useEffect, useRef, useState } from "react";
import { emptyWorkspace, type Workspace } from "../domain/model";
import { WorkspaceStore } from "./workspace";
export function useWorkspace() {
  const [store] = useState(() => new WorkspaceStore());
  const [data, setData] = useState(emptyWorkspace);
  const current = useRef(data);
  const revision = useRef(0);
  const queue = useRef(Promise.resolve());
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("读取本地资料");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(0);
  useEffect(() => {
    let active = true;
    void store.open().then((value) => {
      if (active) {
        current.current = value;
        revision.current = value.revision;
        setData(value);
        setReady(true);
        setStatus(
          store.mode === "persistent"
            ? "本地资料已载入"
            : store.mode === "readonly"
              ? "数据版本不兼容 · 只读"
              : "仅内存 · 请下载备份",
        );
      }
    });
    return () => {
      active = false;
    };
  }, [store]);
  const save = useCallback(
    (next: Workspace) => {
      setPending((n) => n + 1);
      setStatus("保存中");
      const operation = queue.current.then(async () => {
        const updated = await store.save(next, revision.current);
        revision.current = updated;
        setError("");
        setStatus(
          store.mode === "persistent" ? "已保存到本机" : "仅内存 · 请下载备份",
        );
      });
      queue.current = operation.catch(() => {});
      return operation
        .catch((e) => {
          const message = e instanceof Error ? e.message : "本地保存失败";
          setError(message);
          setStatus("保存失败 · 草稿保留");
          throw e;
        })
        .finally(() => setPending((n) => n - 1));
    },
    [store],
  );
  const mutate = useCallback(
    async (edit: (next: Workspace) => void) => {
      if (!ready) throw new Error("本地资料尚未载入");
      if (store.mode === "readonly")
        throw new Error("数据版本不兼容，当前只读，请先导出原始备份");
      const next = structuredClone(current.current);
      edit(next);
      current.current = next;
      setData(next);
      await save(next);
    },
    [ready, save, store],
  );
  const retry = useCallback(() => save(current.current), [save]);
  const reload = useCallback(async () => {
    await queue.current;
    const value = await store.open();
    current.current = value;
    revision.current = value.revision;
    setData(value);
    setError("");
    setStatus("已读取本地最新记录");
  }, [store]);
  return {
    data,
    mutate,
    ready,
    status,
    error,
    pending,
    mode: store.mode,
    retry,
    reload,
    rawExport: () => store.rawExport(),
  };
}
