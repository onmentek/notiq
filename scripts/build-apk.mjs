import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const androidDir = path.join(root, "android");
const distDir = path.join(root, "dist");

const androidHome =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  path.join(os.homedir(), "android-sdk");

if (!fs.existsSync(androidHome)) {
  console.error(
    `[build-apk] ANDROID_HOME not found at ${androidHome}. Set ANDROID_HOME first.`
  );
  process.exit(1);
}

const localPropsPath = path.join(androidDir, "local.properties");
fs.writeFileSync(localPropsPath, `sdk.dir=${androidHome}\n`, "utf8");

const gradleArgs = ["assembleDebug", "--no-daemon"];

// On ARM64 Linux hosts, use official Google aapt2 wrapper if present
const aapt2Wrapper = path.join(androidHome, "bin", "aapt2");
if (process.arch === "arm64") {
  if (fs.existsSync(aapt2Wrapper)) {
    gradleArgs.push(`-Pandroid.aapt2FromMavenOverride=${aapt2Wrapper}`);
  } else if (fs.existsSync("/usr/bin/aapt2")) {
    gradleArgs.push("-Pandroid.aapt2FromMavenOverride=/usr/bin/aapt2");
  }
}

console.log(`[build-apk] Running ./gradlew ${gradleArgs.join(" ")} ...`);
execSync(`./gradlew ${gradleArgs.join(" ")}`, {
  cwd: androidDir,
  stdio: "inherit",
  env: {
    ...process.env,
    ANDROID_HOME: androidHome,
    ANDROID_SDK_ROOT: androidHome,
  },
});

const builtApk = path.join(
  androidDir,
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk"
);

if (!fs.existsSync(builtApk)) {
  console.error(`[build-apk] Expected APK not found at ${builtApk}`);
  process.exit(1);
}

fs.mkdirSync(distDir, { recursive: true });
const outApk = path.join(distDir, "notiq-android.apk");
fs.copyFileSync(builtApk, outApk);

const sizeMb = (fs.statSync(outApk).size / (1024 * 1024)).toFixed(2);
console.log(`[build-apk] APK ready: ${outApk} (${sizeMb} MB)`);
