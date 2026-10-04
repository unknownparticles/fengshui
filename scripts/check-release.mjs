import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const record = JSON.parse(
  readFileSync("docs/verification/manual-checks.json", "utf8"),
);
assert.equal(record.releaseReady, true, "正式发布前，须完成并记录实机验收");
for (const target of ["iphone", "android"]) {
  const check = record[target];
  assert.equal(check.status, "passed", `${target} 实机验收尚未通过`);
  for (const field of ["device", "system", "browser", "date", "evidence"])
    assert(
      typeof check[field] === "string" && check[field].trim(),
      `${target} 缺少 ${field} 验收证据`,
    );
}
console.log("实机验收记录完整，可继续正式发布");
