import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { windowEnd } from "../src/quota";

const counter = () => env.QUOTAS.getByName(crypto.randomUUID());

describe("persistent quota counters", () => {
  it.each(["minute", "day", "month"] as const)(
    "admits exactly the %s limit under concurrency",
    async (period) => {
      const stub = counter();
      const results = await Promise.all(Array.from({ length: 30 }, () => stub.consume(period, 5)));
      expect(results.filter((result) => result.success)).toHaveLength(5);
      expect(results.every((result) => result.retryAfter > 0)).toBe(true);
    },
  );

  it("retains a spent allowance after eviction", async () => {
    const stub = counter();
    expect((await stub.consume("day", 1)).success).toBe(true);
    await evictDurableObject(stub);
    expect((await stub.consume("day", 1)).success).toBe(false);
  });

  it("keeps IPs independent while sharing the monthly budget", async () => {
    const first = counter();
    const second = counter();
    const budget = counter();
    expect((await first.consume("day", 1)).success).toBe(true);
    expect((await first.consume("day", 1)).success).toBe(false);
    expect((await second.consume("day", 1)).success).toBe(true);
    const admissions = await Promise.all([budget.consume("month", 1), budget.consume("month", 1)]);
    expect(admissions.filter((result) => result.success)).toHaveLength(1);
  });

  it.each(["minute", "day", "month"] as const)("resets an expired %s window", async (period) => {
    const stub = counter();
    await runInDurableObject(stub, (_instance, state) => {
      state.storage.kv.put(period, { count: 10000, expires: Date.now() - 1 });
    });
    expect((await stub.consume(period, 1)).success).toBe(true);
    expect((await stub.consume(period, 1)).success).toBe(false);
  });

  it("expires old counters without clearing active allowances", async () => {
    const stub = counter();
    await stub.consume("day", 1);
    await runInDurableObject(stub, (_instance, state) => {
      state.storage.kv.put("minute", { count: 5, expires: Date.now() - 1 });
    });
    await runDurableObjectAlarm(stub);
    await runInDurableObject(stub, async (_instance, state) => {
      expect(state.storage.kv.get("minute")).toBeUndefined();
      expect(state.storage.kv.get("day")).toBeDefined();
      expect(await state.storage.getAlarm()).toBeGreaterThan(Date.now());
    });
    expect((await stub.consume("day", 1)).success).toBe(false);
  });

  it("uses UTC calendar boundaries including leap years and December", () => {
    for (const [date, expected] of [
      ["2028-02-29T23:59:59Z", "2028-03-01T00:00:00Z"],
      ["2026-12-31T23:59:59Z", "2027-01-01T00:00:00Z"],
    ]) {
      for (const period of ["minute", "day", "month"] as const) {
        expect(windowEnd(period, Date.parse(date))).toBe(Date.parse(expected));
      }
    }
  });
});
