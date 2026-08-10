import { writeFile } from "node:fs/promises";

const [url, output, width = "375", height = "812", port = "9233"] = process.argv.slice(2);
if (!url || !output) throw new Error("Usage: node tools/capture_responsive_audit.mjs <url> <output.png> [width] [height] [debugPort]");

const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let sequence = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function command(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

await command("Page.enable");
await command("Runtime.enable");
await command("Emulation.setDeviceMetricsOverride", {
  width: Number(width),
  height: Number(height),
  deviceScaleFactor: 1,
  mobile: true,
  screenWidth: Number(width),
  screenHeight: Number(height),
});
await command("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await command("Emulation.setEmulatedMedia", {
  features: [{ name: "pointer", value: "coarse" }, { name: "hover", value: "none" }],
});
await command("Page.navigate", { url });
await new Promise((resolve) => setTimeout(resolve, 2500));

const metrics = await command("Runtime.evaluate", {
  expression: `JSON.stringify({innerWidth, innerHeight, scrollWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, title: document.title})`,
  returnByValue: true,
});
const screenshot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile(output, Buffer.from(screenshot.data, "base64"));
process.stdout.write(`${metrics.result.value}\n`);
socket.close();
await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
