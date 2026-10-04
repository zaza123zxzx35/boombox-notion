import {
  env,
  json,
  isAuthorizedAdmin,
  supabase,
  PACKAGES,
  ALLOWED_MOVEMENTS,
  ALLOWED_REFERENCE_TYPES,
  ALLOWED_DISCREPANCY_STATUS,
  ORDER_STATUSES,
} from "./_shared.js";
import { defaultSeedPreview } from "./_seed.js";

async function getInventorySummary(req, res) {
  if (!isAuthorizedAdmin(req)) return json(res, 401, { success: false, error: "Unauthorized" });

  const products = await supabase("inventory_products?select=*", { method: "GET" }) || [];
  const aliases = await supabase("inventory_product_aliases?select=*", { method: "GET" }) || [];
  const balances = await supabase("inventory_balances?select=*", { method: "GET" }) || [];
  const discrepancies = await supabase("inventory_discrepancies?select=*", { method: "GET" }) || [];

  const balanceMap = new Map();
  (balances || []).forEach((b) => balanceMap.set(b.product_id, b));

  let machinesAvailable = 0;
  let scentPacks100Available = 0;
  const lowStock = [];
  let blockedCount = 0;

  (products || []).forEach((p) => {
    const bal = balanceMap.get(p.id) || { on_hand: 0, available: 0, reserved: 0 };
    if (p.product_type === "device") {
      if ((bal.available || 0) > 0) machinesAvailable += Number(bal.available || 0);
    }
    if (p.product_type === "scent_pack" && Number(p.pack_size) === 100) {
      scentPacks100Available += (Number(bal.on_hand || 0) / 100);
    }
    if (p.flag === "blocked" || !p.active) blockedCount++;
    const avail = Number(bal.available ?? bal.on_hand ?? 0);
    if (p.product_type === "device" && avail <= 1) lowStock.push({ id: p.id, name: p.canonical_name, available: avail });
    if (p.product_type === "scent_pack" && Number(p.pack_size) === 100) {
      const packs = Math.floor(avail / 100);
      if (packs <= 2) lowStock.push({ id: p.id, name: p.canonical_name, available_packs: packs, available_beads: avail });
    }
  });

  scentPacks100Available = Math.floor(scentPacks100Available * 100) / 100;

  return json(res, 200, {
    success: true,
    summary: {
      machinesAvailable,
      scentPacks100Available,
      lowStock,
      blockedCount,
      totalProducts: (products || []).length,
      openDiscrepancies: (discrepancies || []).filter((d) => d.status === "open" || d.status === "confirmed").length,
    },
    products,
    aliases,
    balances,
    discrepancies,
  });
}

async function getProducts(req, res) {
  if (!isAuthorizedAdmin(req)) return json(res, 401, { success: false, error: "Unauthorized" });
  const rows = await supabase("inventory_products?select=*&order=created_at.desc", { method: "GET" });
  return json(res, 200, { success: true, products: rows || [] });
}

async function getLedger(req, res) {
  if (!isAuthorizedAdmin(req)) return json(res, 401, { success: false, error: "Unauthorized" });
  const productId = req.query?.product_id;
  const limit = Number(req.query?.limit || 200);
  let path = `inventory_ledger?select=*&order=created_at.desc&limit=${limit}`;
  if (productId) path += `&product_id=eq.${encodeURIComponent(productId)}`;
  const rows = await supabase(path, { method: "GET" });
  return json(res, 200, { success: true, ledger: rows || [] });
}

async function getDiscrepancies(req, res) {
  if (!isAuthorizedAdmin(req)) return json(res, 401, { success: false, error: "Unauthorized" });
  const rows = await supabase("inventory_discrepancies?select=*&order=created_at.desc", { method: "GET" });
  return json(res, 200, { success: true, discrepancies: rows || [] });
}

