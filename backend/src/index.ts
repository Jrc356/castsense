import { createReadStream, existsSync, statSync } from "fs";
import http from "http";
import { extname, join, normalize, resolve } from "path";

const port = Number(process.env.PORT || 3000);
const staticRoot = resolve(process.cwd(), process.env.STATIC_DIR || "public");

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function safeAssetPath(rawPath: string): string {
  const withoutLeadingSlash = rawPath.replace(/^\/+/, "");
  const normalizedPath = normalize(withoutLeadingSlash);
  return join(staticRoot, normalizedPath);
}

function serveFile(res: http.ServerResponse, filePath: string): void {
  const extension = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
  });

  createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const method = req.method || "GET";

  if (method !== "GET" && method !== "HEAD") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const requestUrl = req.url || "/";
  const pathname = new URL(requestUrl, `http://localhost:${port}`).pathname;

  if (pathname === "/health") {
    sendJson(res, 200, { status: "healthy" });
    return;
  }

  const requestedAsset = safeAssetPath(pathname);
  const canServeAsset = requestedAsset.startsWith(staticRoot) && existsSync(requestedAsset) && statSync(requestedAsset).isFile();

  if (canServeAsset) {
    if (method === "HEAD") {
      res.writeHead(200);
      res.end();
      return;
    }
    serveFile(res, requestedAsset);
    return;
  }

  const indexPath = join(staticRoot, "index.html");
  if (existsSync(indexPath) && statSync(indexPath).isFile()) {
    if (method === "HEAD") {
      res.writeHead(200);
      res.end();
      return;
    }
    serveFile(res, indexPath);
    return;
  }

  sendJson(res, 404, { error: "Web assets not found" });
});

server.listen(port, () => {
  console.log(`CastSense service listening on port ${port}`);
  console.log(`Static root: ${staticRoot}`);
});

export {};
