const PACKAGES = {
  A: { name: "เริ่มต้น", price: 299, boxes: 1 },
  B: { name: "คุ้มค่า", price: 389, boxes: 2 },
  C: { name: "จัดเต็ม", price: 499, boxes: 4 },
  D: { name: "VIP", price: 649, boxes: 6 },
};

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

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
}

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function isAuthorized(req, expected) {
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const webhook = String(req.headers["x-line-webhook-secret"] || "");
  const admin = String(req.headers["x-admin-token"] || "");
  return [bearer, webhook, admin].some((value) => value && value === expected);
}

function validateOrder(input) {
  if (!input || typeof input !== "object") return "Request body must be an object";
  if (input.source !== "line") return "source must be line";
  if (!input.idempotencyKey && !input.lineMessageId) return "idempotencyKey or lineMessageId is required";
  const pkg = PACKAGES[input.package?.code];
  if (!pkg) return "package.code must be A, B, C or D";
  const scents = Array.isArray(input.scents) ? input.scents : [];
  if (input.package.code === "A" && scents.length) return "Set A does not accept custom scents";
  if (input.package.code !== "A" && scents.length !== pkg.boxes) return `Set ${input.package.code} requires ${pkg.boxes} scent selections`;
  if (scents.some((scent) => !FLAVORS.has(String(scent)))) return "One or more scents are not in the catalog";
  if (Number(input.package.price) !== pkg.price) return "package.price does not match the server catalog";
  if (Number(input.shippingFee || 0) < 0) return "shippingFee must be zero or greater";
  return null;
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
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  if (!response.ok) throw new Error(body?.message || body?.hint || `Supabase request failed (${response.status})`);
  return body;
}

function orderNumber() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12);
  return `ORD-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function createOrder(req, res) {
  const secret = env("LINE_ORDER_API_TOKEN");
  if (!isAuthorized(req, secret)) return json(res, 401, { success: false, error: "Unauthorized" });
  const input = req.body || {};
  const normalized = { ...input, idempotencyKey: input.idempotencyKey || `line:${input.lineMessageId}` };
  const error = validateOrder(normalized);
  if (error) return json(res, 400, { success: false, error });

  const existing = await supabase(`line_orders?select=*&idempotency_key=eq.${encodeURIComponent(normalized.idempotencyKey)}&limit=1`, { method: "GET" });
  if (existing?.[0]) return json(res, 200, { success: true, duplicate: true, order: existing[0] });

  const pkg = PACKAGES[normalized.package.code];
  const shippingFee = Number(normalized.shippingFee || 0);
  const row = {
    order_number: orderNumber(),
    source: "line",
    line_user_id: normalized.lineUserId || null,
    line_message_id: normalized.lineMessageId || null,
    idempotency_key: normalized.idempotencyKey,
    customer: normalized.customer || {},
    package_code: normalized.package.code,
    package_name: pkg.name,
    unit_price: pkg.price,
    device_color: normalized.deviceColor || null,
    scents: normalized.package.code === "A" ? [] : normalized.scents,
    payment_method: normalized.paymentMethod || "cod",
    shipping_fee: shippingFee,
    total: pkg.price + shippingFee,
    customer_note: normalized.customerNote || null,
    status: "pending_confirmation",
    raw_payload: normalized,
  };
  const created = await supabase("line_orders", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  return json(res, 201, { success: true, order: created?.[0] || row });
}

async function listOrders(req, res) {
  const adminToken = env("BACKOFFICE_ADMIN_TOKEN");
  if (!isAuthorized(req, adminToken)) return json(res, 401, { success: false, error: "Unauthorized" });
  const status = req.query?.status ? `&status=eq.${encodeURIComponent(req.query.status)}` : "";
  const rows = await supabase(`line_orders?select=*&order=created_at.desc&limit=100${status}`, { method: "GET" });
  return json(res, 200, { success: true, orders: rows || [] });
}

async function updateStatus(req, res) {
  const adminToken = env("BACKOFFICE_ADMIN_TOKEN");
  if (!isAuthorized(req, adminToken)) return json(res, 401, { success: false, error: "Unauthorized" });
  const id = req.query?.id;
  const status = req.body?.status;
  const allowed = new Set(["pending_confirmation", "confirmed", "packing", "shipped", "completed", "cancelled"]);
  if (!id || !allowed.has(status)) return json(res, 400, { success: false, error: "Invalid id or status" });
  const rows = await supabase(`line_orders?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status }),
  });
  if (!rows?.[0]) return json(res, 404, { success: false, error: "Order not found" });
  return json(res, 200, { success: true, order: rows[0] });
}

export default async function handler(req, res) {
  try {
    if (req.method === "POST") return await createOrder(req, res);
    if (req.method === "GET") return await listOrders(req, res);
    if (req.method === "PATCH") return await updateStatus(req, res);
    res.setHeader("Allow", "GET, POST, PATCH");
    return json(res, 405, { success: false, error: "Method not allowed" });
  } catch (error) {
    console.error("LINE orders API error", error);
    return json(res, 500, { success: false, error: "Internal server error" });
  }
}
