// Keep the last successful response visible during a background refresh.
export function pollVisible<T>(
  fetch: () => Promise<T>,
  onResult: (value: T) => void,
  onFailure: () => void = () => {},
  interval = 30_000,
) {
  let active = true;
  let inFlight = false;
  async function refresh() {
    if (!active || inFlight || document.hidden) return;
    inFlight = true;
    try {
      const value = await fetch();
      if (active) onResult(value);
    } catch {
      if (active) onFailure();
    } finally {
      inFlight = false;
    }
  }
  const timer = window.setInterval(refresh, interval);
  document.addEventListener("visibilitychange", refresh);
  return () => {
    active = false;
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", refresh);
  };
}
