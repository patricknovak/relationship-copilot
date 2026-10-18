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

  test("(c) after Accept, gtm.js loads and a page_view collect fires", async ({
    page,
  }) => {
    const urls: string[] = [];
    page.on("request", (req) => {
      if (isAnalyticsRequest(req)) urls.push(req.url());
    });

    await page.goto("/");
    await page.getByRole("button", { name: /^Accept$/i }).click();

    await expect
      .poll(
        () => urls.some((u) => /googletagmanager\.com\/gtm\.js/i.test(u)),
        { timeout: 15_000 },
      )
      .toBe(true);

    await expect
      .poll(
        () =>
          urls.some(
            (u) =>
              /google-analytics\.com\/g\/collect/i.test(u) ||
              /analytics\.google\.com\/g\/collect/i.test(u),
          ),
        { timeout: 15_000 },
      )
      .toBe(true);
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
