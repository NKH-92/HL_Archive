import { readFile, writeFile } from "node:fs/promises";

import { ROUTES, routeCollisions } from "../src/app/routeRegistry.js";

const OUTPUT_URL = new URL("../../docs/generated/ROUTE_PERMISSION_CATALOG.md", import.meta.url);
const collisions = routeCollisions();
if (collisions.length) throw new Error(`route collision: ${JSON.stringify(collisions)}`);

const content = `${header()}${routeTable()}${permissionTable()}`;
if (process.argv.includes("--check")) {
  const current = await readFile(OUTPUT_URL, "utf8").catch(() => "");
  if (current.replace(/\r\n/g, "\n") !== content) throw new Error("route/permission catalog가 최신이 아닙니다. npm run docs:routes를 실행하세요.");
  console.log(`✓ route ${ROUTES.length}개 catalog·permission matrix 검사 통과`);
} else {
  await writeFile(OUTPUT_URL, content, "utf8");
  console.log(`✓ ${OUTPUT_URL.pathname} 생성`);
}

function header() {
  return `# Generated Route and Permission Catalog\n\n이 파일은 \`npm run docs:routes\`로 생성한다. 직접 편집하지 않는다.\n\n`;
}

function routeTable() {
  const rows = ROUTES.map((item) => `| \`${item.id}\` | \`${item.method}\` | \`${item.path}\` | ${item.auth} | ${guard(item)} | \`${item.demoAccess}\` |`).join("\n");
  return `## Routes\n\n| route id | method | path | auth | permission/policy | demo access |\n|---|---|---|---|---|---|\n${rows}\n\n`;
}

function permissionTable() {
  const grouped = new Map();
  for (const item of ROUTES) {
    const key = guard(item);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item.id);
  }
  const rows = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, ids]) => `| ${key} | ${ids.map((id) => `\`${id}\``).join(", ")} |`).join("\n");
  return `## Permission matrix\n\n| permission/policy | route ids |\n|---|---|\n${rows}\n`;
}

function guard(item) {
  const conditions = [];
  if (item.permission) conditions.push(`\`${item.permission}\``);
  if (item.policy) conditions.push(`policy:${item.policy}`);
  if (conditions.length) return conditions.join(" + ");
  return item.auth === "public" ? "public" : "authenticated";
}
