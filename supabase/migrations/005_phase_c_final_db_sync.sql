-- ============================================================
-- PHASE C FINAL: DB Sync (All Discrepancies Resolved + Mangled SKU Clean + Missing OB rows)
-- APPLY IN Supabase SQL Editor ONCE (safe re-runnable for UPDATE, NOT safe re-run for INSERT)
-- ============================================================

-- ============================================================
-- PART 1: PRODUCTS — Fix 5 Devices SKU/Names (Mangled Thai Vowels)
-- ============================================================

-- 1.1 Mini สีขาว (id: 4a9f8b77-9de8-4668-9702-092d4e377f19)
UPDATE products
SET
  sku = 'MINI-MINI-ขาว',
  canonical_name = 'Mini สีขาว',
  display_name = 'Mini สีขาว',
  color = 'ขาว',
  unit_name = 'เครื่อง',
  pack_size = 1
WHERE id = '4a9f8b77-9de8-4668-9702-092d4e377f19'::uuid;

-- 1.2 Mini สีดำ (id: 2c3086e8-0036-4eee-80b9-3a6a060ba8d1)
UPDATE products
SET
  sku = 'MINI-MINI-ดำ',
  canonical_name = 'Mini สีดำ',
  display_name = 'Mini สีดำ',
  color = 'ดำ',
  unit_name = 'เครื่อง',
  pack_size = 1
WHERE id = '2c3086e8-0036-4eee-80b9-3a6a060ba8d1'::uuid;

-- 1.3 Standard สีเงิน = กล่องสีเงิน (id: 9b05ce97-1869-440d-88f3-2c5d89726e8f)
UPDATE products
SET
  sku = 'STD-STANDARD-เงิน',
  canonical_name = 'Standard สีเงิน',
  display_name = 'Standard สีเงิน',
  color = 'เงิน',
  unit_name = 'เครื่อง',
  pack_size = 1
WHERE id = '9b05ce97-1869-440d-88f3-2c5d89726e8f'::uuid;

-- 1.4 Standard สีดำ = กล่องสีดำ (id: f5ebbc17-5a9e-47f5-a075-4b687d05d4ab)
UPDATE products
SET
  sku = 'STD-STANDARD-ดำ',
  canonical_name = 'Standard สีดำ',
  display_name = 'Standard สีดำ',
  color = 'ดำ',
  unit_name = 'เครื่อง',
  pack_size = 1
WHERE id = 'f5ebbc17-5a9e-47f5-a075-4b687d05d4ab'::uuid;

-- 1.5 Standard สีฟ้า = กล่องสีฟ้า (id: 31215e43-a03e-44ea-8d71-f8bf279e4828)
UPDATE products
SET
  sku = 'STD-STANDARD-ฟ้า',
  canonical_name = 'Standard สีฟ้า',
  display_name = 'Standard สีฟ้า',
  color = 'ฟ้า',
  unit_name = 'เครื่อง',
  pack_size = 1
WHERE id = '31215e43-a03e-44ea-8d71-f8bf279e4828'::uuid;

-- ============================================================
-- PART 2: PRODUCTS — Fix 18 Scent: canonical_name → Thai (replace English/Fallback)
--         display_name = canonical_name (Thai), sku deterministic, unit_name=กล่อง, pack_size=100
-- ============================================================

-- 2.1 มิ้นต์เย็น = Black Ice Mint (id: e4d5eddf-4ce1-4133-8252-97dffcbfcd0b)
UPDATE products
SET
  sku = 'SCN-MINT-เย็น-1',
  canonical_name = 'มิ้นต์เย็น (Black Ice)',
  display_name = 'มิ้นต์เย็น (Black Ice)',
  unit_name = 'กล่อง',
  pack_size = 100,
  low_stock_threshold = 200
WHERE id = 'e4d5eddf-4ce1-4133-8252-97dffcbfcd0b'::uuid;

