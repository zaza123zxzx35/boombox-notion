export const config = {
  api: {
    bodyParser: false,
    sizeLimit: "256kb",
  },
};

const crypto = require("crypto");

// ====== Phase 10: Catalog Canonical (copy orders.js SOI verbatim) ======
const PACKAGES = {
  A: { name: "เริ่มต้น", price: 299, boxes: 1 },
  B: { name: "คุ้มค่า", price: 389, boxes: 2 },
  C: { name: "จัดเต็ม", price: 499, boxes: 4 },
  D: { name: "VIP", price: 649, boxes: 6 },
};
const PACKAGE_BEADS = { A: 100, B: 200, C: 400, D: 600 };
const FLAVORS = new Set([
  "มิ้นต์เย็น",
  "องุ่นหวาน",
  "แบล็คเบอร์รี่",
  "กล้วยนม",
  "ลิ้นจี่",
  "ไอศกรีม",
  "แอปเปิ้ลเขียว",
  "บลูเบอร์รี่",
  "แตงโม",
  "ส้มซิตรัส",
  "สมุนไพรจีน",
  "โคล่า",
  "หอมหมื่นลี้",
  "แคนตาลูป",
  "รวมกลิ่น",
  "เลมอน",
  "องุ่นเย็น",
  "สตรอเบอร์รี่",
]);
const FLAVOR_LIST = Array.from(FLAVORS);
const ALLOWED_STATES = new Set([
  "new", "collecting_package", "collecting_color", "collecting_scents",
  "collecting_customer", "awaiting_confirmation", "confirmed", "cancelled",
]);
const CONFIRM_WHITELIST = new Set([
  "ยืนยันออเดอร์", "ยืนยัน", "ตกลง สั่งตามนี้",
]);
const AMBIGUOUS_SAFE = new Set([
  "ครับ","คับ","โอเคมั้ง","โอเค","เค","น่าจะได้","น่าจะ","ได้เลย","ได้ไหม","ได้","เยี่ยม","สั่งเลย","สั่ง","ตกลง","ok","okay","yes","จ้ะ","จ้า","ยืนยันนะ"
]);
const CANCEL_KEYWORD = "ยกเลิก";
const EDIT_KEYWORD = "แก้ไข";
const RESTART_KEYWORD = "เริ่มใหม่";
const DEFAULT_SHIPPING_FEE = 0;
const EDIT_FIELDS = ["แพ็กเกจ","สี","กลิ่น","ชื่อ","เบอร์","ที่อยู่"];
const EDIT_FIELD_STATE = {
  1: "collecting_package", 2: "collecting_color", 3: "collecting_scents",
  4: "collecting_customer", 5: "collecting_customer", 6: "collecting_customer",
};
const EDIT_FIELD_KEY_IN_DRAFT = {
  1: ["package","scents"],
  2: ["deviceColor"],
  3: ["scents"],
  4: ["customer.name","customer.displayName"],
  5: ["customer.phone"],
  6: ["customer.shippingAddress","customer.address"],
};

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
    signal: options.signal || AbortSignal.timeout(2500),
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
      return "สวัสดีครับ ยินดีต้อนรับ BOOMBOX TH ครับ 🙏 สนใจ Set A (299฿) B (389฿) C (499฿) D (649฿) ครับ — พิมพ์ A/B/C/D หรือ ราคาเท่าไหร่ เพื่อเริ่มต้นครับ";
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
      body: JSON.stringify({ replyToken, messages: [{ type: "text", text: text.slice(0, 5000) }] }),
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

async function callOrdersAPI(orderToken, host, payload) {
  if (!orderToken) return { ok: false, error: "Missing LINE_ORDER_API_TOKEN" };
  try {
    const res = await fetch(`https://${host}/api/integrations/line/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${orderToken}`,
        "X-Line-Webhook-Secret": orderToken,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });
    const short = await res.text().then((t) => String(t).slice(0, 8000)).catch(() => "");
    let body = null;
    try { body = short ? JSON.parse(short) : null; } catch { body = { raw: short }; }
    if (body && typeof body.raw === "string") {
      try { const inner = JSON.parse(body.raw); if (inner && typeof inner === "object") body = inner; } catch {}
    }
    const ok = res.ok || (body && body.success === true && body.duplicate === true);
    return { ok, status: res.status, body };
  } catch (err) {
    const name = err?.name || String(err).slice(0, 80);
    return { ok: false, error: name };
  }
}

const ORDER_FAIL_REPLY_TEXT = "ระบบยังยืนยันคำสั่งซื้อไม่ได้ กรุณาลองใหม่หรือติดต่อแอดมิน";

