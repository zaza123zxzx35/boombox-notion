export const config = {
  api: {
    bodyParser: false,
    sizeLimit: "256kb",
  },
};

const crypto = require("crypto");

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
}

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

async function supabase(path, options = {}) {
  const base = env("SUPABASE_URL").replace(/\/$/, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    signal: options.signal || AbortSignal.timeout(500),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  if (!response.ok) throw new Error(body?.message || body?.hint || `Supabase request failed (${response.status})`);
  return body;
}

function readRawBody(req, maxBytes = 262144) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (c) => {
      total += c.length;
      if (total > maxBytes) {
        const err = new Error("Payload too large");
        err.status = 413;
        return reject(err);
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function verifySignature(rawBuf, secret, signature) {
  if (!secret || !signature) return false;
  const hmac = crypto.createHmac("sha256", secret).update(rawBuf).digest("base64");
  const a = Buffer.from(hmac);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function deterministicHash(destination, eventIndex, ev) {
  const input = [
    String(destination || ""),
    eventIndex,
    String(ev?.type || ""),
    String(ev?.replyToken || ""),
    String(ev?.timestamp || ""),
    String(ev?.source?.userId || ""),
    String(ev?.source?.type || ""),
    String(ev?.message?.id || ""),
    String(ev?.message?.type || ""),
    String(ev?.postback?.data || ""),
  ];
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 32);
}

function buildWebhookEventId(destination, eventIndex, ev) {
  if (ev?.webhookEventId) return `${destination}::ev::${ev.webhookEventId}`;
  if (ev?.message?.id) return `${destination}::msg::${ev.message.id}`;
  if (ev?.replyToken) return `${destination}::rpl::${ev.replyToken}`;
  const hash = deterministicHash(destination, eventIndex, ev);
  return `${destination}::idx::${eventIndex}::sha256::${hash}`;
}

function buildStaticReply(ev) {
  switch (ev?.type) {
    case "follow":
      return "สวัสดีครับ ยินดีต้อนรับ BOOMBOX TH ครับ 🙏 สนใจ Set A (299฿) B (389฿) C (499฿) D (649฿) ครับ";
    case "message": {
      const t = ev.message?.type;
      if (t === "text") return "ขอบคุณครับ ระบบกำลังปรับปรุง AI สามารถสอบถามรายละเอียดเพิ่มเติมได้เลยครับ";
      return "กรุณาส่งข้อความพิมพ์ครับ";
    }
    case "postback":
      return "รับข้อมูลเรียบร้อยครับ (กำลังปรับปรุงระบบ)";
    default:
      return null;
  }
}

async function callLineReply(accessToken, replyToken, text) {
  if (!accessToken || !replyToken || !text) return { skipped: true };
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 700);
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
      signal: controller.signal,
    });
    const short = await res.text().then((t) => String(t).slice(0, 500)).catch(() => "");
    if (res.ok) return { ok: true, status: res.status };
    return { ok: false, status: res.status, error: String(res.status) + (short ? ` ${short}` : "") };
  } catch (err) {
    const name = err?.name || String(err).slice(0, 50);
    if (name === "AbortError" || name === "TimeoutError") return { ok: false, timeout: true, error: name };
    return { ok: false, error: name };
  } finally {
    clearTimeout(to);
  }
}

