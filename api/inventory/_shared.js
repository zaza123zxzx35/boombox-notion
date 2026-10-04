const PACKAGES = {
  A: { name: "เริ่มต้น", price: 299, boxes: 1 },
  B: { name: "คุ้มค่า", price: 389, boxes: 2 },
  C: { name: "จัดเต็ม", price: 499, boxes: 4 },
  D: { name: "VIP", price: 649, boxes: 6 },
};

const FLAVORS = new Set([
  "สตรอว์เบอร์รี", "องุ่น", "แอปเปิล", "แตงโม", "พีช", "มะม่วง", "ลิ้นจี่",
  "บลูเบอร์รี", "เชอร์รี", "สับปะรด", "เลมอน", "ส้ม", "มะพร้าว", "กล้วย",
  "กีวี", "มิ้นท์เย็น", "สเปียร์มิ้นท์", "เปปเปอร์มิ้นท์", "เมนทอล",
]);

const PACKAGE_BEADS = {
  A: 200,
  B: 400,
  C: 800,
  D: 1200,
};

const ALLOWED_MOVEMENTS = new Set([
  "purchase",
  "sale",
  "damaged",
  "lost",
  "return",
  "adjustment",
]);

const ALLOWED_REFERENCE_TYPES = new Set([
  "line_order",
  "admin",
  "stocktake",
  "initial_import",
  "import",
]);

const ALLOWED_DISCREPANCY_STATUS = new Set([
  "open",
  "confirmed",
  "resolved",
  "blocked",
]);

const ORDER_STATUSES = new Set([
  "pending_confirmation",
  "confirmed",
  "packing",
  "shipped",
  "completed",
  "cancelled",
]);

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
}

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function isAuthorizedAdmin(req) {
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const adminToken = String(req.headers["x-admin-token"] || "");
  const expected = process.env.BACKOFFICE_ADMIN_TOKEN;
  if (!expected) return false;
  return (bearer && bearer === expected) || (adminToken && adminToken === expected);
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

export {
  env,
  json,
  isAuthorizedAdmin,
  supabase,
  PACKAGES,
  FLAVORS,
  PACKAGE_BEADS,
  ALLOWED_MOVEMENTS,
  ALLOWED_REFERENCE_TYPES,
  ALLOWED_DISCREPANCY_STATUS,
  ORDER_STATUSES,
};
