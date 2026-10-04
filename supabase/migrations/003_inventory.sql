CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE product_type AS ENUM ('device', 'scent_pack', 'bundle_component');

CREATE TYPE movement_type AS ENUM (
  'opening_balance',
  'purchase',
  'sale',
  'reservation',
  'release',
  'adjustment',
  'damaged',
  'lost',
  'return'
);

CREATE TYPE discrepancy_status AS ENUM (
  'open',
  'confirmed',
  'resolved',
  'blocked'
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type product_type NOT NULL,
  pack_size INT NOT NULL DEFAULT 1,
  unit_name TEXT NOT NULL DEFAULT 'unit',
  low_stock_threshold INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  color TEXT,
  canonical_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  cost_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0,
  flag TEXT NOT NULL DEFAULT 'ok',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT products_sku_unique UNIQUE (sku)
);

CREATE TABLE IF NOT EXISTS aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias TEXT NOT NULL,
  alias_type TEXT NOT NULL,
  canonical_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT aliases_alias_canonical_unique UNIQUE (alias, canonical_product_id)
);

CREATE TABLE IF NOT EXISTS stock_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  movement_type movement_type NOT NULL,
  quantity_delta INT NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('line_order', 'stocktake', 'import', 'admin', 'initial_import')),
  reference_id TEXT,
  reason TEXT NOT NULL,
  note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_ledger_line_order_idempotent_partial
  ON stock_ledger (reference_id, movement_type)
  WHERE reference_type = 'line_order';

CREATE TABLE IF NOT EXISTS discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  expected_quantity INT NOT NULL,
  counted_quantity INT NOT NULL,
  difference INT GENERATED ALWAYS AS (counted_quantity - expected_quantity) STORED,
  unit TEXT NOT NULL DEFAULT 'unit',
  status discrepancy_status NOT NULL DEFAULT 'open',
  reason TEXT NOT NULL,
  note TEXT,
  detected_by TEXT,
  stocktake_reference TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS initial_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_reference TEXT,
  source_notes TEXT NOT NULL,
  import_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  import_data JSONB,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_aliases_updated_at
  BEFORE UPDATE ON aliases
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_discrepancies_updated_at
  BEFORE UPDATE ON discrepancies
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_initial_imports_updated_at
  BEFORE UPDATE ON initial_imports
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION prevent_negative_pl()
RETURNS TRIGGER AS $$
DECLARE
  current_on_hand INT;
BEGIN
  SELECT COALESCE(SUM(CASE
    WHEN movement_type IN ('opening_balance', 'purchase', 'return') THEN quantity_delta
    WHEN movement_type IN ('sale', 'damaged', 'lost', 'reservation') THEN quantity_delta
    WHEN movement_type = 'adjustment' THEN quantity_delta
    WHEN movement_type = 'release' THEN quantity_delta
    ELSE 0
  END), 0) INTO current_on_hand
  FROM stock_ledger
  WHERE product_id = NEW.product_id;

  IF (current_on_hand + NEW.quantity_delta) < 0
     AND NEW.movement_type NOT IN ('opening_balance', 'adjustment') THEN
    RAISE EXCEPTION 'Insufficient available stock for product %', NEW.product_id
      USING HINT = 'Available stock is insufficient for this movement.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_negative_pl
  BEFORE INSERT ON stock_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_negative_pl();

CREATE INDEX IF NOT EXISTS idx_aliases_canonical_product_id ON aliases(canonical_product_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_product_id ON stock_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_movement_type ON stock_ledger(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_reference ON stock_ledger(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_created_at ON stock_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_discrepancies_product_id ON discrepancies(product_id);
CREATE INDEX IF NOT EXISTS idx_discrepancies_status ON discrepancies(status);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);

CREATE OR REPLACE VIEW inventory_balances AS
WITH ledger_agg AS (
  SELECT
    sl.product_id,
    COALESCE(SUM(CASE
      WHEN sl.movement_type IN ('opening_balance', 'purchase', 'return') THEN sl.quantity_delta
      WHEN sl.movement_type IN ('sale', 'damaged', 'lost', 'reservation') THEN sl.quantity_delta
      WHEN sl.movement_type = 'adjustment' THEN sl.quantity_delta
      WHEN sl.movement_type = 'release' THEN sl.quantity_delta
      ELSE 0
    END), 0) AS on_hand,
    COALESCE(SUM(CASE
      WHEN sl.movement_type = 'reservation' THEN sl.quantity_delta
      WHEN sl.movement_type = 'release' THEN sl.quantity_delta
      ELSE 0
    END), 0) AS reserved_sum_net
  FROM stock_ledger sl
  GROUP BY sl.product_id
)
SELECT
  p.id AS product_id,
  p.sku,
  p.display_name,
  p.canonical_name,
  p.product_type,
  p.active,
  p.low_stock_threshold,
  p.unit_name,
  p.pack_size,
  COALESCE(la.on_hand, 0) AS on_hand,
  COALESCE(la.reserved_sum_net, 0) AS reserved_sum_net,
  CASE
    WHEN p.active = false
      OR EXISTS (
        SELECT 1 FROM discrepancies d
        WHERE d.product_id = p.id
          AND d.status = 'blocked'
      )
    THEN COALESCE(la.on_hand, 0)
    ELSE 0
  END AS blocked_qty,
  GREATEST(
    0,
    COALESCE(la.on_hand, 0) - CASE
      WHEN p.active = false
        OR EXISTS (
          SELECT 1 FROM discrepancies d
          WHERE d.product_id = p.id
            AND d.status = 'blocked'
        )
      THEN COALESCE(la.on_hand, 0)
      ELSE 0
    END
  ) AS available,
  (COALESCE(la.on_hand, 0) <= p.low_stock_threshold) AS low_stock
FROM products p
LEFT JOIN ledger_agg la ON la.product_id = p.id;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE discrepancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE initial_imports ENABLE ROW LEVEL SECURITY;