function classifyOrderResult(orderRes) {
  const httpStatus = Number(orderRes?.status) || 0;
  let body = orderRes?.body && typeof orderRes.body === "object" ? orderRes.body : null;
  if (body && typeof body.raw === "string") {
    try { const inner = JSON.parse(body.raw); if (inner && typeof inner === "object") body = inner; } catch {}
  }
  const bodySuccess = body?.success === true;
  const isDuplicate = bodySuccess && body?.duplicate === true;
  const orderObj = body?.order && typeof body.order === "object" ? body.order : null;
  const orderNumber = orderObj?.order_number || orderObj?.orderNumber || null;
  const orderId = orderObj?.id || null;
  if (httpStatus === 201 && bodySuccess && !isDuplicate && orderNumber) {
    return {
      kind: "created",
      orderNumber,
      orderId,
      summaryInc: { orderCreated: 1, orderDuplicated: 0, orderFailed: 0 },
      nextState: "confirmed",
    };
  }
  if (isDuplicate && orderNumber) {
    return {
      kind: "duplicated",
      orderNumber,
      orderId,
      summaryInc: { orderCreated: 0, orderDuplicated: 1, orderFailed: 0 },
      nextState: "confirmed",
    };
  }
  return {
    kind: "failed",
    orderNumber: null,
    orderId: null,
    summaryInc: { orderCreated: 0, orderDuplicated: 0, orderFailed: 1 },
    nextState: "awaiting_confirmation",
  };
}

async function updateEventRow(eventRowId, patch) {
  if (!eventRowId) return;
  await supabase(`line_webhook_events?id=eq.${encodeURIComponent(eventRowId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

async function patchConversation(convoRowId, patch) {
  if (!convoRowId) return;
  await supabase(`line_conversations?id=eq.${encodeURIComponent(convoRowId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      ...patch,
      updated_at: new Date().toISOString(),
    }),
  });
}

function normalizeText(s) {
  if (typeof s !== "string") return "";
  return s
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeConfirm(s) {
  return normalizeText(s).toLowerCase().replace(/\s+/g, " ");
}

function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 7) return (phone || "").slice(0, 3) + "***";
  return digits.slice(0, 3) + "***" + digits.slice(-4);
}

function maskAddress(addr) {
  const s = String(addr || "");
  if (s.length <= 20) return s;
  return s.slice(0, 20) + "...";
}

function maskName(name) {
  const s = String(name || "");
  if (!s) return "";
  if (s.length <= 3) return s;
  return s.slice(0, 3) + "***";
}

function isThaiPhone(s) {
  const d = String(s || "").replace(/\D/g, "");
  return /^(08|09|06)\d{8}$/.test(d) && d.length === 10;
}

function extractThaiPhone(s) {
  const d = String(s || "").replace(/\D/g, "");
  const m = d.match(/(08|09|06)\d{8}/);
  if (m) return m[0];
  if (isThaiPhone(d)) return d;
  return null;
}

function parsePackageLetter(s) {
  const n = normalizeText(s).toUpperCase();
  const m = n.match(/\b([ABCD])\b/);
  if (m && PACKAGES[m[1]]) return m[1];
  const m2 = n.match(/(?:SET|ชุด|เซ็ต|CHUT)\s*([ABCD])/);
  if (m2 && PACKAGES[m2[1]]) return m2[1];
  return null;
}

function scentCountNeeded(code) {
  if (code === "A") return 0;
  return PACKAGES[code]?.boxes ?? 0;
}

function parseEditChoice(s) {
  const n = normalizeText(s);
  const m = n.match(/^([1-6])/);
  if (m) return parseInt(m[1], 10);
  for (let i = 0; i < EDIT_FIELDS.length; i++) {
    if (n.includes(EDIT_FIELDS[i])) return i + 1;
  }
  return null;
}

function clearDraftFields(draft, choice) {
  const keys = EDIT_FIELD_KEY_IN_DRAFT[choice] || [];
  const next = JSON.parse(JSON.stringify(draft || {}));
  keys.forEach((p) => {
    const parts = p.split(".");
    if (parts.length === 1) {
      if (parts[0] === "package") {
        next.package = { code: null, name: null, price: null };
      } else if (parts[0] === "scents") {
        next.scents = [];
      } else if (parts[0] === "deviceColor") {
        next.deviceColor = null;
      } else {
        next[parts[0]] = null;
      }
    } else if (parts.length === 2) {
      next[parts[0]] = next[parts[0]] || {};
      next[parts[0]][parts[1]] = null;
    }
  });
  if (choice === 1) next.scents = [];
  return next;
}

function customerMissingFields(draft) {
  const c = draft?.customer || {};
  const name = String(c.displayName || c.name || "").trim();
  const phone = String(c.phone || "").trim();
  const addr = String(c.shippingAddress || c.address || "").trim();
  const missing = [];
  if (!name) missing.push("name");
  if (!isThaiPhone(phone)) missing.push("phone");
  if (!addr) missing.push("address");
  return missing;
}

function draftComplete(draft) {
  const code = draft?.package?.code;
  if (!PACKAGES[code]) return false;
  if (code !== "A" && (!Array.isArray(draft?.scents) || draft.scents.length !== scentCountNeeded(code))) return false;
  if (code === "A" && Array.isArray(draft?.scents) && draft.scents.length !== 0) return false;
  if (!String(draft?.deviceColor || "").trim()) return false;
  return customerMissingFields(draft).length === 0;
}