-- 2.2 มิ้นต์เย็น = Zero Degree Mint (id: 99989287-2a40-47f9-ab5c-e1eda61cc9a7)
UPDATE products
SET
  sku = 'SCN-MINT-เย็น-2',
  canonical_name = 'มิ้นต์เย็น (Zero Degree)',
  display_name = 'มิ้นต์เย็น (Zero Degree)',
  unit_name = 'กล่อง',
  pack_size = 100,
  low_stock_threshold = 200
WHERE id = '99989287-2a40-47f9-ab5c-e1eda61cc9a7'::uuid;

-- 2.3 กล้วยนม = กล้วย (id: 4cc09f20-37c3-4e27-a683-6f1557b5b9aa)
UPDATE products
SET
  sku = 'SCN-กล้วย-นม',
  canonical_name = 'กล้วยนม',
  display_name = 'กล้วยนม',
  unit_name = 'กล่อง',
  pack_size = 100,
  low_stock_threshold = 200
WHERE id = '4cc09f20-37c3-4e27-a683-6f1557b5b9aa'::uuid;

-- 2.4 แคนตาลูป = แคนตาลูป (id: a71f6fa4-9b8d-4f16-b9d8-72b34f117bcc)
UPDATE products
SET
  sku = 'SCN-แคน-ตาลูป',
  canonical_name = 'แคนตาลูป',
  display_name = 'แคนตาลูป',
  unit_name = 'กล่อง',
  pack_size = 100,
  low_stock_threshold = 200
WHERE id = 'a71f6fa4-9b8d-4f16-b9d8-72b34f117bcc'::uuid;

-- 2.5 โคล่า = โคล่า (id: 0c2f41a3-15f0-49e1-b3f6-5d602c1738f4)
UPDATE products
SET
  sku = 'SCN-โคล่า',
  canonical_name = 'โคล่า',
  display_name = 'โคล่า',
  unit_name = 'กล่อง',
  pack_size = 100,
  low_stock_threshold = 200
WHERE id = '0c2f41a3-15f0-49e1-b3f6-5d602c1738f4'::uuid;

-- 2.6 แตงโม = แตงโม (id: 68e2819a-dfd0-46fc-9b99-199360295d2a)
UPDATE products
SET
  sku = 'SCN-แตง-โม',
  canonical_name = 'แตงโม',
  display_name = 'แตงโม',
  unit_name = 'กล่อง',
  pack_size = 100,
  low_stock_threshold = 200
WHERE id = '68e2819a-dfd0-46fc-9b99-199360295d2a'::uuid;

-- 2.7 บลูเบอร์รี่ = บลูเบอร์รี่ (id: 24c703d9-869d-4fdc-bc02-d6953cd1f767)
UPDATE products
SET
  sku = 'SCN-บลู-เบอร์รี',
  canonical_name = 'บลูเบอร์รี่',
  display_name = 'บลูเบอร์รี่',
  unit_name = 'กล่อง',
  pack_size = 100,
  low_stock_threshold = 200
WHERE id = '24c703d9-869d-4fdc-bc02-d6953cd1f767'::uuid;

-- ============================================================
-- PART 3: STOCK_LEDGER — บลูเบอร์รี OB: 1000 beads → 1200 beads (นับ 12 กล่อง)
-- ============================================================
UPDATE stock_ledger sl
SET quantity_delta = 12 * 100,
    note = COALESCE(note, '') || ' [PhaseC: ปรับ 10→12 กล่อง ตามนับจริง 2026-10-05]'
WHERE sl.product_id = '24c703d9-869d-4fdc-bc02-d6953cd1f767'::uuid
  AND sl.movement_type = 'opening_balance'
  AND sl.quantity_delta = 10 * 100;

