// cdp.mjs — minimal Chrome DevTools Protocol driver (no dependencies).
// Launches headless Chromium, opens one page, collects console errors and
// external requests, and offers eval / input / screenshot primitives.
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME
  || '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';

export async function launchPage(port) {
  const dbg = 9400 + Math.floor(Math.random() * 400);
  const proc = spawn(CHROME, [
    '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + dbg, '--window-size=1280,720', 'about:blank',
  ], { stdio: 'ignore' });
  const base = 'http://127.0.0.1:' + dbg;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(base + '/json/version'); if (r.ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  const created = await (await fetch(base + '/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(created.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) for (const fn of listeners) fn(msg);
  };
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++seq; pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const errors = [], external = [];
  const allowed = 'http://localhost:' + port;
  listeners.push((msg) => {
    if (msg.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || 'unknown'));
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push('console.error: ' + msg.params.args.map((a) => a.value || a.description || '').join(' '));
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push('log: ' + msg.params.entry.text);
    if (msg.method === 'Network.requestWillBeSent') {
      const u = msg.params.request.url;
      if (!u.startsWith(allowed) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u);
    }
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error('eval failed: ' + expr.slice(0, 80) + ' :: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result?.result?.value;
  };
  const waitFor = async (expr, ms = 12000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await evaluate(expr)) return true; await new Promise((r) => setTimeout(r, 120)); }
    throw new Error('timeout waiting for: ' + expr);
  };
  return {
    errors, external,
    async navigate(url) { await send('Page.navigate', { url }); },
    evaluate, waitFor,
    async mouse(type, x, y, button = 'left', buttons = 0) {
      await send('Input.dispatchMouseEvent', { type, x, y, button, buttons, clickCount: type === 'mousePressed' ? 1 : 0 });
    },
    async key(type, code, vk, text) {
      await send('Input.dispatchKeyEvent', { type, code, key: code.replace('Key', '').replace('Digit', ''), windowsVirtualKeyCode: vk, text: text || undefined });
    },
    async screenshotJpeg(quality) {
      const r = await send('Page.captureScreenshot', { format: 'jpeg', quality, captureBeyondViewport: false });
      return Buffer.from(r.result.data, 'base64');
    },
    async close() { try { ws.close(); } catch { /* noop */ } proc.kill('SIGKILL'); },
  };
}
