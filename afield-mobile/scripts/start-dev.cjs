const { spawn } = require("node:child_process");
const child = spawn(
  process.execPath,
  [require.resolve("expo/bin/cli"), "start", ...process.argv.slice(2)],
  { stdio: "inherit", env: { ...process.env, AFIELD_ENABLE_DEV_ROUTES: "1" } },
);
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code || 0);
});
