import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
function check(folder, base) {
  const manifest = JSON.parse(
    readFileSync(`${folder}/manifest.webmanifest`, "utf8"),
  );
  for (const field of ["id", "scope", "start_url"])
    assert.equal(manifest[field], base, `${folder} 的 ${field} 不匹配`);
  const html = readFileSync(`${folder}/index.html`, "utf8");
  const urls = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(
    (match) => match[1],
  );
  assert(
    urls.some((url) => url.startsWith(`${base}assets/`)),
    "缺少应用资源",
  );
  urls.forEach((url) => {
    assert(url.startsWith(base), `资源超出基路径：${url}`);
    assert(!url.includes("://"), "核心资源不能依赖远程服务器");
  });
  const worker = readFileSync(`${folder}/sw.js`, "utf8");
  assert(worker.includes("CHECK_OFFLINE"));
  assert(worker.includes("ACTIVATE_REQUEST"));
  console.log(`${folder}：manifest、资源与离线入口基路径 ${base} 验证通过`);
}
check("dist", "/fengshui/");
execFileSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build", "--outDir", "dist-root"],
  { env: { ...process.env, DEPLOY_BASE_PATH: "/" }, stdio: "inherit" },
);
check("dist-root", "/");