-- ============================================================
-- PART 4: STOCK_LEDGER — INSERT missing 4 scent OB rows (ไอศกรีม, แอปเปิ้ลเขียว, หอมหมื่นลี้, รวมกลิ่น)
-- NOTE: These 4 product_ids found by canonical name (couldn't find in 13 grid rows; likely off-screen)
-- ============================================================
INSERT INTO stock_ledger (product_id, movement_type, reference_type, reference_id, quantity_delta, reason, note)
SELECT
  p.id AS product_id,
  'opening_balance' AS movement_type,
  'initial_import' AS reference_type,
  'import:phase-c-final-sync' AS reference_id,
  v.beads AS quantity_delta,
  'Phase C Final Sync: Insert missing opening_balance rows (Physical Count 2026-10-05)' AS reason,
  v.note
FROM products p
JOIN (VALUES
  ('ไอศกรีม',     10 * 100, 'Physical Count: 10 กล่อง (ตรง 100%)'),
  ('แอปเปิ้ลเขียว', 10 * 100, 'Physical Count: 10 กล่อง (ตรง 100%)'),
  ('หอมหมื่นลี้',    5 * 100, 'Physical Count: 5 กล่อง (ตรง 100%)'),
  ('รวมกลิ่น',     94 * 100, 'Physical Count 94 กล่อง = 20 สั่งจีน + 74 นับจริง 2026-10-05')
) AS v(canonical_name, beads, note)
ON p.canonical_name = v.canonical_name
WHERE p.product_type = 'scent_pack'
  AND NOT EXISTS (
    SELECT 1 FROM stock_ledger sl2
    WHERE sl2.product_id = p.id
      AND sl2.movement_type = 'opening_balance'
  );

-- ============================================================
-- PART 5: Scent products remaining 10 rows (update unit/pack/sku using canonical name match)
-- ============================================================
UPDATE products
SET
  unit_name = 'กล่อง',
  pack_size = 100,
  low_stock_threshold = 200,
  display_name = COALESCE(NULLIF(display_name, ''), canonical_name),
  sku = CASE
    WHEN sku LIKE 'SKU-%' THEN 'SCN-' || canonical_name
    ELSE sku
  END
WHERE product_type = 'scent_pack'
  AND id NOT IN (
    'e4d5eddf-4ce1-4133-8252-97dffcbfcd0b',
    '99989287-2a40-47f9-ab5c-e1eda61cc9a7',
    '4cc09f20-37c3-4e27-a683-6f1557b5b9aa',
    'a71f6fa4-9b8d-4f16-b9d8-72b34f117bcc',
    '0c2f41a3-15f0-49e1-b3f6-5d602c1738f4',
    '68e2819a-dfd0-46fc-9b99-199360295d2a',
    '24c703d9-869d-4fdc-bc02-d6953cd1f767'
  );

-- ============================================================
-- FINAL VERIFY — 3 Result Sets
-- ============================================================

-- V1: 18 Scent packs verify = 253 กล่อง รวม
SELECT 'V1: 18 กลิ่น ตรวจ (กล่อง)' AS verify_step,
  p.canonical_name, p.unit_name, p.pack_size,
  COALESCE(SUM(sl.quantity_delta), 0) / 100.0 AS กล่อง,
  COALESCE(SUM(sl.quantity_delta), 0) AS เม็ด_db,
  p.flag
FROM products p
LEFT JOIN stock_ledger sl ON sl.product_id = p.id
WHERE p.product_type = 'scent_pack'
GROUP BY p.id, p.canonical_name, p.unit_name, p.pack_size, p.flag
ORDER BY p.canonical_name;

-- V2: 5 Devices verify
SELECT 'V2: 5 เครื่อง ตรวจ' AS verify_step,
  p.id, p.canonical_name, p.display_name, p.sku, p.unit_name, p.pack_size,
  COALESCE(SUM(sl.quantity_delta), 0) AS จำนวนเครื่อง
FROM products p
LEFT JOIN stock_ledger sl ON sl.product_id = p.id
WHERE p.product_type = 'device'
GROUP BY p.id, p.canonical_name, p.display_name, p.sku, p.unit_name, p.pack_size
ORDER BY p.canonical_name;

-- V3: stock_ledger movement_type counts
SELECT 'V3: Ledger counts' AS verify_step,
  movement_type,
  count(*) AS rows,
  sum(quantity_delta) AS total_qty
FROM stock_ledger
GROUP BY movement_type
ORDER BY movement_type;