async function handlePostLedger(req, res) {
  if (!isAuthorizedAdmin(req)) return json(res, 401, { success: false, error: "Unauthorized" });
  const body = req.body || {};

  if (!body.product_id) return json(res, 400, { success: false, error: "product_id is required" });
  if (typeof body.quantity_delta !== "number") return json(res, 400, { success: false, error: "quantity_delta must be a number" });
  if (!ALLOWED_MOVEMENTS.has(body.movement_type)) return json(res, 400, { success: false, error: `movement_type must be one of: ${[...ALLOWED_MOVEMENTS].join(", ")}` });
  if (body.reference_type && !ALLOWED_REFERENCE_TYPES.has(body.reference_type)) return json(res, 400, { success: false, error: `reference_type must be one of: ${[...ALLOWED_REFERENCE_TYPES].join(", ")}` });
  if (body.movement_type === "opening_balance") return json(res, 400, { success: false, error: "opening_balance must be set via import/commit, not direct ledger" });

  if (body.quantity_delta < 0) {
    const balRows = await supabase(`inventory_balances?select=*&product_id=eq.${encodeURIComponent(body.product_id)}&limit=1`, { method: "GET" });
    const onHand = Number(balRows?.[0]?.on_hand || 0);
    if (onHand + body.quantity_delta < 0) {
      return json(res, 400, { success: false, error: `Insufficient balance: on_hand=${onHand}, requested_delta=${body.quantity_delta}` });
    }
  }

  const row = {
    product_id: body.product_id,
    movement_type: body.movement_type,
    quantity_delta: Number(body.quantity_delta),
    reference_type: body.reference_type || "manual",
    reference_id: body.reference_id || null,
    note: body.note || null,
    created_by: body.created_by || "api-ledger",
  };

  const inserted = await supabase("inventory_ledger", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });

  const newBalRows = await supabase(`inventory_balances?select=*&product_id=eq.${encodeURIComponent(body.product_id)}&limit=1`, { method: "GET" });

  return json(res, 201, {
    success: true,
    movement: inserted?.[0] || row,
    new_balance: newBalRows?.[0] || null,
  });
}

async function handleStocktake(req, res) {
  if (!isAuthorizedAdmin(req)) return json(res, 401, { success: false, error: "Unauthorized" });
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return json(res, 400, { success: false, error: "items array is required" });

  const results = [];
  const createdBy = body.created_by || "stocktake-api";
  const stocktakeRef = body.reference_id || `stocktake:${Date.now()}`;

  for (const item of items) {
    if (!item.product_id || typeof item.counted_quantity !== "number") continue;

    const balRows = await supabase(`inventory_balances?select=*&product_id=eq.${encodeURIComponent(item.product_id)}&limit=1`, { method: "GET" });
    const onHand = Number(balRows?.[0]?.on_hand || 0);
    const diff = Number(item.counted_quantity) - onHand;

    let movement = null;
    if (diff !== 0) {
      const mv = {
        product_id: item.product_id,
        movement_type: "adjustment",
        quantity_delta: diff,
        reference_type: "stocktake",
        reference_id: stocktakeRef,
        note: item.note || `Stocktake diff: counted=${item.counted_quantity}, was=${onHand}`,
        created_by: createdBy,
      };
      const inserted = await supabase("inventory_ledger", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(mv),
      });
      movement = inserted?.[0] || mv;

      const disc = {
        product_id: item.product_id,
        status: "open",
        expected_quantity: onHand,
        counted_quantity: Number(item.counted_quantity),
        quantity_delta: diff,
        reason: item.reason || item.note || `Stocktake discrepancy: ${diff > 0 ? "over" : "short"} ${Math.abs(diff)}`,
        detected_by: createdBy,
        stocktake_reference: stocktakeRef,
      };
      await supabase("inventory_discrepancies", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(disc),
      });
    }

    results.push({
      product_id: item.product_id,
      previous_on_hand: onHand,
      counted_quantity: Number(item.counted_quantity),
      diff,
      adjusted: diff !== 0,
      movement,
    });
  }

  return json(res, 200, {
    success: true,
    reference_id: stocktakeRef,
    results,
    total_adjusted: results.filter((r) => r.adjusted).length,
  });
}

