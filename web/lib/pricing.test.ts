import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { monthlyDisplay, PREMIUM_MONTHLY_DISPLAY, PREMIUM_MONTHLY_USD } from "./pricing";

describe("pricing", () => {
  it("formats the display price from the amount", () => {
    expect(monthlyDisplay("18.00")).toBe("$18/mo");
    expect(monthlyDisplay("9.99")).toBe("$9.99/mo");
    expect(PREMIUM_MONTHLY_DISPLAY).toBe(monthlyDisplay(PREMIUM_MONTHLY_USD));
    expect(PREMIUM_MONTHLY_USD).toMatch(/^\d+\.\d{2}$/);
  });

  it("is the only place a monthly price is written down", () => {
    const root = join(__dirname, "..");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (["node_modules", ".next", "dist", "e2e", "test-results"].includes(name)) continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !p.endsWith(join("lib", "pricing.ts"))) {
          const text = readFileSync(p, "utf8");
          if (/\$\d+(\.\d{2})?\s*\/\s*mo\b/.test(text) || /price:\s*["']\d+\.\d{2}["']/.test(text)) offenders.push(p);
        }
      }
    };
    for (const d of ["app", "components", "lib"]) walk(join(root, d));
    expect(offenders).toEqual([]);
  });
});