function buildAwaitingSummary(draft) {
  const code = draft.package.code;
  const pkg = PACKAGES[code];
  const beads = PACKAGE_BEADS[code];
  const price = pkg.price;
  const color = draft.deviceColor;
  const scents = code === "A" ? [] : (draft.scents || []);
  const scentsText = code === "A" ? "(ไม่ต้องเลือกกลิ่น)" : scents.join(", ");
  const cust = draft.customer || {};
  const name = cust.displayName || cust.name || "-";
  const phone = cust.phone || "-";
  const addr = cust.shippingAddress || cust.address || "-";
  const shipping = Number(draft.shippingFee ?? DEFAULT_SHIPPING_FEE);
  const total = price + shipping;
  const lines = [
    `📦 สรุปรายการสั่งซื้อ`,
    `Set: ${code} (${pkg.name})`,
    `จำนวนเม็ด: ${beads} เม็ด`,
    `ราคาแพ็กเกจ: ฿${price}`,
    `สีเครื่อง: ${color || "-"}`,
    `กลิ่น (${scents.length}/${scentCountNeeded(code)}): ${scentsText}`,
    `ชื่อผู้รับ: ${name}`,
    `เบอร์โทร: ${maskPhone(phone)}`,
    `ที่อยู่จัดส่ง: ${maskAddress(addr)}`,
    `ค่าส่ง: ฿${shipping}`,
    `ยอดรวมทั้งสิ้น: ฿${total}`,
    ``,
    `กรุณาพิมพ์ ยืนยันออเดอร์ เพื่อส่งคำสั่งซื้อ หรือพิมพ์ แก้ไข / ยกเลิก`,
  ];
  return lines.join("\n");
}

function catalogPriceTable() {
  return [
    `🌈 ราคาตาม Catalog:`,
    `  Set A: 100 เม็ด ราคา ฿299 (ไม่ต้องเลือกกลิ่น)`,
    `  Set B: 200 เม็ด ราคา ฿389 (เลือก 2 กลิ่น)`,
    `  Set C: 400 เม็ด ราคา ฿499 (เลือก 4 กลิ่น)`,
    `  Set D: 600 เม็ด ราคา ฿649 (เลือก 6 กลิ่น)`,
    `🌸 รายการกลิ่นมาตรฐาน 18 รายการ:`,
    `  ${FLAVOR_LIST.join(" / ")}`,
    ``,
    `พิมพ์ A / B / C / D เพื่อเริ่มเลือกชุดครับ`,
  ].join("\n");
}

function helpChooseScent(code) {
  const need = scentCountNeeded(code);
  return [
    `กรุณาเลือกกลิ่นทีละ 1 รายการต่อข้อความครับ`,
    `🌸 รายการกลิ่น 18 รายการ:`,
    FLAVOR_LIST.join(", "),
    ``,
    `จำเป็นต้องเลือกทั้งหมด ${need} กลิ่น (ห้ามซ้ำ ห้ามเลือกนอกรายการ)`,
  ].join("\n");
}

function collectCustomerPrompt(draft) {
  const miss = customerMissingFields(draft);
  if (miss.length === 0) return null;
  const m = miss[0];
  if (m === "name") return "กรุณากรอกชื่อผู้รับครับ (ชื่อ-นามสกุล)";
  if (m === "phone") return "กรุณากรอกเบอร์มือถือ (10 หลัก เช่น 0891234567) ครับ";
  return "กรุณากรอกที่อยู่จัดส่งครับ (บ้านเลขที่/หมู่บ้าน/ซอย/ถนน/ตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์)";
}

function parseCustomerFieldsInto(draft, text) {
  const next = JSON.parse(JSON.stringify(draft || {}));
  next.customer = next.customer || {};
  const hasName = !!(String(next.customer.displayName || next.customer.name || "").trim());
  const hasPhone = isThaiPhone(next.customer.phone);
  const hasAddr = !!(String(next.customer.shippingAddress || next.customer.address || "").trim());
  const ADDR_MARKERS = ["หมู่","หม.","หมู่บ้าน","ซอย","ซ.","ถนน","ถ.","ตำบล","ต.","แขวง","อำเภอ","อ.","เขต","จังหวัด","จ.","กรุงเทพ","กทม","รหัสไปรษณีย์","บ้านเลขที่","บ.เลขที่","บ้านเลข","เลขที่"];
  function hasAnyAddrMarker(s) { return ADDR_MARKERS.some((m) => String(s || "").includes(m)); }
  function hasDigitsLen2(s) { const d = String(s || "").replace(/[^\d]/g, ""); return d.length >= 2; }

  const phoneFound = extractThaiPhone(text);
  if (phoneFound && !hasPhone) next.customer.phone = phoneFound;
  const restText = phoneFound ? text.replace(phoneFound, " ") : text;
  const restNorm = normalizeText(restText);
  const missing = customerMissingFields(next);

  if (missing.length === 1 && restNorm) {
    const need = missing[0];
    if (need === "phone") {
      const d = restNorm.replace(/\D/g, "");
      if (isThaiPhone(d)) {
        next.customer.phone = d;
        return next;
      }
      return next;
    }
    const hasPhoneHere = !!phoneFound || isThaiPhone(restNorm);
    if (need === "name" && !hasPhoneHere && !hasAnyAddrMarker(restNorm) && !restNorm.split(/\s+/).some(hasDigitsLen2)) {
      next.customer.displayName = restNorm;
      next.customer.name = restNorm;
      return next;
    }
    if (need === "address" && restNorm.length >= 5) {
      next.customer.shippingAddress = restNorm;
      next.customer.address = restNorm;
      return next;
    }
  }

  const tokens = restNorm.split(/[,，;；\n\r\t]+/).map((s) => s.trim()).filter(Boolean);
  const words = restNorm.split(/\s+/).filter(Boolean);
  let nameCandidate = null;
  let addrCandidate = null;

  if (tokens.length >= 2) {
    nameCandidate = tokens[0];
    addrCandidate = tokens.slice(1).join(" ");
  } else if (words.length >= 2) {
    let splitIdx = -1;
    for (let i = 1; i < words.length; i++) {
      const w = words[i];
      if (hasAnyAddrMarker(w) || hasDigitsLen2(w)) { splitIdx = i; break; }
    }
    if (splitIdx < 0) {
      if (!hasName && !hasPhone && !hasAddr) {
        nameCandidate = words.join(" ");
      } else if (hasName && !hasAddr) {
        addrCandidate = words.join(" ");
      } else {
        splitIdx = Math.min(2, words.length - 1);
        nameCandidate = words.slice(0, splitIdx).join(" ");
        addrCandidate = words.slice(splitIdx).join(" ");
      }
    } else {
      nameCandidate = words.slice(0, splitIdx).join(" ");
      addrCandidate = words.slice(splitIdx).join(" ");
    }
  } else if (words.length === 1) {
    const w = words[0];
    if (!hasName) nameCandidate = w;
    else if (!hasAddr) addrCandidate = w;
  }

  if (!hasName && nameCandidate && nameCandidate.length >= 2 && nameCandidate.length <= 80) {
    next.customer.displayName = nameCandidate;
    next.customer.name = nameCandidate;
  }
  if (!hasAddr && addrCandidate && addrCandidate.length >= 5 && addrCandidate.length <= 400) {
    next.customer.shippingAddress = addrCandidate;
    next.customer.address = addrCandidate;
  }
  return next;
}

