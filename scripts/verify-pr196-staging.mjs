#!/usr/bin/env node
"use strict";

/**
 * PR #196 staging verification runner.
 *
 * Safety: mocked local tests only; no deployment, merge, migration, or DB writes.
 * Requires explicit isolation acknowledgement and performs a read-only GET /healthz.
 *
 * Usage:
 *   STAGING_ISOLATED=true STAGING_URL=https://your-staging-host node scripts/verify-pr196-staging.mjs
 *   node scripts/verify-pr196-staging.mjs --preflight-only
 *   node scripts/verify-pr196-staging.mjs --full-suite
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const EXPECTED_BRANCH = "feat/native-email-outbox-phase3-atomicity";
const EXPECTED_REPO = "faznetwork/faznetworknet";
const TARGET_TESTS = [
  "test/rbacEmailTransaction.test.js",
  "test/emailOutbox.test.js",
  "test/emailService.test.js",
  "test/notificationDispatcher.test.js"
];
const DATABASE_ENV_KEYS = [
  "DATABASE_URL", "DATABASE_URI", "POSTGRES_URL", "POSTGRESQL_URL",
  "SUPABASE_DB_URL", "SUPABASE_DATABASE_URL", "PGHOST"
];
const args = new Set(process.argv.slice(2));
const preflightOnly = args.has("--preflight-only");
const fullSuite = args.has("--full-suite");
const results = [];
let failed = false;

function report(name, status, detail = "") {
  results.push({ name, status, detail });
  const suffix = detail ? " — " + detail : "";
  const line = "[" + status + "] " + name + suffix + "\n";
  (status === "FAIL" ? process.stderr : process.stdout).write(line);
  if (status === "FAIL") failed = true;
}

function run(command, commandArgs, timeout = 10 * 60 * 1000) {
  const result = spawnSync(command, commandArgs, {
    cwd: ROOT, encoding: "utf8", env: process.env, timeout,
    maxBuffer: 8 * 1024 * 1024, shell: false, windowsHide: true
  });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function git(args) { return run("git", args, 30_000); }
function assert(condition, message) { if (!condition) throw new Error(message); }
function normalizeRepo(remote) {
  return String(remote || "").trim().replace(/\.git$/i, "")
    .replace(/^git@github\.com:/i, "https://github.com/")
    .replace(/^ssh:\/\/git@github\.com\//i, "https://github.com/")
    .replace(/^https:\/\/github\.com\//i, "")
    .replace(/^http:\/\/github\.com\//i, "").toLowerCase();
}

async function checkHealth() {
  const raw = process.env.STAGING_URL;
  assert(raw, "STAGING_URL is required for the read-only staging health check.");
  let url;
  try { url = new URL(raw); }
  catch { throw new Error("STAGING_URL must be a valid absolute URL."); }
  assert(url.protocol === "https:", "STAGING_URL must use HTTPS.");
  assert(!url.username && !url.password, "STAGING_URL must not contain credentials.");
  assert(!url.search && !url.hash, "STAGING_URL must not contain a query string or fragment.");
  assert(url.pathname === "/" || url.pathname === "", "Set STAGING_URL to the staging origin only, without a path.");
  const host = url.hostname.toLowerCase();
  const blocked = host === "faznetwork.com" || host === "www.faznetwork.com" ||
    host === "faznetwork-web.onrender.com" || host.includes("faznetwork-web-prod");
  assert(!blocked, "The configured URL matches a known production hostname and is blocked.");
  const healthUrl = new URL("/healthz", url.origin);
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(healthUrl, { method: "GET", redirect: "manual", signal: controller.signal, headers: { accept: "application/json" } });
      assert(response.status >= 200 && response.status < 300, "GET /healthz returned HTTP " + response.status + "; redirects are not followed.");
      const body = await response.json();
      assert(body && typeof body === "object" && body.status === "ok", 'GET /healthz did not return JSON with { status: "ok" }.');
      return "HTTP " + response.status + "; status=ok; attempt " + attempt + "/3";
    } catch (error) {
      lastError = error && error.message ? error.message : String(error);
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000));
    } finally { clearTimeout(timeout); }
  }
  throw new Error("Staging health check failed after 3 attempts: " + lastError);
}

async function main() {
  process.stdout.write("FAZ NETWORK — PR #196 staging verification\n");
  process.stdout.write("Safety mode: no deploy, merge, migration, or database writes.\n\n");
  try {
    const nodeMajor = Number(process.versions.node.split(".")[0]);
    assert(nodeMajor >= 20, "Node.js >=20 required; found " + process.versions.node + ".");
    report("Node.js version", "PASS", process.versions.node);

    assert(process.env.NODE_ENV !== "production", "NODE_ENV=production is forbidden for this runner.");
    assert(process.env.STAGING_ISOLATED === "true", "Set STAGING_ISOLATED=true only after confirming this is an isolated staging environment.");
    report("Environment safety acknowledgement", "PASS", "isolated staging explicitly acknowledged");

    const configuredDbKeys = DATABASE_ENV_KEYS.filter(key => Boolean(process.env[key]));
    assert(configuredDbKeys.length === 0, "Database connection variables must be unset for these mocked tests: " + configuredDbKeys.join(", ") + ".");
    report("Database isolation", "PASS", "no database connection environment variables present");

    const stagingRaw = process.env.STAGING_URL;
    assert(stagingRaw, "STAGING_URL is required before tests can run.");
    let stagingParsed;
    try { stagingParsed = new URL(stagingRaw); }
    catch { throw new Error("STAGING_URL must be a valid absolute URL."); }
    assert(stagingParsed.protocol === "https:", "STAGING_URL must use HTTPS.");
    assert(!stagingParsed.username && !stagingParsed.password && !stagingParsed.search && !stagingParsed.hash, "STAGING_URL must not contain credentials, a query, or a fragment.");
    assert(stagingParsed.pathname === "/" || stagingParsed.pathname === "", "STAGING_URL must be the staging origin only, without a path.");
    const stagingHost = stagingParsed.hostname.toLowerCase();
    assert(stagingHost !== "faznetwork.com" && stagingHost !== "www.faznetwork.com" && stagingHost !== "faznetwork-web.onrender.com" && !stagingHost.includes("faznetwork-web-prod"), "Known production hostname blocked.");
    report("Staging URL safety", "PASS", "HTTPS origin validated; health request remains read-only");

    const packagePath = path.join(ROOT, "package.json");
    assert(fs.existsSync(packagePath), "package.json is missing.");
    assert(fs.existsSync(path.join(ROOT, "package-lock.json")), "package-lock.json is missing.");
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    assert(pkg.engines && pkg.engines.node, "package.json must declare its Node.js engine.");
    assert(pkg.scripts && pkg.scripts.test === "node --test", 'Expected package.json script "test": "node --test". Review the runner if this contract changes.');
    assert(pkg.scripts && pkg.scripts.build === "node scripts/verify-build.js", 'Expected package.json script "build": "node scripts/verify-build.js". Review the runner if this contract changes.');
    assert(fs.existsSync(path.join(ROOT, "node_modules")), "node_modules is missing. Run npm ci before the verification runner.");
    report("Project scripts and dependencies", "PASS", "package scripts and node_modules verified");

    const branchResult = git(["branch", "--show-current"]);
    assert(branchResult.status === 0, branchResult.stderr.trim() || "Unable to read current branch.");
    const branch = branchResult.stdout.trim();
    assert(branch === EXPECTED_BRANCH, "Expected branch " + EXPECTED_BRANCH + "; found " + (branch || "(detached HEAD)") + ".");
    report("Current branch", "PASS", branch);

    const remoteResult = git(["remote", "get-url", "origin"]);
    assert(remoteResult.status === 0, "Git origin remote is not configured.");
    const remoteRepo = normalizeRepo(remoteResult.stdout);
    assert(remoteRepo === EXPECTED_REPO, "Expected origin " + EXPECTED_REPO + "; found " + (remoteRepo || "(empty remote)") + ".");
    report("Repository identity", "PASS", remoteRepo);

    const statusResult = git(["status", "--porcelain"]);
    assert(statusResult.status === 0, "Unable to inspect Git working tree.");
    assert(statusResult.stdout.trim() === "", "Working tree is not clean. Review and commit/stash intended changes before running.");
    report("Working tree", "PASS", "clean");

    const diffResult = git(["diff", "--check", "origin/main...HEAD"]);
    assert(diffResult.status === 0, "git diff --check failed: " + (diffResult.stderr || diffResult.stdout).trim());
    report("Diff whitespace check", "PASS", "origin/main...HEAD");

    const remoteHeadResult = git(["ls-remote", "origin", "refs/heads/" + EXPECTED_BRANCH]);
    assert(remoteHeadResult.status === 0, "Unable to verify branch head against origin.");
    const remoteHead = remoteHeadResult.stdout.trim().split(/\s+/)[0];
    assert(/^[0-9a-f]{40}$/i.test(remoteHead || ""), "Remote branch was not found or returned an invalid SHA.");
    const localHeadResult = git(["rev-parse", "HEAD"]);
    assert(localHeadResult.status === 0, "Unable to read local HEAD SHA.");
    const localHead = localHeadResult.stdout.trim();
    assert(localHead === remoteHead, "Local HEAD " + localHead + " differs from origin branch HEAD " + remoteHead + ". Fetch/review the branch first.");
    report("PR branch SHA", "PASS", localHead);

    for (const file of TARGET_TESTS) assert(fs.existsSync(path.join(ROOT, file)), "Required target test file is missing: " + file);
    report("Target test inventory", "PASS", TARGET_TESTS.join(", "));

    if (preflightOnly) { report("Execution", "SKIPPED", "--preflight-only requested; tests and health check were not run"); return; }

    const testResult = run(process.execPath, ["--test", ...TARGET_TESTS]);
    process.stdout.write(testResult.stdout);
    if (testResult.stderr) process.stderr.write(testResult.stderr);
    assert(testResult.status === 0, "Target regression/fault-injection tests failed (exit " + testResult.status + ").");
    report("Target regression/fault-injection tests", "PASS", "four existing Node.js test files passed");

    if (fullSuite) {
      const suiteResult = run(process.execPath, ["--test"]);
      process.stdout.write(suiteResult.stdout);
      if (suiteResult.stderr) process.stderr.write(suiteResult.stderr);
      assert(suiteResult.status === 0, "Full Node.js test suite failed (exit " + suiteResult.status + ").");
      report("Full test suite", "PASS", "node --test");
    } else report("Full test suite", "SKIPPED", "use --full-suite to run the full Node.js test suite");

    const buildResult = run(process.execPath, ["scripts/verify-build.js"]);
    process.stdout.write(buildResult.stdout);
    if (buildResult.stderr) process.stderr.write(buildResult.stderr);
    assert(buildResult.status === 0, "Build verification failed (exit " + buildResult.status + ").");
    report("Build verification", "PASS", "node scripts/verify-build.js");

    const health = await checkHealth();
    report("Staging health endpoint", "PASS", health);
  } catch (error) {
    report("Verification stopped", "FAIL", error && error.message ? error.message : String(error));
  } finally {
    process.stdout.write("\nVerification summary\n");
    for (const item of results) process.stdout.write(item.status.padEnd(7) + " " + item.name + (item.detail ? " — " + item.detail : "") + "\n");
    const hasSkipped = results.some(item => item.status === "SKIPPED");
    const hasFailure = results.some(item => item.status === "FAIL");
    process.stdout.write("\nResult: " + (hasFailure ? "FAIL" : hasSkipped ? "INCOMPLETE" : "PASS") + "\n");
    if (hasFailure || hasSkipped) process.exitCode = 1;
  }
}

main().catch(error => {
  process.stderr.write("[FATAL] Runner crashed: " + (error && error.stack ? error.stack : String(error)) + "\n");
  process.exitCode = 1;
});