async function handlePatchDiscrepancy(req, res) {
  if (!isAuthorizedAdmin(req)) return json(res, 401, { success: false, error: "Unauthorized" });
  const id = req.query?.id;
  const body = req.body || {};
  if (!id) return json(res, 400, { success: false, error: "id query param is required" });

  const updates = {};
  if (body.status) {
    if (!ALLOWED_DISCREPANCY_STATUS.has(body.status)) {
      return json(res, 400, { success: false, error: `status must be one of: ${[...ALLOWED_DISCREPANCY_STATUS].join(", ")}` });
    }
    updates.status = body.status;
    if (body.status === "resolved") {
      updates.resolved_at = new Date().toISOString();
      updates.resolved_by = body.resolved_by || "discrepancy-api";
    }
  }
  if (body.reason) updates.reason = body.reason;
  if (body.resolved_by && !updates.resolved_by) updates.resolved_by = body.resolved_by;
  if (body.blocked_note) updates.blocked_note = body.blocked_note;

  if (!Object.keys(updates).length) return json(res, 400, { success: false, error: "No valid fields to update" });

  const rows = await supabase(`inventory_discrepancies?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(updates),
  });

  if (!rows?.[0]) return json(res, 404, { success: false, error: "Discrepancy not found" });
  return json(res, 200, { success: true, discrepancy: rows[0] });
}

async function handleImportPreview(req, res) {
  if (!isAuthorizedAdmin(req)) return json(res, 401, { success: false, error: "Unauthorized" });
  const body = req.body || {};
  let previewSource;

  if (!body.products || !Array.isArray(body.products) || body.products.length === 0) {
    previewSource = defaultSeedPreview();
  } else {
    previewSource = { products: body.products };
  }

  const preview_rows = [];
  const blocked = [];
  const discrepancies = [];
  let import_ready_count = 0;
  let blocked_count = 0;
  let totalDevices = 0;
  let totalScentPacks = 0;
  let totalBeads = 0;

  previewSource.products.forEach((p, idx) => {
    const row = {
      index: idx,
      canonical_name: p.canonical_name,
      product_type: p.product_type,
      color: p.color || null,
      machine_type: p.machine_type || null,
      pack_size: p.pack_size || null,
      unit_name: p.unit_name || null,
      counted_quantity: Number(p.counted_quantity || 0),
      flag: p.flag || "ok",
      aliases: p.aliases || [],
      discrepancy_reason: p.discrepancy_reason || null,
    };
    preview_rows.push(row);

    if (row.flag === "blocked") {
      blocked.push(row.canonical_name);
      blocked_count++;
    } else {
      import_ready_count++;
      if (row.flag === "discrepancy") discrepancies.push(row.canonical_name);
    }

    if (row.product_type === "device") totalDevices += row.counted_quantity;
    if (row.product_type === "scent_pack") {
      totalScentPacks += row.pack_size ? row.counted_quantity / row.pack_size : 0;
      totalBeads += row.counted_quantity;
    }
  });

  return json(res, 200, {
    success: true,
    preview_rows,
    flagged: { blocked, discrepancies },
    import_ready_count,
    blocked_count,
    totals: {
      device_count: totalDevices,
      scent_pack_count: Math.floor(totalScentPacks * 100) / 100,
      beads_count: totalBeads,
    },
  });
}

async function handleImportCommit(req, res) {
  if (!isAuthorizedAdmin(req)) return json(res, 401, { success: false, error: "Unauthorized" });
  const body = req.body || {};

  if (body.user_confirmed !== true) return json(res, 400, { success: false, error: "user_confirmed must be true" });
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return json(res, 400, { success: false, error: "items array is required" });

  const blockedItems = items.filter((i) => i.flag === "blocked");
  if (blockedItems.length) return json(res, 400, { success: false, error: "Blocked items cannot be imported: " + blockedItems.map((i) => i.canonical_name).join(", ") });

  const createdBy = body.created_by || "import-api";
  const importRef = body.import_reference || `import:${Date.now()}`;

  const importRow = {
    import_reference: importRef,
    total_items: items.length,
    created_by: createdBy,
    note: body.note || null,
  };
  await supabase("inventory_initial_imports", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(importRow),
  });

  const results = [];
  for (const item of items) {
    const productPayload = {
      canonical_name: item.canonical_name,
      product_type: item.product_type,
      color: item.color || null,
      machine_type: item.machine_type || null,
      pack_size: item.pack_size || null,
      unit_name: item.unit_name || null,
      active: item.flag === "blocked" ? false : true,
      flag: item.flag || "ok",
    };

    let product;
    const existing = await supabase(`inventory_products?select=*&canonical_name=eq.${encodeURIComponent(item.canonical_name)}&limit=1`, { method: "GET" });
    if (existing?.[0]) {
      const updated = await supabase(`inventory_products?id=eq.${encodeURIComponent(existing[0].id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(productPayload),
      });
      product = updated?.[0] || existing[0];
    } else {
      const created = await supabase("inventory_products", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(productPayload),
      });
      product = created?.[0];
    }

    if (product && (item.aliases || []).length) {
      for (const alias of item.aliases) {
        try {
          await supabase("inventory_product_aliases", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({ product_id: product.id, alias_name: String(alias) }),
          });
        } catch (_) {}
      }
    }

    if (product && Number(item.counted_quantity || 0) !== 0) {
      const mv = {
        product_id: product.id,
        movement_type: "opening_balance",
        quantity_delta: Number(item.counted_quantity),
        reference_type: "initial_import",
        reference_id: importRef,
        note: `Initial import opening balance`,
        created_by: createdBy,
      };
      await supabase("inventory_ledger", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(mv),
      });
    }

    if (product && (item.flag === "discrepancy" || item.flag === "blocked")) {
      const discPayload = {
        product_id: product.id,
        status: item.flag === "blocked" ? "blocked" : "open",
        expected_quantity: null,
        counted_quantity: Number(item.counted_quantity || 0),
        quantity_delta: null,
        reason: item.discrepancy_reason || `Initial import flagged as ${item.flag}`,
        detected_by: createdBy,
        stocktake_reference: importRef,
        ...(item.flag === "blocked" ? { blocked_note: item.discrepancy_reason || "Blocked during initial import" } : {}),
      };
      await supabase("inventory_discrepancies", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(discPayload),
      });
    }

    results.push({
      canonical_name: item.canonical_name,
      product_id: product?.id || null,
      status: product ? "imported" : "failed",
      flag: item.flag || "ok",
    });
  }

  return json(res, 200, {
    success: true,
    import_reference: importRef,
    results,
    total_imported: results.filter((r) => r.status === "imported").length,
    total_failed: results.filter((r) => r.status === "failed").length,
  });
}

