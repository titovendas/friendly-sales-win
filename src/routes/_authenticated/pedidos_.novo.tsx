import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { listCustomers, listSellers, upsertOrder } from "@/lib/sales.functions";
import { OrderForm, type FormItem } from "@/components/orders/order-form";
import type { PriceTable } from "@/lib/price-tables";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pedidos_/novo")({
  component: NewOrderPage,
  head: () => ({
    meta: [
      { title: "Novo Pedido | UZZY Ferramentas" },
      {
        name: "description",
        content:
          "Monte um pedido UZZY com catálogo, tabela de preço, IPI e ST calculados.",
      },
      { property: "og:title", content: "Novo Pedido | UZZY Ferramentas" },
      {
        property: "og:description",
        content: "Monte um pedido com catálogo e impostos calculados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function NewOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
      const result = await upsertOrder({
        data: {
          customer_id: customerId,
          seller_id: sellerId,
          status: status as any,
          price_table: priceTable,
          items: items.map(({ prices, ...item }) => item),
        },
      });
      toast.success("Pedido criado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      navigate({ to: "/pedidos/$id", params: { id: result.id! } });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar pedido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Novo pedido</h1>
        <p className="text-muted-foreground">
          Selecione a tabela de preço e monte o pedido pelo catálogo.
        </p>
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
            {loading ? "Salvando..." : "Salvar pedido"}
          </Button>
        </div>
      </form>
    </div>
  );
}
