import { expect, test, type Page, type Request } from "@playwright/test";

/**
 * Proves GTM / GA never talk to Google until analytics consent is granted,
 * and never on private paths. Matches the privacy policy: off by default,
 * and "if you decline, nothing is stored or sent."
 */

const GA_HOST =
  /googletagmanager\.com|google-analytics\.com|analytics\.google\.com|\/g\/collect/i;

function isAnalyticsRequest(req: Request): boolean {
  return GA_HOST.test(req.url());
}

async function collectAnalyticsUrls(
  page: Page,
  action: () => Promise<void>,
  settleMs = 1500,
): Promise<string[]> {
  const urls: string[] = [];
  const onReq = (req: Request) => {
    if (isAnalyticsRequest(req)) urls.push(req.url());
  };
  page.on("request", onReq);
  try {
    await action();
    await page.waitForTimeout(settleMs);
  } finally {
    page.off("request", onReq);
  }
  return urls;
}

test.describe("Consent-gated analytics (no cookieless pings)", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.addInitScript(() => {
      try {
        localStorage.removeItem("rc-analytics-consent");
      } catch {
        /* ignore */
      }
    });
  });

  test("(a) no Google Analytics / GTM before a consent choice", async ({
    page,
  }) => {
    const urls = await collectAnalyticsUrls(page, async () => {
      await page.goto("/");
      await expect(
        page.getByRole("region", { name: /cookie choices/i }),
      ).toBeVisible();
    });
    expect(urls, urls.join("\n")).toEqual([]);
  });

  test("(b) Decline then navigate — still no analytics requests", async ({
    page,
  }) => {
    const urls = await collectAnalyticsUrls(page, async () => {
      await page.goto("/");
      await page.getByRole("button", { name: /^Decline$/i }).click();
      await expect(
        page.getByRole("region", { name: /cookie choices/i }),
      ).toHaveCount(0);
      await page.goto("/pricing");
      await expect(page.getByRole("heading", { name: /pricing/i })).toBeVisible();
    });
    expect(urls, urls.join("\n")).toEqual([]);
  });

  test("(c) after Accept, consent is granted and gtm.js is requested", async ({
    page,
  }) => {
    // Google's hosts are answered here instead of on the network. This test
    // used to wait for the real gtm.js and for the container to fire a GA4
    // collect, so CI went red whenever Google was slow, blocked or the
    // container changed, none of which is a regression in this app. What the
    // app itself must do on Accept is checked: update consent and inject the
    // container script. That the container then reports a page_view is a
    // production check (docs/RUNBOOK.md section 9).
    const urls: string[] = [];
    await page.route(
      /googletagmanager\.com|google-analytics\.com|analytics\.google\.com/i,
      (route) => {
        urls.push(route.request().url());
        return route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: "/* stubbed in e2e */",
        });
      },
    );

    await page.goto("/");
    await page.getByRole("button", { name: /^Accept$/i }).click();

    await expect
      .poll(
        () => urls.some((u) => /googletagmanager\.com\/gtm\.js\?.*\bid=GTM-/i.test(u)),
        { timeout: 15_000 },
      )
      .toBe(true);

    // Only analytics is granted; advertising signals stay denied.
    const consentUpdates = await page.evaluate(() => {
      const layer = (window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? [];
      return Array.from(layer)
        .map((entry) => Array.from(entry as ArrayLike<unknown>))
        .filter((entry) => entry[0] === "consent" && entry[1] === "update")
        .map((entry) => entry[2] as Record<string, string>);
    });
    expect(consentUpdates).toContainEqual({ analytics_storage: "granted" });
    for (const update of consentUpdates) {
      expect(update.ad_storage ?? "denied").toBe("denied");
    }
  });

  test("(d) private paths never load GTM even with consent granted", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("rc-analytics-consent", "granted");
    });

    // /invite/* stays on a private path (no redirect to /login).
    const inviteUrls = await collectAnalyticsUrls(page, async () => {
      await page.goto("/invite/UXTEST00");
      await expect(page).toHaveURL(/\/invite\//);
    });
    expect(inviteUrls, inviteUrls.join("\n")).toEqual([]);

    // Auth gates redirect to /login (public). Capture requests only while the
    // document URL is still a private prefix — GTM must not inject there.
    for (const path of ["/connections", "/account", "/onboarding"]) {
      const privateHits: string[] = [];
      const onReq = (req: Request) => {
        if (!isAnalyticsRequest(req)) return;
        const loc = page.url();
        if (
          /\/(connections|account|onboarding|auth|invite)(\/|$|\?)/.test(loc)
        ) {
          privateHits.push(req.url());
        }
      };
      page.on("request", onReq);
      try {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1000);
      } finally {
        page.off("request", onReq);
      }
      expect(privateHits, `${path}: ${privateHits.join("\n")}`).toEqual([]);
    }
  });
});
