import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { fetchCistourPriceWithRefresh } from "./cistour.js";
import { buildComparison, buildEmailHtml, buildPlainText } from "./core.js";
import { sendPriceEmail } from "./email.js";
import {
  ALERT_EMAIL,
  API_TOKEN,
  MAIL_FROM,
  PORT,
  PURCHASE_PRICE,
  CISTOUR_ROOM_ID,
  CISTOUR_SEARCH_ID,
  CISTOUR_SEARCH_URL,
  RESEND_API_KEY
} from "./config.js";

function createMcpServer() {
  const server = new McpServer(
    { name: "cistour-price-monitor", version: "1.0.0" },
    { instructions: "Primește doar linkuri Cistour get_package_details. Compară price cu prețul de cumpărare de 2084 EUR." }
  );

  server.registerTool(
    "check_cistour_price",
    {
      title: "Verifică prețul Cistour",
      description: "Extrage prețul camerei identificată de un link Cistour și îl compară cu prețul de cumpărare.",
      inputSchema: { url: z.string().url() },
      outputSchema: comparisonSchema(),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true }
    },
    async ({ url }) => toolResult(await check(url), false)
  );

  server.registerTool(
    "check_cistour_price_and_email",
    {
      title: "Verifică prețul și trimite email",
      description: "Verifică prețul din linkul Cistour și trimite raportul HTML la adresa configurată pe server.",
      inputSchema: { url: z.string().url() },
      outputSchema: { ...comparisonSchema(), emailSent: z.boolean() },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
    },
    async ({ url }) => {
      const result = await check(url);
      await emailResult(result);
      return toolResult({ ...result, emailSent: true }, true);
    }
  );

  return server;
}

function comparisonSchema() {
  return {
    purchasePrice: z.number(), currentPrice: z.number(), difference: z.number(), signedDifference: z.string(),
    direction: z.enum(["higher", "lower", "same"]), color: z.string(), currency: z.string(), available: z.boolean(),
    roomId: z.string(), roomName: z.string(), sourceUrl: z.string(),
    requestedRoomId: z.string().optional(), warning: z.string().optional()
  };
}

async function check(url) {
  const room = await fetchCistourPriceWithRefresh({
    detailsUrl: url,
    searchId: CISTOUR_SEARCH_ID,
    searchUrl: CISTOUR_SEARCH_URL,
    roomId: CISTOUR_ROOM_ID
  });
  return {
    ...buildComparison(room.price, PURCHASE_PRICE, room.currency),
    available: room.available, roomId: room.roomId, roomName: room.roomName, sourceUrl: room.sourceUrl,
    requestedRoomId: room.requestedRoomId, warning: room.warning
  };
}

async function emailResult(result) {
  return sendPriceEmail({
    to: ALERT_EMAIL,
    from: MAIL_FROM,
    apiKey: RESEND_API_KEY,
    subject: `Preț excursie Cistour: ${result.signedDifference} ${result.currency}`,
    html: buildEmailHtml(result, result.sourceUrl),
    text: buildPlainText(result)
  });
}

function toolResult(result, emailSent) {
  const suffix = emailSent ? "\nEmailul a fost trimis." : "";
  return {
    structuredContent: result,
    content: [{ type: "text", text: `${buildPlainText(result)}${suffix}` }]
  };
}

async function startHttp() {
  const app = express();
  app.use(express.json({ limit: "32kb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  async function checkAndNotify(req, res) {
    try {
      const url = req.method === "GET" ? req.query.url : req.body?.url;
      const result = await check(url);
      await emailResult(result);
      res.json({ ...result, emailSent: true });
    } catch (error) {
      console.error(`[HTTP] /check-and-notify a eșuat: ${safeError(error)}`);
      res.status(422).json({ error: safeError(error) });
    }
  }

  app.post("/check-and-notify", requireApiToken, checkAndNotify);
  app.get("/check-and-notify", requireApiToken, checkAndNotify);

  app.post("/mcp", requireApiToken, async (req, res) => {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) res.status(500).json({ error: safeError(error) });
    }
  });

  app.all("/mcp", (_req, res) => res.status(405).set("Allow", "POST").end());

  app.listen(PORT, () => console.error(`Cistour Price Monitor listening on ${PORT}`));
}

function requireApiToken(req, res, next) {
  if (req.get("authorization") !== `Bearer ${API_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function safeError(error) {
  return error instanceof Error ? error.message : "Eroare necunoscută";
}

if (process.argv.includes("--stdio")) {
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
} else {
  await startHttp();
}