function reduceConversation(state, draft, rawText, context) {
  const next = JSON.parse(JSON.stringify(draft || {}));
  next.customer = next.customer || {};
  next.package = next.package || { code: null, name: null, price: null };
  next.scents = Array.isArray(next.scents) ? next.scents.slice() : [];
  const text = normalizeText(rawText);
  const textLower = text.toLowerCase();
  const confirmedNormalized = normalizeConfirm(text);

  if (state === "cancelled") {
    if (text === RESTART_KEYWORD || text.includes(RESTART_KEYWORD)) {
      const fresh = { package: { code: null, name: null, price: null }, scents: [], deviceColor: null, customer: {}, shippingFee: DEFAULT_SHIPPING_FEE, editing: null };
      return {
        nextState: "new",
        nextDraft: fresh,
        replyText: "เริ่มการสนทนาใหม่ครับ 🙏 กรุณาเลือก Set A/B/C/D หรือพิมพ์ ราคาเท่าไหร่ เพื่อดูราคา",
        summaryShown: false,
      };
    }
    return {
      nextState: "cancelled",
      nextDraft: next,
      replyText: "รายการนี้ยกเลิกแล้วครับ หากต้องการสั่งซื้อใหม่ กรุณาพิมพ์ เริ่มใหม่ ครับ",
      summaryShown: false,
    };
  }

  if (text === CANCEL_KEYWORD || text.includes(CANCEL_KEYWORD)) {
    return {
      nextState: "cancelled",
      nextDraft: { ...next, package: next.package, scents: next.scents, deviceColor: next.deviceColor, customer: next.customer },
      replyText: "ยกเลิกรายการเรียบร้อยครับ หากต้องการสั่งซื้อใหม่ภายหลัง พิมพ์ เริ่มใหม่ ครับ",
      summaryShown: false,
    };
  }

  if (state === "awaiting_confirmation") {
    if (CONFIRM_WHITELIST.has(text) || CONFIRM_WHITELIST.has(confirmedNormalized) || CONFIRM_WHITELIST.has(text.replace(/\s+/g, ""))) {
      return { nextState: "__CONFIRM_TRIGGERED__", nextDraft: next, replyText: null, summaryShown: false, confirmTriggered: true };
    }
    if (AMBIGUOUS_SAFE.has(textLower.replace(/\s+/g, "")) || AMBIGUOUS_SAFE.has(textLower)) {
      return {
        nextState: "awaiting_confirmation",
        nextDraft: next,
        replyText: "ขออภัยครับ ยังไม่เข้าใจ กรุณายืนยันอย่างชัดเจนด้วยการพิมพ์:\n\nยืนยันออเดอร์\n\nหรือพิมพ์ แก้ไข / ยกเลิก ครับ",
        summaryShown: true,
        confirmPrompt: true,
      };
    }
    if (text === EDIT_KEYWORD || text.includes(EDIT_KEYWORD)) {
      next.editing = "awaiting_choice";
      return {
        nextState: "awaiting_confirmation",
        nextDraft: next,
        replyText: [
          "เลือกข้อมูลที่ต้องการแก้ไขตามตัวเลขครับ:",
          "1. แพ็กเกจ",
          "2. สีเครื่อง",
          "3. กลิ่น",
          "4. ชื่อผู้รับ",
          "5. เบอร์โทร",
          "6. ที่อยู่",
        ].join("\n"),
        summaryShown: true,
      };
    }
    const choice = parseEditChoice(text);
    if (next.editing === "awaiting_choice" && choice) {
      const target = EDIT_FIELD_STATE[choice];
      const cleared = clearDraftFields(next, choice);
      cleared.editing = null;
      let replyText = "";
      if (choice === 1) replyText = "กรุณาเลือกแพ็กเกจใหม่ A / B / C / D ครับ";
      else if (choice === 2) replyText = "กรุณากรอกสีเครื่องใหม่ครับ (2-60 ตัวอักษร)";
      else if (choice === 3) replyText = helpChooseScent(cleared.package.code || next.package.code || "B");
      else if (choice === 4) replyText = "กรุณากรอกชื่อผู้รับใหม่ครับ";
      else if (choice === 5) replyText = "กรุณากรอกเบอร์มือถือ 10 หลักใหม่ครับ";
      else replyText = "กรุณากรอกที่อยู่จัดส่งใหม่ครับ";
      return { nextState: target, nextDraft: cleared, replyText, summaryShown: false };
    }
    return {
      nextState: "awaiting_confirmation",
      nextDraft: next,
      replyText: buildAwaitingSummary(next),
      summaryShown: true,
    };
  }

  if (state === "new") {
    if (textLower === "ราคาเท่าไหร่" || textLower.includes("ราคาเท่าไหร่") || textLower === "ราคา" || text === "ราคา") {
      return { nextState: "new", nextDraft: next, replyText: catalogPriceTable(), summaryShown: false };
    }
    const letter = parsePackageLetter(text);
    if (letter) {
      next.package = { code: letter, name: PACKAGES[letter].name, price: PACKAGES[letter].price };
      next.scents = [];
      return {
        nextState: "collecting_color",
        nextDraft: next,
        replyText: `เลือก Set ${letter} (${PACKAGES[letter].name}) ${PACKAGE_BEADS[letter]} เม็ด ราคา ฿${PACKAGES[letter].price} เรียบร้อยครับ\n\nกรุณากรอกสีเครื่องครับ (เช่น ขาว, ดำ, ชมพู)`,
        summaryShown: false,
      };
    }
    if (text === "สวัสดี" || textLower.includes("สวัสดี") || textLower === "หวัดดี" || textLower === "hello" || textLower === "hi") {
      return {
        nextState: "new",
        nextDraft: next,
        replyText: "สวัสดีครับ ยินดีต้อนรับ BOOMBOX TH 🙏\n\nกรุณาเลือก Set ด้วยการพิมพ์ A / B / C / D หรือพิมพ์ ราคาเท่าไหร่ เพื่อดูรายการราคาและกลิ่นครับ",
        summaryShown: false,
      };
    }
    return {
      nextState: "new",
      nextDraft: next,
      replyText: "ยินดีต้อนรับครับ 🙏 กรุณาเลือกชุดด้วยการพิมพ์ A / B / C / D หรือพิมพ์ ราคาเท่าไหร่ เพื่อดูรายการครับ",
      summaryShown: false,
    };
  }

  if (state === "collecting_package") {
    if (textLower === "ราคาเท่าไหร่" || textLower.includes("ราคาเท่าไหร่")) {
      return { nextState: "collecting_package", nextDraft: next, replyText: catalogPriceTable(), summaryShown: false };
    }
    const letter = parsePackageLetter(text);
    if (letter) {
      next.package = { code: letter, name: PACKAGES[letter].name, price: PACKAGES[letter].price };
      next.scents = [];
      return {
        nextState: "collecting_color",
        nextDraft: next,
        replyText: `เลือก Set ${letter} (${PACKAGES[letter].name}) ${PACKAGE_BEADS[letter]} เม็ด ราคา ฿${PACKAGES[letter].price} เรียบร้อยครับ\n\nกรุณากรอกสีเครื่องครับ`,
        summaryShown: false,
      };
    }
    return {
      nextState: "collecting_package",
      nextDraft: next,
      replyText: "กรุณาเลือกแพ็กเกจด้วยการพิมพ์ A / B / C / D หรือพิมพ์ ราคาเท่าไหร่ เพื่อดูรายการครับ",
      summaryShown: false,
    };
  }

  if (state === "collecting_color") {
    const color = text;
    if (color.length >= 2 && color.length <= 60) {
      next.deviceColor = color;
      const code = next.package.code;
      if (code === "A") {
        next.scents = [];
        return {
          nextState: "collecting_customer",
          nextDraft: next,
          replyText: `สีเครื่อง ${color} เรียบร้อยครับ (Set A ไม่ต้องเลือกกลิ่น)\n\nกรุณากรอกชื่อผู้รับครับ`,
          summaryShown: false,
        };
      }
      const need = scentCountNeeded(code);
      return {
        nextState: "collecting_scents",
        nextDraft: next,
        replyText: `สีเครื่อง ${color} เรียบร้อยครับ\n\n${helpChooseScent(code)}\n\nตอนนี้เลือกได้ ${next.scents.length}/${need} กลิ่นครับ — พิมพ์ชื่อกลิ่นรายการแรกครับ`,
        summaryShown: false,
      };
    }
    return {
      nextState: "collecting_color",
      nextDraft: next,
      replyText: "กรุณากรอกสีเครื่อง (2-60 ตัวอักษร) เช่น ขาว, ดำ, ชมพู ครับ",
      summaryShown: false,
    };
  }

  if (state === "collecting_scents") {
    const code = next.package.code;
    const need = scentCountNeeded(code);
    const names = text.split(/[,，;；\n\r]+/).map((s) => normalizeText(s)).filter(Boolean);
    let addCount = 0;
    let invalidName = null;
    let dupName = null;
    for (const n of names) {
      if (!FLAVORS.has(n)) { invalidName = n; break; }
      if (next.scents.includes(n)) { dupName = n; break; }
      if (next.scents.length + 1 > need) { break; }
      next.scents.push(n);
      addCount++;
    }
    if (invalidName) {
      return {
        nextState: "collecting_scents",
        nextDraft: next,
        replyText: `❌ ไม่มีกลิ่น "${invalidName}" ในรายการมาตรฐาน 18 รายการครับ\n\n${helpChooseScent(code)}\n\nตอนนี้ ${next.scents.length}/${need} กลิ่นครับ`,
        summaryShown: false,
      };
    }
    if (dupName) {
      return {
        nextState: "collecting_scents",
        nextDraft: next,
        replyText: `❌ กลิ่น "${dupName}" ซ้ำครับ กรุณาเลือกกลิ่นใหม่ที่ยังไม่เคยเลือก\n\nตอนนี้ ${next.scents.length}/${need} กลิ่นที่เลือกไว้: ${next.scents.join(", ")}`,
        summaryShown: false,
      };
    }
    if (next.scents.length > need || (addCount === 0 && names.length && next.scents.length === need)) {
      return {
        nextState: "collecting_scents",
        nextDraft: next,
        replyText: `❌ เลือกกลิ่นเกินจำนวนที่ต้องการ (ต้องการ ${need} กลิ่น) ครับ\n\nตอนนี้ ${next.scents.length}/${need} กลิ่นที่เลือกไว้: ${next.scents.join(", ")}`,
        summaryShown: false,
      };
    }
    if (next.scents.length < need) {
      return {
        nextState: "collecting_scents",
        nextDraft: next,
        replyText: `✅ เพิ่มกลิ่น ${addCount} รายการเรียบร้อย\nตอนนี้ ${next.scents.length}/${need} กลิ่นที่เลือกไว้: ${next.scents.join(", ")}\n\nกรุณาพิมพ์กลิ่นที่ ${next.scents.length + 1} ครับ`,
        summaryShown: false,
      };
    }
    return {
      nextState: "collecting_customer",
      nextDraft: next,
      replyText: `✅ เลือกกลิ่นครบ ${need} กลิ่นเรียบร้อย: ${next.scents.join(", ")}\n\nกรุณากรอกข้อมูลลูกค้าครับ: ชื่อผู้รับ เบอร์มือถือ (10 หลัก) ที่อยู่ (สามารถส่งพร้อมกันใน 1 ข้อความได้ครับ)`,
      summaryShown: false,
    };
  }

  if (state === "collecting_customer") {
    const parsed = parseCustomerFieldsInto(next, text);
    const missing = customerMissingFields(parsed);
    if (missing.length === 0) {
      return {
        nextState: "awaiting_confirmation",
        nextDraft: parsed,
        replyText: buildAwaitingSummary(parsed),
        summaryShown: true,
      };
    }
    return {
      nextState: "collecting_customer",
      nextDraft: parsed,
      replyText: collectCustomerPrompt(parsed),
      summaryShown: false,
    };
  }

  if (state === "confirmed") {
    return {
      nextState: "confirmed",
      nextDraft: next,
      replyText: "รายการนี้ยืนยันแล้วครับ สามารถตรวจสอบสถานะใน Dashboard ได้เลยครับ หากต้องการสั่งซื้อใหม่ พิมพ์ เริ่มใหม่ ครับ",
      summaryShown: false,
    };
  }

  return {
    nextState: ALLOWED_STATES.has(state) ? state : "new",
    nextDraft: next,
    replyText: "ขออภัยครับ กรุณาเริ่มการสนทนาใหม่หรือเลือก Set A/B/C/D ครับ",
    summaryShown: false,
  };
}

