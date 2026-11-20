import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiDir = path.join(root, "src", "app", "api");
const stashDir = path.join(root, ".api-stash-tmp");
const nextCacheDir = path.join(root, ".next");

let movedApi = false;

function restoreApi() {
  if (movedApi && fs.existsSync(stashDir)) {
    fs.renameSync(stashDir, apiDir);
    movedApi = false;
  }
}

process.on("SIGINT", () => {
  restoreApi();
  process.exit(130);
});
process.on("SIGTERM", () => {
  restoreApi();
  process.exit(143);
});

try {
  // Clean .next to prevent stale Route Handler type/manifest cache during static export
  if (fs.existsSync(nextCacheDir)) {
    fs.rmSync(nextCacheDir, { recursive: true, force: true });
  }

  if (fs.existsSync(apiDir)) {
    if (fs.existsSync(stashDir)) {
      fs.rmSync(stashDir, { recursive: true, force: true });
    }
    fs.renameSync(apiDir, stashDir);
    movedApi = true;
  }

  console.log("[build-mobile] Building static web bundle for Capacitor Android...");
  execSync("npx next build", {
    stdio: "inherit",
    env: {
      ...process.env,
      CAPACITOR_BUILD: "1",
    },
  });
  console.log("[build-mobile] Static bundle exported to out/");
} finally {
  restoreApi();
}
