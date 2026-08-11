CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP VIEW IF EXISTS public.order_summary;

CREATE OR REPLACE VIEW public.order_summary
WITH (security_invoker = true)
AS
SELECT
  o.*,
  c.name AS customer_name,
  s.name AS seller_name,
  COALESCE(SUM(oi.total), 0) AS calculated_total
FROM public.orders o
LEFT JOIN public.customers c ON c.id = o.customer_id
LEFT JOIN public.sellers s ON s.id = o.seller_id
LEFT JOIN public.order_items oi ON oi.order_id = o.id
GROUP BY o.id, c.name, s.name;

GRANT SELECT ON public.order_summary TO authenticated;
GRANT SELECT ON public.order_summary TO service_role;