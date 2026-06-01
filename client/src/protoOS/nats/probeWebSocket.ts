export function probeWebSocket(url: string, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    let settled = false;

    const settle = (result: boolean) => {
      if (settled) return;
      settled = true;
      ws.close();
      resolve(result);
    };

    ws.addEventListener("open", () => settle(true));
    ws.addEventListener("error", () => settle(false));
    setTimeout(() => settle(false), timeoutMs);
  });
}
