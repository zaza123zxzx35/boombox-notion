-- BOOMBOX TH: merge Black Ice Mint and Zero Degree Mint into one SKU: มิ้นต์
-- Run once in Supabase SQL Editor after 003_inventory.sql/004_fix_idempotent_index.sql.
-- Historical ledger and discrepancy rows are preserved and moved to the surviving product.
BEGIN;

DO $$
DECLARE
  keep_id uuid;
  duplicate_id uuid;
  row_ledger record;
  existing_ledger_id uuid;
BEGIN
  SELECT id INTO keep_id
  FROM public.products
  WHERE canonical_name IN ('มิ้นต์', 'มิ้นต์เย็น')
    AND product_type = 'scent_pack'
  ORDER BY CASE WHEN canonical_name = 'มิ้นต์' THEN 0 ELSE 1 END, created_at
  LIMIT 1;

  SELECT id INTO duplicate_id
  FROM public.products
  WHERE canonical_name = 'ซีโร่ดีกรีมิ้นท์'
    AND product_type = 'scent_pack'
    AND (keep_id IS NULL OR id <> keep_id)
  ORDER BY created_at
  LIMIT 1;

  IF keep_id IS NULL AND duplicate_id IS NOT NULL THEN
    keep_id := duplicate_id;
    duplicate_id := NULL;
  END IF;

  IF keep_id IS NULL THEN
    RAISE NOTICE 'No mint products found; nothing to merge';
    RETURN;
  END IF;

  UPDATE public.products
  SET canonical_name = 'มิ้นต์',
      display_name = 'มิ้นต์',
      product_type = 'scent_pack',
      pack_size = 100,
      unit_name = 'เม็ด',
      active = true,
      updated_at = now()
  WHERE id = keep_id;

  IF duplicate_id IS NOT NULL THEN
    -- Avoid the partial unique index collision when both old SKUs were used
    -- in the same reference before the merge.
    FOR row_ledger IN
      SELECT * FROM public.stock_ledger WHERE product_id = duplicate_id
    LOOP
      SELECT id INTO existing_ledger_id
      FROM public.stock_ledger
      WHERE product_id = keep_id
        AND movement_type = row_ledger.movement_type
        AND reference_type IS NOT DISTINCT FROM row_ledger.reference_type
        AND reference_id IS NOT DISTINCT FROM row_ledger.reference_id
      LIMIT 1;

      IF existing_ledger_id IS NULL THEN
        UPDATE public.stock_ledger SET product_id = keep_id WHERE id = row_ledger.id;
      ELSE
        UPDATE public.stock_ledger
        SET quantity_delta = quantity_delta + row_ledger.quantity_delta
        WHERE id = existing_ledger_id;
        DELETE FROM public.stock_ledger WHERE id = row_ledger.id;
      END IF;
    END LOOP;

    UPDATE public.discrepancies SET product_id = keep_id WHERE product_id = duplicate_id;

    -- Remove aliases that already exist for the surviving product first.
    DELETE FROM public.aliases old_alias
    USING public.aliases keep_alias
    WHERE old_alias.canonical_product_id = duplicate_id
      AND keep_alias.canonical_product_id = keep_id
      AND old_alias.alias = keep_alias.alias;
    UPDATE public.aliases SET canonical_product_id = keep_id WHERE canonical_product_id = duplicate_id;
    DELETE FROM public.products WHERE id = duplicate_id;
  END IF;

  INSERT INTO public.aliases(alias, alias_type, canonical_product_id)
  VALUES
    ('มิ้นต์เย็น', 'scent_alias', keep_id),
    ('Black Ice Mint', 'scent_alias', keep_id),
    ('แบล็คไอซ์มิ้นท์', 'scent_alias', keep_id),
    ('ซีโร่ดีกรีมิ้นท์', 'scent_alias', keep_id),
    ('Zero Degree Mint', 'scent_alias', keep_id),
    ('zero mint', 'scent_alias', keep_id),
    ('ซีโร่ดีกรี', 'scent_alias', keep_id),
    ('零度薄荷', 'scent_alias', keep_id),
    ('黑冰薄荷', 'scent_alias', keep_id)
  ON CONFLICT (alias, canonical_product_id) DO NOTHING;
END $$;

COMMIT;
