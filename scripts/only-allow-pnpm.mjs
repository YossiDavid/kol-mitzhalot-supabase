// Root "preinstall" guard: this project installs with pnpm only.
// npm is already stopped earlier by `engines.npm` + `engine-strict` (.npmrc),
// before it writes anything, and yarn by corepack via `packageManager`.
// This catches bun, which ignores both — bun writes bun.lock/node_modules
// before running preinstall, so the message says what to clean up.
// Every package manager sets npm_config_user_agent, e.g. "pnpm/10.33.2 npm/? node/v20...".
const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm/")) {
  const detected = userAgent.split(" ")[0] || "unknown";
  console.error(
    `\nThis project uses pnpm only (detected: ${detected}).\n` +
      "Remove any node_modules / package-lock.json / yarn.lock / bun.lock it created, then run: pnpm install\n",
  );
  process.exit(1);
}
