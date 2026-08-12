CREATE TABLE public.catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  ref text,
  description text NOT NULL,
  barcode text,
  ncm text,
  category text,
  image_url text,
  ipi_percent numeric NOT NULL DEFAULT 0,
  st_percent numeric NOT NULL DEFAULT 0,
  price_atacado numeric,
  price_varejo_10 numeric,
  price_varejo_75 numeric,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_products TO authenticated;
GRANT ALL ON public.catalog_products TO service_role;

ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read catalog" ON public.catalog_products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage catalog" ON public.catalog_products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER catalog_products_updated_at BEFORE UPDATE ON public.catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX catalog_products_code_idx ON public.catalog_products (code);
CREATE INDEX catalog_products_category_idx ON public.catalog_products (category);

ALTER TABLE public.customers
  ADD COLUMN price_table text NOT NULL DEFAULT 'varejo_10';

ALTER TABLE public.orders
  ADD COLUMN price_table text NOT NULL DEFAULT 'varejo_10',
  ADD COLUMN subtotal numeric NOT NULL DEFAULT 0,
  ADD COLUMN ipi_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN st_total numeric NOT NULL DEFAULT 0;

ALTER TABLE public.order_items
  ADD COLUMN catalog_product_id uuid REFERENCES public.catalog_products(id),
  ADD COLUMN code text,
  ADD COLUMN description text,
  ADD COLUMN image_url text,
  ADD COLUMN ipi_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN st_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN ipi_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN st_value numeric NOT NULL DEFAULT 0;

ALTER TABLE public.order_items ALTER COLUMN product_id DROP NOT NULL;