async function findDeviceProduct(color, packageCode, machine_type_hint) {
  let machineType = "regular";
  if (packageCode === "D") machineType = "vip";
  else if (machine_type_hint === "mini") machineType = "mini";

  const rows = await supabase(
    `inventory_products?select=*&product_type=eq.device&color=eq.${encodeURIComponent(color || "")}&limit=10`,
    { method: "GET" }
  );
  if (!rows?.length) return null;

  let match = rows.find((r) => (r.machine_type || "regular") === machineType);
  if (!match) match = rows.find((r) => (r.machine_type || "regular") === "regular");
  if (!match && machineType === "mini") match = rows.find((r) => (r.machine_type || "") === "mini");
  if (!match) match = rows[0];
  return match;
}

async function findScentPackProduct(scentName) {
  const byName = await supabase(
    `inventory_products?select=*&product_type=eq.scent_pack&canonical_name=eq.${encodeURIComponent(String(scentName || ""))}&limit=1`,
    { method: "GET" }
  );
  if (byName?.[0]) return byName[0];

  const byAlias = await supabase(
    `inventory_product_aliases?select=product_id,inventory_products(*)&alias_name=eq.${encodeURIComponent(String(scentName || ""))}&limit=1`,
    { method: "GET" }
  );
  if (byAlias?.[0]?.inventory_products) {
    return Array.isArray(byAlias[0].inventory_products) ? byAlias[0].inventory_products[0] : byAlias[0].inventory_products;
  }
  const all = await supabase(`inventory_products?select=*&product_type=eq.scent_pack&limit=200`, { method: "GET" });
  if (!all?.length) return null;
  return all.find((p) => {
    const cn = String(p.canonical_name || "").toLowerCase();
    const sn = String(scentName || "").toLowerCase();
    return cn && sn && (cn.includes(sn) || sn.includes(cn));
  }) || null;
}

