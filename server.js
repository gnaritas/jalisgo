/* JalisGo preview — static server + contact-form delivery to the lane mailbox (template v2, 2026-11-12) */
const http = require("http"), fs = require("fs"), path = require("path");
const nodemailer = require("nodemailer");

const SITE = "JalisGo";
const PORT = process.env.PORT || 3000;
const root = path.join(__dirname, "public");
const MAIL = {
  host: process.env.MAIL_HOST || "",
  port: parseInt(process.env.MAIL_PORT || "465", 10),
  secure: parseInt(process.env.MAIL_PORT || "465", 10) === 465,
  user: process.env.MAIL_USER || "",
  pass: process.env.MAIL_PASS || "",
  alias: process.env.MAIL_ALIAS || "jarvis+websites@onsmalltalk.com",
  to: process.env.MAIL_TO || "jarvis+websites@onsmalltalk.com",
};
const MAIL_READY = !!(MAIL.host && MAIL.user && MAIL.pass);

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".xml": "application/xml", ".txt": "text/plain",
};

function readBody(req, cb) {
  let data = "", len = 0;
  req.on("data", (c) => { len += c.length; if (len > 20000) { req.destroy(); return; } data += c; });
  req.on("end", () => cb(data));
}

function out(file, body, res) {
  const ext = path.extname(file).toLowerCase();
  const cache = ext === ".png" || ext === ".jpg" || ext === ".jpeg" ? "public, max-age=86400"
    : ext === ".css" || ext === ".svg" ? "public, max-age=300" : "public, max-age=60";
  res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream", "cache-control": cache });
  res.end(body);
}

function serve404(res) {
  fs.readFile(path.join(root, "404.html"), (e, d) => {
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end(e ? "<h1>404 — not found</h1>" : d.toString());
  });
}

function serveStatic(p, res) {
  if (p === "/") p = "/index.html";
  const f = path.normalize(path.join(root, p));
  if (!f.startsWith(root)) { res.writeHead(403); return res.end("no"); }
  fs.readFile(f, (e, d) => {
    if (e && !path.extname(f)) {              // clean URL: /menu -> menu.html
      const alt = f + ".html";
      return fs.readFile(alt, (e2, d2) => e2 ? serve404(res) : out(alt, d2, res));
    }
    if (e) return serve404(res);
    out(f, d, res);
  });
}

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]).replace(/\/$/, "");
  if (p === "") p = "/";
  if (p === "/healthz") { res.writeHead(200, { "content-type": "text/plain" }); return res.end("ok"); }
  if (req.method === "POST" && p === "/contact") {
    if ((req.headers["content-type"] || "").split(";")[0] !== "application/x-www-form-urlencoded") {
      res.writeHead(415, { "content-type": "text/plain" }); return res.end("expected a plain form post");
    }
    return readBody(req, (raw) => {
      const F = Object.fromEntries(new URLSearchParams(raw));
      const name = (F.name || "").slice(0, 120), phone = (F.phone || "").slice(0, 60),
            email = (F.email || "").slice(0, 120), message = (F.message || "").slice(0, 4000);
      if (!name.trim() || !message.trim()) {
        res.writeHead(400, { "content-type": "text/plain" }); return res.end("name and message are required");
      }
      console.log("CONTACT " + SITE + " " + JSON.stringify({ name, phone, email, message, t: new Date().toISOString() }));
      if (!MAIL_READY) { res.writeHead(503, { "content-type": "text/plain" }); return res.end("form mailbox not configured yet"); }
      const tr = nodemailer.createTransport({ host: MAIL.host, port: MAIL.port, secure: MAIL.secure, auth: { user: MAIL.user, pass: MAIL.pass } });
      tr.sendMail({
        from: `"${SITE} preview" <${MAIL.alias}>`, to: MAIL.to,
        replyTo: /^[^@\s]+@[^@\s]+$/.test(email) ? email : undefined,
        subject: `[${SITE} preview] contact from ${name}`,
        text: `Name: ${name}\nPhone: ${phone || "-"}\nEmail: ${email || "-"}\n\n${message}\n\n— sent via the ${SITE} preview site, ${new Date().toISOString()}`,
      }).then(() => { res.writeHead(303, { location: "/thanks" }); res.end(); })
        .catch((err) => {
          console.log("MAILERR " + SITE + " " + err.message);
          res.writeHead(502, { "content-type": "text/html; charset=utf-8" });
          res.end("<h1>Couldn't send just now</h1><p>Your message is logged — please try again in a moment.</p>");
        });
    });
  }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  serveStatic(p, res);
}).listen(PORT, () => console.log(`${SITE} site up on ${PORT} · mail relay ${MAIL_READY ? "ready" : "NOT configured"}`));