export const _lineOrderClassify = { classifyOrderResult, ORDER_FAIL_REPLY_TEXT };

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
  let lineOrderToken;
  try {
    lineOrderToken = env("LINE_ORDER_API_TOKEN");
  } catch (e) {
    lineOrderToken = "";
  }
  const reqHost = String(req.headers?.host || "boombox-notion.vercel.app").replace(/\/$/, "");

  const summary = { processed: 0, duplicates: 0, orderCreated: 0, orderDuplicated: 0, orderFailed: 0 };
  const debug = [];
  let lastOrderDebug = null;

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
        const safeErr = String(e?.message || "").slice(0, 120);
        console.error("LINE webhook: supabase INSERT event error", safeErr.length ? safeErr : "unknown");
        continue;
      }
    }

    if (thisIsDuplicate) {
      summary.duplicates++;
      continue;
    }

    let conversationRowId = null;
    let convoState = "new";
    let convoDraft = { package: { code: null, name: null, price: null }, scents: [], deviceColor: null, customer: {}, shippingFee: DEFAULT_SHIPPING_FEE };
    try {
      if (lineUserId) {
        let existing = null;
        try {
          const got = await supabase(`line_conversations?line_user_id=eq.${encodeURIComponent(lineUserId)}&select=id,state,draft&limit=1`, { method: "GET" });
          if (Array.isArray(got) && got[0]) existing = got[0];
        } catch (_e) { existing = null; }

        let row = null;
        if (existing && existing.id) {
          row = existing;
        } else {
          const inserted = await supabase("line_conversations", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
              line_user_id: lineUserId,
              state: "new",
              draft: { package: { code: null, name: null, price: null }, scents: [], deviceColor: null, customer: {}, shippingFee: DEFAULT_SHIPPING_FEE },
              last_event_id: eventRowId,
              last_message_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 86400000).toISOString(),
            }),
          });
          if (Array.isArray(inserted) && inserted[0]) row = inserted[0];
        }

        if (row) {
          conversationRowId = row.id;
          if (row.state && ALLOWED_STATES.has(String(row.state))) {
            convoState = String(row.state);
          }
          if (row.draft && typeof row.draft === "object" && !Array.isArray(row.draft)) {
            const d = row.draft;
            convoDraft = {
              package: d.package && typeof d.package === "object" ? {
                code: d.package.code || null,
                name: d.package.name || null,
                price: d.package.price || null,
              } : { code: null, name: null, price: null },
              scents: Array.isArray(d.scents) ? d.scents.slice().filter((x) => FLAVORS.has(x)) : [],
              deviceColor: String(d.deviceColor || "") || null,
              customer: d.customer && typeof d.customer === "object" ? {
                displayName: d.customer.displayName || d.customer.name || null,
                name: d.customer.name || d.customer.displayName || null,
                phone: d.customer.phone || null,
                shippingAddress: d.customer.shippingAddress || d.customer.address || null,
                address: d.customer.address || d.customer.shippingAddress || null,
              } : {},
              shippingFee: Number(d.shippingFee ?? DEFAULT_SHIPPING_FEE),
              editing: d.editing || null,
            };
          }
        }
      }
    } catch (e) {
      const safeErr = String(e?.message || "").slice(0, 120);
      console.error("LINE webhook: supabase load/insert convo error", safeErr.length ? safeErr : "unknown");
    }

    let replyText = null;
    let nextState = convoState;
    let nextDraft = convoDraft;
    let confirmTriggered = false;

    if (evType === "message" && ev.message?.type === "text" && typeof ev.message.text === "string") {
      const ctx = { packages: PACKAGES, flavors: FLAVORS, allowedStates: ALLOWED_STATES, confirmWhitelist: CONFIRM_WHITELIST, cancelKeyword: CANCEL_KEYWORD, editKeyword: EDIT_KEYWORD };
      const reduced = reduceConversation(convoState, convoDraft, ev.message.text, ctx);
      if (reduced && reduced.confirmTriggered) {
        confirmTriggered = true;
        nextState = "awaiting_confirmation";
        nextDraft = reduced.nextDraft;
      } else if (reduced) {
        nextState = ALLOWED_STATES.has(reduced.nextState) ? reduced.nextState : convoState;
        nextDraft = reduced.nextDraft;
        replyText = reduced.replyText;
      }
    } else if (evType === "follow") {
      replyText = buildStaticReply(ev);
      nextState = "new";
      nextDraft = { package: { code: null, name: null, price: null }, scents: [], deviceColor: null, customer: {}, shippingFee: DEFAULT_SHIPPING_FEE, editing: null };
    } else if (evType === "message" && ev.message?.type && ev.message.type !== "text") {
      replyText = "กรุณาส่งข้อความพิมพ์ครับ";
    } else {
      replyText = buildStaticReply(ev);
    }

    if (confirmTriggered) {
      if (!draftComplete(nextDraft)) {
        replyText = "ขออภัยครับ ข้อมูลยังไม่ครบ กรุณากรอกข้อมูลที่ขาดครับ\n\n" + collectCustomerPrompt(nextDraft);
        nextState = "collecting_customer";
        confirmTriggered = false;
      } else {
        const code = nextDraft.package.code;
        const pkg = PACKAGES[code];
        const scents = code === "A" ? [] : (nextDraft.scents || []);
        const cust = nextDraft.customer || {};
        const payload = {
          source: "line",
          lineMessageId: String(ev.message?.id || ""),
          idempotencyKey: `line:${String(ev.message?.id || "")}`,
          lineUserId: lineUserId || undefined,
          package: { code, name: pkg.name, price: pkg.price },
          deviceColor: nextDraft.deviceColor,
          scents: scents.slice(),
          customer: {
            displayName: cust.displayName || cust.name || "",
            name: cust.name || cust.displayName || "",
            phone: String(cust.phone || ""),
            shippingAddress: cust.shippingAddress || cust.address || "",
            address: cust.address || cust.shippingAddress || "",
          },
          shippingFee: Number(nextDraft.shippingFee ?? DEFAULT_SHIPPING_FEE),
          customerNote: "",
        };
        if (!payload.lineMessageId) {
          replyText = "ขออภัยครับ ไม่สามารถสร้างออเดอร์ได้ (ไม่มี Message ID)";
          nextState = "awaiting_confirmation";
        } else {
          const orderRes = await callOrdersAPI(lineOrderToken, reqHost, payload);
          const classified = classifyOrderResult(orderRes);
          summary.orderCreated += classified.summaryInc.orderCreated | 0;
          summary.orderDuplicated += classified.summaryInc.orderDuplicated | 0;
          summary.orderFailed += classified.summaryInc.orderFailed | 0;
          nextState = classified.nextState;
          lastOrderDebug = {
            ok: orderRes.ok,
            status: orderRes.status || null,
            err: orderRes.error || null,
            body: orderRes.body ? (JSON.stringify(orderRes.body).slice(0, 500)) : null,
            httpBody: (orderRes && orderRes.body && orderRes.body.body && typeof orderRes.body.body === 'string') ? orderRes.body.body.slice(0,200) : null,
            classified: classified.kind + ":" + classified.orderNumber,
            tokenLen: lineOrderToken ? lineOrderToken.length : 0,
            host: reqHost,
          };
          if (classified.kind === "created") {
            nextDraft.orderId = classified.orderId || null;
            nextDraft.orderNumber = classified.orderNumber;
            nextState = "confirmed";
            replyText = [
              "✅ สั่งซื้อสำเร็จครับ",
              `หมายเลขออเดอร์: ${classified.orderNumber}`,
              `Set ${code} (${pkg.name}) ฿${pkg.price + Number(payload.shippingFee || 0)}`,
              `สี: ${nextDraft.deviceColor}`,
              `ชื่อ: ${cust.displayName || cust.name || "-"}`,
              `เบอร์โทร: ${maskPhone(cust.phone)}`,
              `ที่อยู่: ${maskAddress(cust.shippingAddress || cust.address)}`,
              `สถานะเริ่มต้น: รอยืนยัน (แอดมินจะตรวจสอบและติดต่อให้ครับ)`,
              `สามารถตรวจสอบสถานะใน Dashboard ได้เลยครับ`,
            ].join("\n");
          } else if (classified.kind === "duplicated") {
            nextDraft.orderId = classified.orderId || null;
            nextDraft.orderNumber = classified.orderNumber;
            nextState = "confirmed";
            replyText = [
              "📝 ออเดอร์นี้ถูกบันทึกแล้วครับ",
              `หมายเลขออเดอร์: ${classified.orderNumber}`,
              "(ระบบพบว่าข้อความนี้เคยยืนยันแล้ว ไม่ได้สร้างออเดอร์ใหม่)",
            ].join("\n");
          } else {
            nextState = "awaiting_confirmation";
            replyText = ORDER_FAIL_REPLY_TEXT;
          }

          try {
            const inventorySyncKind = classified.kind;
            const isConfirmedSync = inventorySyncKind === "created" || inventorySyncKind === "duplicated";
            const adminSyncToken = String(process.env.BACKOFFICE_ADMIN_TOKEN || "");
            if (isConfirmedSync && adminSyncToken && reqHost && classified.orderId) {
              const orderSyncId = classified.orderId;
              const syncOrderNumber = classified.orderNumber || null;

              const syncUrl = `https://${reqHost}/api/inventory/sync-order-status`;
              const patchStatusUrl = `https://${reqHost}/api/integrations/line/orders?id=${encodeURIComponent(orderSyncId)}`;

              const fireInventorySync = async () => {
                try {
                  await fetch(syncUrl, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${adminSyncToken}`,
                      "X-Admin-Token": adminSyncToken,
                    },
                    body: JSON.stringify({
                      order_id: orderSyncId,
                      order_number: syncOrderNumber,
                      old_status: "pending_confirmation",
                      new_status: "confirmed",
                    }),
                    signal: typeof AbortController !== "undefined" ? (new AbortController().signal) : undefined,
                  });
                  try {
                    await fetch(patchStatusUrl, {
                      method: "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${adminSyncToken}`,
                        "X-Admin-Token": adminSyncToken,
                      },
                      body: JSON.stringify({ status: "confirmed" }),
                    });
                  } catch (_patchErr) {}
                } catch (fireErr) {
                  const safeFire = String(fireErr?.message || "").slice(0, 200);
                  console.error("LINE webhook: inventory sync fire error", safeFire || "unknown");
                }
              };
              if (typeof setTimeout === "function") {
                setTimeout(fireInventorySync, 1);
              } else {
                Promise.resolve().then(fireInventorySync).catch(() => {});
              }
            }
          } catch (_invSyncWrap) {}
        }
      }
    }

    if (conversationRowId) {
      if (!ALLOWED_STATES.has(nextState)) nextState = "cancelled";
      try {
        await patchConversation(conversationRowId, {
          state: nextState,
          draft: JSON.parse(JSON.stringify(nextDraft)),
          last_event_id: eventRowId,
          last_message_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        });
      } catch (e) {
        const safeErr = String(e?.message || "").slice(0, 120);
        console.error("LINE webhook: supabase PATCH convo error", safeErr.length ? safeErr : "unknown");
      }
    }

    let replyResult = { skipped: true };
    if (replyToken && lineAccessToken && replyText) {
      replyResult = await callLineReply(lineAccessToken, replyToken, replyText);
    }

    let finalResult = "accepted";
    let finalReplyStatus = "skipped";
    let finalReplyError = null;
    if (replyResult.skipped || !replyToken || !lineAccessToken || !replyText) {
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
      const safeErr = String(e?.message || "").slice(0, 120);
      console.error("LINE webhook: finalize event row error", safeErr.length ? safeErr : "unknown");
    }
  }

  const anyOrderFailed = summary.orderFailed > 0;
  return json(res, 200, {
    success: !anyOrderFailed,
    processed: summary.processed,
    duplicates: summary.duplicates,
    orderCreated: summary.orderCreated,
    orderDuplicated: summary.orderDuplicated,
    orderFailed: anyOrderFailed,
    total: events.length,
    debug: debug.length ? debug : undefined,
    lastOrderDebug: lastOrderDebug || undefined,
  });
}
