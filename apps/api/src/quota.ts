import { DurableObject } from "cloudflare:workers";

type Period = "minute" | "day" | "month";
type Counter = { count: number; expires: number };

export function windowEnd(period: Period, now: number): number {
  if (period === "minute") return (Math.floor(now / 60_000) + 1) * 60_000;
  if (period === "day") return (Math.floor(now / 86_400_000) + 1) * 86_400_000;
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

export class QuotaCounter extends DurableObject<CloudflareBindings> {
  async consume(period: Period, limit: number) {
    if (!["minute", "day", "month"].includes(period) || !Number.isSafeInteger(limit) || limit < 1) {
      throw new Error("Invalid quota configuration");
    }
    const now = Date.now();
    const expires = windowEnd(period, now);
    const success = this.ctx.storage.transactionSync(() => {
      const stored = this.ctx.storage.kv.get<Counter>(period);
      const count = stored?.expires === expires ? stored.count : 0;
      if (count >= limit) return false;
      this.ctx.storage.kv.put(period, { count: count + 1, expires });
      return true;
    });
    // Keep only the active windows. No raw IPs or image data are stored.
    if (success && (await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(expires);
    }
    return { success, retryAfter: Math.max(1, Math.ceil((expires - now) / 1000)) };
  }

  async alarm() {
    const now = Date.now();
    let next = Infinity;
    for (const period of ["minute", "day", "month"] as const) {
      const counter = this.ctx.storage.kv.get<Counter>(period);
      if (!counter) continue;
      if (counter.expires <= now) this.ctx.storage.kv.delete(period);
      else next = Math.min(next, counter.expires);
    }
    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(next);
  }
}
