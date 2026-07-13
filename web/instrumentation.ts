export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.on("unhandledRejection", (reason) => {
      console.error(`[instrumentation-trace] UNHANDLED REJECTION t=${Date.now()} reason=${reason instanceof Error ? reason.stack : String(reason)}`);
    });
    process.on("uncaughtException", (err) => {
      console.error(`[instrumentation-trace] UNCAUGHT EXCEPTION t=${Date.now()} err=${err.stack}`);
    });
  }
}