async function handleSyncOrderStatus(req, res) {
  if (!isAuthorizedAdmin(req)) return json(res, 401, { success: false, error: "Unauthorized" });
  const body = req.body || {};
  const { order_id, new_status, old_status } = body;

  if (!order_id) return json(res, 400, { success: false, error: "order_id is required" });
  if (!ORDER_STATUSES.has(new_status)) return json(res, 400, { success: false, error: `new_status must be one of: ${[...ORDER_STATUSES].join(", ")}` });

  const orderRows = await supabase(
    `line_orders?select=*&id=eq.${encodeURIComponent(order_id)}&limit=1`,
    { method: "GET" }
  );
  const order = orderRows?.[0];
  if (!order) return json(res, 404, { success: false, error: "Order not found" });

  const existingLedger = await supabase(
    `inventory_ledger?select=*&reference_type=eq.line_order&reference_id=eq.${encodeURIComponent(order_id)}&movement_type=in.(sale,reservation,release,return)`,
    { method: "GET" }
  );
  const existing = existingLedger || [];
  const existingSale = existing.filter((r) => r.movement_type === "sale");
  const existingReturn = existing.filter((r) => r.movement_type === "return");

  const createdBy = "sync-order-api";
  const refType = "line_order";
  const refId = String(order_id);
  const movements = [];

  if (new_status === "confirmed" && (!old_status || old_status === "pending_confirmation")) {
    if (existingSale.length > 0) {
      return json(res, 200, { success: true, skipped: true, reason: "sale_movements_already_exist", order });
    }

    const deviceColor = order.device_color || null;
    const pkgCode = order.package_code || "A";
    const device = await findDeviceProduct(deviceColor, pkgCode);
    if (device) {
      const mv = {
        product_id: device.id,
        movement_type: "sale",
        quantity_delta: -1,
        reference_type: refType,
        reference_id: refId,
        note: `Order ${order.order_number || order_id} device sale`,
        created_by: createdBy,
      };
      const ins = await supabase("inventory_ledger", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(mv),
      });
      movements.push(ins?.[0] || mv);
    }

    const scents = Array.isArray(order.scents) ? order.scents : [];
    for (const scentName of scents) {
      const scentProduct = await findScentPackProduct(scentName);
      if (scentProduct) {
        const beadsDelta = scentProduct.pack_size ? -1 * Number(scentProduct.pack_size) : -100;
        const mv = {
          product_id: scentProduct.id,
          movement_type: "sale",
          quantity_delta: beadsDelta,
          reference_type: refType,
          reference_id: refId,
          note: `Order ${order.order_number || order_id} scent: ${scentName}`,
          created_by: createdBy,
        };
        const ins = await supabase("inventory_ledger", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(mv),
        });
        movements.push(ins?.[0] || mv);
      }
    }
    return json(res, 200, { success: true, transition: "pending→confirmed", movements_created: movements.length, movements });
  }

  if (new_status === "cancelled" && old_status === "confirmed") {
    if (existingReturn.length > 0) {
      return json(res, 200, { success: true, skipped: true, reason: "return_movements_already_exist", order });
    }
    if (existingSale.length === 0) {
      return json(res, 200, { success: true, skipped: true, reason: "no_sale_movements_to_invert", order });
    }

    for (const sale of existingSale) {
      const mv = {
        product_id: sale.product_id,
        movement_type: "return",
        quantity_delta: -1 * Number(sale.quantity_delta),
        reference_type: refType,
        reference_id: refId,
        note: `Order ${order.order_number || order_id} cancelled - invert sale`,
        created_by: createdBy,
      };
      const ins = await supabase("inventory_ledger", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(mv),
      });
      movements.push(ins?.[0] || mv);
    }
    return json(res, 200, { success: true, transition: "confirmed→cancelled", movements_created: movements.length, movements });
  }

  if (new_status === "cancelled" && (!old_status || old_status === "pending_confirmation")) {
    return json(res, 200, { success: true, skipped: true, no_movement: true, transition: "pending→cancelled", order });
  }

  const otherTransitions = new Set(["packing", "shipped", "completed"]);
  if (otherTransitions.has(new_status)) {
    return json(res, 200, { success: true, skipped: true, reason: "status_no_inventory_movement_required", transition: `${old_status || "current"}→${new_status}`, order });
  }

  return json(res, 200, { success: true, skipped: true, reason: "unhandled_transition_no_movement", new_status, old_status, order });
}

export default async function handler(req, res) {
  try {
    const urlPath = (req.url || "").split("?")[0];
    const path = urlPath.replace(/^\/api\/inventory\/?/, "");

    if (req.method === "GET") {
      if (path === "" || path === "summary") return await getInventorySummary(req, res);
      if (path === "products") return await getProducts(req, res);
      if (path === "ledger") return await getLedger(req, res);
      if (path === "discrepancies") return await getDiscrepancies(req, res);
    }
    if (req.method === "POST") {
      if (path === "ledger") return await handlePostLedger(req, res);
      if (path === "stocktake") return await handleStocktake(req, res);
      if (path === "import/preview") return await handleImportPreview(req, res);
      if (path === "import/commit") return await handleImportCommit(req, res);
      if (path === "sync-order-status") return await handleSyncOrderStatus(req, res);
    }
    if (req.method === "PATCH") {
      if (path === "discrepancies") return await handlePatchDiscrepancy(req, res);
    }

    res.setHeader("Allow", "GET, POST, PATCH");
    return json(res, 405, { success: false, error: "Method not allowed or path not found" });
  } catch (error) {
    console.error("Inventory API error", error);
    return json(res, 500, { success: false, error: "Internal server error", detail: String(error.message || error) });
  }
}