async function updateEventRow(eventRowId, patch) {
  if (!eventRowId) return;
  await supabase(`line_webhook_events?id=eq.${encodeURIComponent(eventRowId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { success: false, error: "Method not allowed" });
  }

  let rawBuf;
  try {
    rawBuf = await readRawBody(req, 262144);
  } catch (err) {
    const s = err.status || 500;
    return json(res, s, { success: false, error: s === 413 ? "Payload too large" : "Body read error" });
  }

  const signatureHeader = String(req.headers["x-line-signature"] || "");
  if (!signatureHeader) {
    return json(res, 401, { success: false, error: "Missing signature" });
  }

  let channelSecret;
  try {
    channelSecret = env("LINE_CHANNEL_SECRET");
  } catch (e) {
    console.error("LINE webhook missing LINE_CHANNEL_SECRET env");
    return json(res, 500, { success: false, error: "Internal server error" });
  }

  if (!verifySignature(rawBuf, channelSecret, signatureHeader)) {
    return json(res, 401, { success: false, error: "Invalid signature" });
  }

  let body;
  try {
    body = JSON.parse(rawBuf.toString("utf8"));
  } catch (e) {
    return json(res, 400, { success: false, error: "Invalid JSON payload" });
  }

  const destination = String(body?.destination || "");
  const events = Array.isArray(body?.events) ? body.events : null;
  if (!destination || !events || events.length > 100) {
    return json(res, 400, { success: false, error: "Invalid payload: destination + events array required" });
  }

  const bodyHash = crypto.createHash("sha256").update(rawBuf).digest("hex");
  let lineAccessToken;
  try {
    lineAccessToken = env("LINE_CHANNEL_ACCESS_TOKEN");
  } catch (e) {
    lineAccessToken = "";
    console.error("LINE webhook warn: LINE_CHANNEL_ACCESS_TOKEN missing — replies will be skipped");
  }

  const summary = { processed: 0, duplicates: 0 };

  for (let eventIndex = 0; eventIndex < events.length; eventIndex++) {
    const ev = events[eventIndex];
    const evType = String(ev?.type || "unknown");
    const lineUserId = String(ev?.source?.userId || "") || null;
    const replyToken = String(ev?.replyToken || "") || null;
    const webhookEventId = buildWebhookEventId(destination, eventIndex, ev);

    let eventRowId = null;
    let thisIsDuplicate = false;
    try {
      const inserted = await supabase("line_webhook_events", {
        method: "POST",
        headers: { Prefer: "return=representation, resolution=ignore-duplicates" },
        body: JSON.stringify({
          webhook_event_id: webhookEventId,
          event_type: evType,
          line_user_id: lineUserId,
          reply_token: replyToken,
          body_hash: bodyHash,
          result: "processing",
        }),
      });
      if (inserted && inserted[0] && inserted[0].id) {
        eventRowId = inserted[0].id;
      } else {
        thisIsDuplicate = true;
      }
    } catch (e) {
      const msg = String(e?.message || e).toLowerCase();
      if (msg.includes("duplicate") || msg.includes("23505") || msg.includes("unique")) {
        thisIsDuplicate = true;
      } else {
        console.error("LINE webhook: supabase INSERT event error", e?.message || e);
        continue;
      }
    }

    if (thisIsDuplicate) {
      summary.duplicates++;
      continue;
    }

    let conversationRowId = null;
    try {
      if (lineUserId) {
        const upsert = await supabase("line_conversations", {
          method: "POST",
          headers: {
            Prefer: "return=representation, resolution=merge-duplicates",
          },
          body: JSON.stringify({
            line_user_id: lineUserId,
            state: "new",
            draft: {},
            last_event_id: eventRowId,
            last_message_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          }),
        });
        if (upsert && upsert[0]?.id) conversationRowId = upsert[0].id;
      }
    } catch (e) {
      console.error("LINE webhook: supabase upsert convo error", e?.message || e);
    }

    let replyResult = { skipped: true };
    if (replyToken && lineAccessToken) {
      const text = buildStaticReply(ev);
      if (text) {
        replyResult = await callLineReply(lineAccessToken, replyToken, text);
      } else {
        replyResult = { skipped: true };
      }
    }

    let finalResult = "accepted";
    let finalReplyStatus = "skipped";
    let finalReplyError = null;
    if (replyResult.skipped || !replyToken || !lineAccessToken) {
      finalReplyStatus = "skipped";
      finalResult = "accepted";
    } else if (replyResult.ok) {
      finalReplyStatus = "success";
      finalResult = "accepted";
    } else if (replyResult.timeout) {
      finalReplyStatus = "failed";
      finalResult = "timeout";
      finalReplyError = "LINE reply timeout";
    } else {
      finalReplyStatus = "failed";
      finalResult = "reply_failed";
      finalReplyError = String(replyResult.error || "").slice(0, 500) || "LINE reply failed";
    }

    try {
      await updateEventRow(eventRowId, {
        processed: true,
        result: finalResult,
        reply_status: finalReplyStatus,
        line_reply_error: finalReplyError,
      });
      summary.processed++;
    } catch (e) {
      console.error("LINE webhook: finalize event row error", e?.message || e);
    }
  }

  return json(res, 200, {
    success: true,
    processed: summary.processed,
    duplicates: summary.duplicates,
    total: events.length,
  });
}
