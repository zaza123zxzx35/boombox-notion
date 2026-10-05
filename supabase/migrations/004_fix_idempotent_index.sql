DROP INDEX IF EXISTS stock_ledger_line_order_idempotent_partial;
CREATE UNIQUE INDEX IF NOT EXISTS stock_ledger_line_order_idempotent_partial
  ON stock_ledger (reference_id, product_id, movement_type)
  WHERE reference_type = 'line_order';
