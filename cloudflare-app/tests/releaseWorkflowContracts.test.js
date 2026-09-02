import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ci = await readFile(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
const deploy = await readFile(new URL("../../.github/workflows/deploy.yml", import.meta.url), "utf8");
const provisionAdmin = await readFile(new URL("../../.github/workflows/provision-admin.yml", import.meta.url), "utf8");
const remediateMainAdmin = await readFile(new URL("../../.github/workflows/remediate-main-admin.yml", import.meta.url), "utf8");
const actionWorkflows = await Promise.all([
  "ci.yml",
  "deploy.yml",
  "prepare-fresh-core.yml",
  "provision-admin.yml",
  "provision-users.yml",
  "provision-demo-reviewer.yml",
  "remediate-main-admin.yml",
  "branch-hygiene.yml"
].map((name) => readFile(new URL(`../../.github/workflows/${name}`, import.meta.url), "utf8")));
const dependabot = await readFile(new URL("../../.github/dependabot.yml", import.meta.url), "utf8");
const owners = await readFile(new URL("../../.github/CODEOWNERS", import.meta.url), "utf8");
const smokeRelease = await readFile(new URL("../scripts/smoke-release.mjs", import.meta.url), "utf8");
const wrangler = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const assetHeaders = await readFile(new URL("../public/_headers", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const guardedD1Scripts = await Promise.all([
  "check-admin-readiness.mjs",
  "migrate-remote-guarded.mjs",
  "provision-admin-guarded.mjs",
  "provision-users-guarded.mjs",
  "provision-demo-reviewer-guarded.mjs",
  "release-smoke-principal.mjs",
  "remediate-main-admin-guarded.mjs"
].map(async (name) => [name, await readFile(new URL(`../scripts/${name}`, import.meta.url), "utf8")]));

test("공식 GitHub Actions는 Node 24 지원 세대를 immutable SHA로 고정하고 자동 갱신한다", () => {
  const references = actionWorkflows.flatMap((workflow) => [...workflow.matchAll(
    /uses:\s*actions\/(checkout|setup-node|upload-artifact)@([a-f0-9]{40})\s+# v(\d+)(?:\.\d+\.\d+)?/g
  )]);

  assert.ok(references.length >= 16, "공식 action 참조를 모두 검사해야 합니다.");
  for (const [, action, sha, major] of references) {
    assert.equal(sha.length, 40, `${action}은 full commit SHA로 고정해야 합니다.`);
    assert.ok(Number(major) >= 5, `${action}은 Node 24 지원 major를 사용해야 합니다.`);
  }
  assert.match(dependabot, /package-ecosystem: "github-actions"/);
  assert.match(dependabot, /directory: "\/"[\s\S]*interval: "weekly"/);
});

test("PR required CI는 verify, audit, Worker dry-run과 증빙 보존을 강제한다", () => {
  assert.match(ci, /pull_request:[\s\S]*branches: \[main\]/);
  assert.match(ci, /name: required \/ verify/);
  for (const command of ["npm run verify", "npm run audit:dependencies", "npm run release:evidence", "npm run deploy:dry"]) {
    assert.ok(ci.includes(command), command);
  }
  assert.match(ci, /actions\/upload-artifact@[a-f0-9]{40}/);
  assert.match(ci, /fetch-depth: 0/);
  assert.match(ci, /github\.event\.pull_request\.base\.sha \|\| github\.event\.before/);
  assert.match(ci, /check-released-baseline-history\.mjs --base-ref "\$RELEASED_BASE_SHA"/);
  assert.match(ci, /CLOUDFLARE_ENV: production[\s\S]*D1_TARGET_DATABASE_ID: a07324c0-7547-48a6-836e-3f0c50b85c36[\s\S]*npm run deploy:dry/);
});

test("free-tier production deploy는 복구 지점, migration, 직접 배포, smoke, Worker rollback 순서를 고정한다", () => {
  assert.match(
    deploy,
    /push:\s+branches: \[main\]\s+paths:\s+- "cloudflare-app\/\*\*"\s+- "!cloudflare-app\/tests\/\*\*"\s+- "!cloudflare-app\/migrations\/released-baseline\.json"\s+- "\.github\/workflows\/deploy\.yml"/
  );
  assert.match(deploy, /workflow_dispatch: \{\}/);
  assert.doesNotMatch(deploy.slice(0, deploy.indexOf("permissions:")), /docs\/\*\*|README\.md/);
  assert.match(deploy, /name: Classify release scope[\s\S]*id: classify_release/);
  assert.match(deploy, /if \[ "\$GITHUB_EVENT_NAME" = "workflow_dispatch" \]; then[\s\S]*RELEASE_BASE_SHA="\$GITHUB_SHA"/);
  assert.match(deploy, /classify-release\.mjs --base "\$RELEASE_BASE_SHA" --head "\$GITHUB_SHA"/);
  assert.match(deploy, /BINDING_TRANSITION="\$\(jq -r \.bindingTransition\.changed/);
  assert.match(deploy, /Capture current Worker rollback target[\s\S]*id: capture_previous/);
  assert.match(deploy, /version-before\.json[\s\S]*\.resources\.bindings\[\][\s\S]*\.database_id/);
  assert.match(deploy, /PREVIOUS_DEPLOYED_CORE_DATABASE_ID" = "\$D1_TARGET_DATABASE_ID"/);
  assert.match(deploy, /Capture previous Core binding recovery point[\s\S]*steps\.capture_previous\.outputs\.binding_transition == 'true'/);
  assert.match(deploy, /previous-core-recovery\.json/);
  assert.match(deploy, /D1_RECOVERY_SCOPE: \$\{\{ steps\.classify_release\.outputs\.recovery_scope \}\}/);
  assert.match(deploy, /Apply D1 migrations\s+if: steps\.classify_release\.outputs\.release_class == 'database'/);
  assert.match(deploy, /Provision release-scoped smoke principals[\s\S]*if: steps\.classify_release\.outputs\.release_class != 'asset-only'/);
  assert.match(deploy, /Verify rollback Worker against migrated schema[\s\S]*steps\.capture_previous\.outputs\.binding_transition != 'true'/);
  assert.match(deploy, /SMOKE_PUBLIC_ONLY: \$\{\{ steps\.classify_release\.outputs\.release_class == 'asset-only'/);

  const markers = [
    "name: approved free-tier production release",
    "Enforce production release from main",
    "Verify deployment administrator before migration",
    "Capture Core D1 Time Travel recovery point",
    "Verify current Worker compatibility before migration",
    "Upload pre-mutation recovery and migration evidence",
    "Apply D1 migrations",
    "Verify deployment administrator after migration",
    "Provision release-scoped smoke principals",
    "Verify rollback Worker against migrated schema",
    "Deploy Worker directly to production",
    "Capture deployed Worker version",
    "Post-deploy transport, login and read-only search smoke",
    "Roll back Worker after release failure",
    "Upload release evidence"
  ];
  let previous = -1;
  for (const marker of markers) {
    const current = deploy.indexOf(marker);
    assert.ok(current > previous, marker);
    previous = current;
  }

  assert.match(deploy, /name: Deploy Worker directly to production\s+id: deploy_worker\s+continue-on-error: true/);
  assert.match(deploy, /name: Capture deployed Worker version\s+id: capture_deployed\s+if: steps\.deploy_worker\.outcome == 'success'\s+continue-on-error: true/);
  assert.match(deploy, /id: smoke\s+if: steps\.deploy_worker\.outcome == 'success' && steps\.capture_deployed\.outcome == 'success'\s+continue-on-error: true/);
  assert.match(deploy, /always\(\) && \(steps\.deploy_worker\.outcome == 'failure' \|\|[\s\S]*steps\.capture_deployed\.outcome == 'failure' \|\| steps\.smoke\.outcome == 'failure'\)/);
  assert.match(deploy, /wrangler deployments status --env production --json/);
  assert.match(deploy, /select\(\.percentage == 100\).*\.version_id/);
  assert.match(deploy, /versions view "\$DEPLOYED_VERSION_ID" --env production --json/);
  assert.match(deploy, /test "\$DEPLOYED_VERSION_ID" != "\$PREVIOUS_VERSION_ID"/);
  assert.match(deploy, /\.annotations\["workers\/tag"\] == \$tag and \.annotations\["workers\/message"\] == \$message/);
  assert.match(deploy, /SMOKE_EXPECTED_WORKER_VERSION="\$DEPLOYED_VERSION_ID"/);
  assert.match(deploy, /Post-deploy transport, login and read-only search smoke[\s\S]*SMOKE_HEALTH_ATTEMPTS: "60"[\s\S]*SMOKE_HEALTH_RETRY_MS: "2000"/);
  assert.match(deploy, /Post-deploy transport, login and read-only search smoke[\s\S]*SMOKE_ASSET_ATTEMPTS: "30"[\s\S]*SMOKE_ASSET_RETRY_MS: "2000"/);
  assert.match(deploy, /Post-deploy transport, login and read-only search smoke[\s\S]*SMOKE_VERIFY_PUBLIC_SURFACE: "1"/);
  assert.match(smokeRelease, /verifyPublicSurface: process\.env\.SMOKE_VERIFY_PUBLIC_SURFACE === "1"/);
  assert.match(smokeRelease, /assetAttempts: process\.env\.SMOKE_ASSET_ATTEMPTS/);
  assert.doesNotMatch(smokeRelease, /verifyPublicSurface: true/);
  assert.doesNotMatch(deploy, /versions list --json > release-evidence\/versions-before\.json/);
  assert.doesNotMatch(deploy, /123456|SESSION_SECRET/);
  assert.doesNotMatch(deploy, /\.outputs\.[A-Za-z0-9_]+-[A-Za-z0-9_-]+/);
  assert.match(deploy, /D1_MIGRATE_APPROVAL_CONTEXT: github-environment:production:\$\{\{ github\.run_id \}\}:\$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(
    deploy.slice(deploy.indexOf("\n  deploy:"), deploy.indexOf("\n    steps:", deploy.indexOf("\n  deploy:"))),
    /\$\{\{\s*runner\./
  );
  assert.match(deploy, /Initialize release-scoped credential path[\s\S]*RELEASE_SMOKE_CREDENTIAL_PATH=\$RUNNER_TEMP\/release-smoke-credentials\.json/);
  assert.match(deploy, /npm run recovery:d1:time-travel/);
  assert.ok(deploy.indexOf("d1-recovery.json") < deploy.indexOf("Apply D1 migrations"));
  assert.match(deploy, /SMOKE_REQUIRE_READINESS: "1"/);
  assert.match(deploy, /Remove release-scoped smoke principals[\s\S]*if: always\(\) && steps\.provision_smoke\.outcome != 'skipped'/);
  assert.match(deploy, /if \[ "\$GITHUB_REF" != "refs\/heads\/main" \]/);
  assert.match(deploy, /Verify released migrations against release base[\s\S]*check-released-baseline-history\.mjs --base-ref "\$RELEASED_BASE_SHA"/);
  assert.match(deploy, /PRODUCTION_URL: https:\/\/hanlim-archive\.skarhkdgus7\.workers\.dev[\s\S]*SMOKE_ALLOWED_HOSTS: hanlim-archive\.skarhkdgus7\.workers\.dev/);
  assert.ok((deploy.match(/SMOKE_REQUIRE_ADMIN: "1"/g)?.length || 0) >= 1);
  assert.ok((deploy.match(/SMOKE_REQUIRE_ADMIN: \$\{\{[^\n]*steps\.classify_release/g)?.length || 0) >= 2);
  assert.ok((deploy.match(/SMOKE_REQUIRE_SESSION_EPOCH_COMPAT: "1"/g)?.length || 0) >= 3);
  assert.ok((deploy.match(/npm run smoke:release/g)?.length || 0) >= 3);
  for (const removed of [
    "R2_BACKUP_BUCKET",
    "BACKUP_AGE_RECIPIENT",
    "backup:d1:r2",
    "release:worker-version",
    "apply-session-epoch-compat",
    "verify-session-epoch-compat",
    "PRODUCTION_SOURCE_SHA",
    "SMOKE_WORKER_VERSION_OVERRIDE_ID",
    "zero traffic"
  ]) {
    assert.ok(!deploy.includes(removed), removed);
  }

  const rollbackWorkerSmoke = deploy.slice(
    deploy.indexOf("Verify rollback Worker against migrated schema"),
    deploy.indexOf("Deploy Worker directly to production")
  );
  for (const envName of [
    "SMOKE_BASE_URL",
    "SMOKE_USERNAME",
    "SMOKE_PASSWORD",
    "SMOKE_ADMIN_USERNAME",
    "SMOKE_ADMIN_PASSWORD",
    "SMOKE_REQUIRE_ADMIN"
  ]) {
    assert.ok(rollbackWorkerSmoke.includes(envName), envName);
  }
  assert.match(rollbackWorkerSmoke, /npm run smoke:release 2>&1 \| tee release-evidence\/pre-deploy-smoke\.txt/);
  // readiness는 각 Worker version이 스스로 정의하므로 rollback 대상에는 요구하지 않고
  // 이번에 배포하는 version에만 요구한다.
  assert.match(rollbackWorkerSmoke, /SMOKE_REQUIRE_READINESS: "0"/);
  assert.match(
    deploy.slice(
      deploy.indexOf("Post-deploy transport, login and read-only search smoke"),
      deploy.indexOf("Roll back Worker after release failure")
    ),
    /SMOKE_REQUIRE_READINESS: "1"/
  );
  assert.match(
    deploy,
    /Verify current Worker compatibility before migration[\s\S]*pre-migration-health\.json[\s\S]*rollbackCompatibility\.sessionEpoch == 1/
  );
});

test("Cloudflare token은 필요한 step에만 있고 D1 복구 증빙에는 데이터 사본이 없다", () => {
  const deployJobStart = deploy.indexOf("\n  deploy:");
  const deployStepsStart = deploy.indexOf("\n    steps:", deployJobStart);
  const deployJobEnvironment = deploy.slice(deployJobStart, deployStepsStart);
  assert.doesNotMatch(deployJobEnvironment, /CLOUDFLARE_API_TOKEN/);
  assert.ok((deploy.match(/secrets\.CLOUDFLARE_API_TOKEN/g)?.length || 0) >= 2);
  assert.doesNotMatch(
    deploy,
    /CLOUDFLARE_D1_BACKUP_API_TOKEN|CLOUDFLARE_D1_MIGRATE_API_TOKEN|CLOUDFLARE_WORKERS_DEPLOY_API_TOKEN|D1_BACKUP_PASSPHRASE|secrets\.SMOKE_/
  );
  assert.match(deploy, /d1-recovery\.json[\s\S]*migration-manifest\.json/);
  assert.doesNotMatch(deploy, /release-backup\/|\*\.sql|\*\.enc|\*\.age/);
  assert.equal((deploy.match(/environment:\s*\n\s+name: production/g)?.length || 0), 1);
  assert.doesNotMatch(deploy, /name: production-backup/);
});

test("guarded D1 명령은 과거 database 이름을 mutation·조회 대상으로 고정하지 않는다", () => {
  for (const [name, source] of guardedD1Scripts) {
    assert.doesNotMatch(source, /"d1",\s*"(?:execute|migrations)"[\s\S]{0,80}"hanlim-archive"/, name);
  }
});

test("기본 Wrangler 환경은 운영 Worker와 D1을 직접 가리키지 않고 production preview를 차단한다", () => {
  const topLevel = wrangler.slice(0, wrangler.indexOf('"env"'));
  assert.match(topLevel, /"name": "hanlim-archive-local"/);
  assert.match(topLevel, /"workers_dev": false/);
  assert.match(topLevel, /"preview_urls": false/);
  assert.doesNotMatch(topLevel, /a07324c0-7547-48a6-836e-3f0c50b85c36/);
  assert.doesNotMatch(topLevel, /e9dc4469-30ca-47c7-ad01-6aa9aea0b3ac/);
  assert.match(
    wrangler,
    /"production": \{[\s\S]*"name": "hanlim-archive"[\s\S]*"workers_dev": true[\s\S]*"preview_urls": false/
  );
  assert.match(
    wrangler,
    /"production": \{[\s\S]*"database_name": "hanlim-archive-core-20260823"[\s\S]*"database_id": "a07324c0-7547-48a6-836e-3f0c50b85c36"/
  );
  assert.match(
    wrangler,
    /"run_worker_first": \["\/\*", "!\/assets\/\*", "!\/images\/\*", "!\/favicon\.ico"\]/
  );
  for (const path of ["/assets/*", "/images/*", "/favicon.ico"]) {
    assert.ok(assetHeaders.includes(path), path);
  }
  for (const header of [
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "X-Robots-Tag"
  ]) {
    assert.ok(assetHeaders.includes(header), header);
  }
});

test("증빙을 tee로 보존하는 CI와 배포 단계는 원 명령의 실패를 전파한다", () => {
  assert.match(ci, /set -o pipefail\s+npm run deploy:dry 2>&1 \| tee/);
  for (const command of [
    "npm run deploy:dry",
    "npm run db:migrate:remote",
    "node scripts/deploy-guarded.mjs",
    "npm run smoke:release"
  ]) {
    const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(deploy, new RegExp(`set -o pipefail\\s+${escaped}[^\\n]*\\| tee`), command);
  }
  assert.match(deploy, /set -o pipefail[\s\S]*npx wrangler rollback "\$PREVIOUS_VERSION_ID"[^\n]*[\s\S]*\| tee release-evidence\/rollback\.txt/);
  assert.doesNotMatch(deploy, /npx wrangler d1 migrations apply hanlim-archive --remote/);
  assert.doesNotMatch(deploy, /set -o pipefail\s+npx wrangler deploy/);
});

test("npm test는 생성 보고서가 아니라 tests 디렉터리만 실행한다", () => {
  assert.equal(packageJson.scripts.test, "node --test tests/*.test.js");
  assert.equal(packageJson.scripts["test:coverage"], "node --test --experimental-test-coverage tests/*.test.js");
});

test("독립 Admin provisioning은 수동 production Environment 승인과 guarded script만 사용한다", () => {
  assert.match(provisionAdmin, /workflow_dispatch/);
  assert.match(provisionAdmin, /environment:\s+name: production/);
  assert.match(provisionAdmin, /npm run admin:provision:remote/);
  assert.match(provisionAdmin, /npm run admin:check:remote/);
  assert.match(provisionAdmin, /ADMIN_PROVISION_PASSWORD: \$\{\{ secrets\.ADMIN_PROVISION_PASSWORD \}\}/);
  assert.match(provisionAdmin, /ADMIN_PROVISION_OPERATION_ID: github-run-\$\{\{ github\.run_id \}\}/);
  assert.doesNotMatch(provisionAdmin, /123456|nkh92@hanlim\.com/);
});

test("메인 Admin 보안 복구는 별도 secret·production 승인·독립 Admin 확인을 강제한다", () => {
  assert.match(remediateMainAdmin, /workflow_dispatch/);
  assert.match(remediateMainAdmin, /environment:\s+name: production/);
  assert.match(remediateMainAdmin, /npm run admin:check:remote/);
  assert.match(remediateMainAdmin, /npm run admin:remediate-main:remote/);
  assert.match(
    remediateMainAdmin,
    /MAIN_ADMIN_REMEDIATION_PASSWORD: \$\{\{ secrets\.MAIN_ADMIN_REMEDIATION_PASSWORD \}\}/
  );
  assert.match(
    remediateMainAdmin,
    /MAIN_ADMIN_REMEDIATION_OPERATION_ID: github-run-\$\{\{ github\.run_id \}\}/
  );
  assert.ok(
    remediateMainAdmin.indexOf("npm run admin:check:remote")
      < remediateMainAdmin.indexOf("npm run admin:remediate-main:remote")
  );
});

test("CODEOWNERS는 migration, security, audit, workflow 변경을 지정한다", () => {
  for (const ownerPath of [
    "/.github/workflows/",
    "/cloudflare-app/migrations/",
    "/cloudflare-app/src/platform/security/",
    "/cloudflare-app/src/domains/audit/"
  ]) {
    assert.ok(owners.includes(ownerPath), ownerPath);
  }
});
