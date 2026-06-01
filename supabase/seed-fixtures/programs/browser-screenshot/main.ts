import puppeteer from "puppeteer-core";

// Connects to a real Chromium on Cloudflare Browser Run over the Chrome DevTools
// Protocol. The two secrets declared in marbleconfig.jsonc — CF_ACCOUNT_ID and a
// CF_API_TOKEN with the "Browser Rendering - Edit" permission — are injected into
// the sandbox as environment variables at run time.
const connectToBrowser = () => {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error(
      "Browser Run is not configured for this workspace (missing CF_ACCOUNT_ID / CF_API_TOKEN).",
    );
  }

  return puppeteer.connect({
    browserWSEndpoint: `wss://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/devtools/browser?keep_alive=60000`,
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
  });
};

export default async ({ input }) => {
  const browser = await connectToBrowser();

  try {
    const page = await browser.newPage();
    await page.goto(input.url, {
      timeout: 45_000,
      waitUntil: "networkidle0",
    });

    const screenshot = await page.screenshot({
      encoding: "base64",
      fullPage: input.fullPage ?? false,
      type: "png",
    });

    return {
      screenshot,
      title: await page.title(),
      url: page.url(),
    };
  } finally {
    // Always release the remote browser so it doesn't linger against your
    // Browser Run concurrency limit.
    await browser.close();
  }
};
