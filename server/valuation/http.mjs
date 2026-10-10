import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createJobStore } from "./jobs.mjs";
import { interpretMacro } from "./macro/interpret.mjs";
import { discoverBackends, BACKENDS } from "./cli/registry.mjs";
import { listModels } from "./models/index.mjs";
import { searchCompanies, validateSecurity } from "./data/identity.mjs";
// 本地开发页 + 线上站点（线上页面由用户浏览器直连其本机服务，密钥不经过任何服务器）
const HOSTED_ORIGINS = [
  "https://turbosnails.github.io",
  "https://businessweb-c0u.pages.dev",
];
function originAllowed(origin) {
  if (/^http:\/\/(localhost|127\.0\.0\.1):(5173|5174|5175|8788)$/.test(origin))
    return true;
  const extra = (process.env.VALUATION_ALLOWED_ORIGINS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return [...HOSTED_ORIGINS, ...extra].includes(origin);
}
export function createValuationServer({
  store = createJobStore(),
  // 宏观温度的 AI 解读：独立队列，不和估值任务互相占用
  macroStore = createJobStore({ execute: interpretMacro, timeout: 600000 }),
  token = randomBytes(24).toString("hex"),
} = {}) {
  const server = createServer(async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    const origin = req.headers.origin;
    if (origin && !originAllowed(origin))
      return send(403, { error: "仅允许本地开发页面或已登记的站点访问" });
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || ""))
      return send(403, { error: "本地Host无效" });
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type,X-Valuation-Token",
      );
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Private-Network", "true");
      return res.end();
    }
    const url = new URL(req.url, "http://127.0.0.1"),
      path = url.pathname.replace(/^\/api\/valuation/, "");
    try {
      if (path === "/health" && req.method === "GET")
        // features：页面据此判断本地服务是否需要重启升级
        return send(200, { ok: true, version: 2, features: ["macro-interpret", "activity-progress"], token });
      if (req.method === "POST") {
        const supplied = Buffer.from(
            String(req.headers["x-valuation-token"] || ""),
          ),
          expected = Buffer.from(token);
        if (
          supplied.length !== expected.length ||
          !timingSafeEqual(supplied, expected)
        )
          return send(403, { error: "本地会话已失效，请刷新连接" });
      }
      if (path === "/backends" && req.method === "GET")
        return send(200, await discoverBackends());
      if (path === "/models" && req.method === "GET")
        return send(
          200,
          await listModels(url.searchParams.get("backend"), {
            refresh: url.searchParams.get("refresh") === "true",
          }),
        );
      if (path === "/companies" && req.method === "GET")
        return send(200, await searchCompanies(url.searchParams.get("q")));
      const match = path.match(
        /^(\/macro)?\/jobs\/([\w-]+)(?:\/(events|cancel))?$/,
      );
      if (match) {
        const [, macro, id, action] = match;
        const jobStore = macro ? macroStore : store;
        if (action === "cancel" && req.method === "POST") {
          jobStore.cancel(id);
          return send(200, jobStore.get(id));
        }
        if (!action && req.method === "GET") return send(200, jobStore.get(id));
        if (action === "events" && req.method === "GET") {
          const events = jobStore.events(
            id,
            Number(
              req.headers["last-event-id"] ||
                url.searchParams.get("after") ||
                0,
            ),
          );
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-store",
            Connection: "keep-alive",
          });
          const write = (e) => {
            res.write(`id: ${e.id}\ndata: ${JSON.stringify(e)}\n\n`);
            if (["completed", "cancelled", "failed"].includes(e.type))
              res.end();
          };
          for (const e of events) {
            write(e);
            if (res.writableEnded) return;
          }
          const unsub = jobStore.subscribe(id, write),
            heartbeat = setInterval(() => res.write(": keepalive\n\n"), 15000);
          req.on("close", () => {
            unsub();
            clearInterval(heartbeat);
          });
          return;
        }
      }
      if ((path === "/jobs" || path === "/macro/jobs") && req.method === "POST") {
        let body = "",
          size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 2 * 1024 * 1024)
            return send(413, { error: "输入超过2MB" });
          body += chunk;
        }
        let value;
        try {
          value = JSON.parse(body);
        } catch {
          return send(400, { error: "JSON格式无效" });
        }
        if (
          !BACKENDS.includes(value.backend) ||
          typeof value.modelId !== "string" ||
          value.modelId.length > 200
        )
          return send(400, { error: "CLI或模型无效" });
        if (path === "/macro/jobs") {
          if (!value.digest || typeof value.digest !== "object")
            return send(400, { error: "缺少宏观读数" });
          return send(202, macroStore.start({ backend: value.backend, modelId: value.modelId, digest: value.digest }));
        }
        value.security = validateSecurity(value.security);
        return send(202, store.start(value));
      }
      send(404, { error: "接口不存在" });
    } catch (error) {
      send(
        error.message.includes("忙碌")
          ? 409
          : error.message.includes("不存在")
            ? 404
            : 400,
        { error: error.message },
      );
    }
  });
  server.on("close", () => {
    store.close();
    macroStore.close();
  });
  return server;
}
