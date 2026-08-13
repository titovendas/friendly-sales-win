import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  listCustomers,
  listSellers,
  getOrder,
  upsertOrder,
} from "@/lib/sales.functions";
import { OrderForm, type FormItem } from "@/components/orders/order-form";
import type { PriceTable } from "@/lib/price-tables";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pedidos_/$id/editar")({
  component: EditOrderPage,
  head: ({ params }) => ({
    meta: [
      { title: `Editar Pedido #${params.id.slice(0, 8)} | UZZY Ferramentas` },
      { name: "description", content: "Edite o pedido de venda UZZY." },
      { property: "og:title", content: "Editar Pedido | UZZY Ferramentas" },
      { property: "og:description", content: "Edite o pedido de venda UZZY." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function EditOrderPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: orderData, isLoading: orderLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder({ data: { id } }),
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => listCustomers(),
  });
  const { data: sellers = [] } = useQuery({
    queryKey: ["sellers"],
    queryFn: () => listSellers(),
  });

  const [customerId, setCustomerId] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [status, setStatus] = useState("pending");
  const [priceTable, setPriceTable] = useState<PriceTable>("varejo_10");
  const [items, setItems] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderData) return;
    const order: any = orderData.order;
    setCustomerId(order.customer_id || "");
    setSellerId(order.seller_id || "");
    setStatus(order.status || "pending");
    setPriceTable((order.price_table as PriceTable) || "varejo_10");
    setItems(
      orderData.items.map((item: any) => ({
        catalog_product_id: item.catalog_product_id,
        code: item.code ?? "",
        description: item.description ?? "",
        image_url: item.image_url ?? null,
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        ipi_percent: Number(item.ipi_percent ?? 0),
        st_percent: Number(item.st_percent ?? 0),
        prices: {
          atacado: Number(item.unit_price),
          varejo_10: Number(item.unit_price),
          varejo_75: Number(item.unit_price),
        },
      }))
    );
  }, [orderData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !sellerId) {
      toast.error("Selecione o cliente e o vendedor");
      return;
    }
    if (items.length === 0) {
      toast.error("Adicione pelo menos um produto ao pedido");
      return;
    }
    setLoading(true);
    try {
      await upsertOrder({
        data: {
          id,
          customer_id: customerId,
          seller_id: sellerId,
          status: status as any,
          price_table: priceTable,
          items: items.map(({ prices, ...item }) => item),
        },
      });
      toast.success("Pedido atualizado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      navigate({ to: "/pedidos/$id", params: { id } });
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar pedido");
    } finally {
      setLoading(false);
    }
  };

  if (orderLoading || !orderData) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Editar pedido</h1>
        <p className="text-muted-foreground">Atualize os dados do pedido.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <OrderForm
          customers={customers}
          sellers={sellers}
          customerId={customerId}
          setCustomerId={setCustomerId}
          sellerId={sellerId}
          setSellerId={setSellerId}
          status={status}
          setStatus={setStatus}
          priceTable={priceTable}
          setPriceTable={setPriceTable}
          items={items}
          setItems={setItems}
        />

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/pedidos" })}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : "Atualizar pedido"}
          </Button>
        </div>
      </form>
    </div>
  );
}
