import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getOrder, upsertOrder } from "@/lib/sales.functions";
import {
  listCustomersMerged,
  getOrderForDisplay,
  queueOrderUpsert,
} from "@/lib/offline-queue";
import { OrderForm, type FormItem } from "@/components/orders/order-form";
import type { PriceTable } from "@/lib/price-tables";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pedidos_/$id_/editar")({
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
    queryFn: async () => {
      const local = await getOrderForDisplay(id);
      if (local) return local;
      return getOrder({ data: { id } });
    },
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => listCustomersMerged(),
  });
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("pending");
  const [priceTable, setPriceTable] = useState<PriceTable>("varejo_10");
  const [paymentTerm, setPaymentTerm] = useState("");
  const [items, setItems] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderData) return;
    const order: any = orderData.order;
    setCustomerId(order.customer_id || "");
    setStatus(order.status || "pending");
    setPriceTable((order.price_table as PriceTable) || "varejo_10");
    setPaymentTerm(order.payment_term || "");
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
    if (!customerId) {
      toast.error("Selecione o cliente");
      return;
    }
    if (items.length === 0) {
      toast.error("Adicione pelo menos um produto ao pedido");
      return;
    }
    setLoading(true);
    const isOnline = typeof navigator === "undefined" || navigator.onLine;
    const isPending = id.startsWith("local-order-");
    const orderPayload = {
      customer_id: customerId,
      status: status as any,
      price_table: priceTable,
      payment_term: paymentTerm,
      items: items.map(({ prices, ...item }) => item),
    };

    const saveLocally = async () => {
      const customerSnapshot =
        customers.find((c: any) => c.id === customerId) ?? null;
      await queueOrderUpsert(id, orderPayload, customerSnapshot);
    };

    try {
      if (isOnline && !isPending) {
        try {
          await upsertOrder({ data: { id, ...orderPayload } });
          toast.success("Pedido atualizado com sucesso");
        } catch (err: any) {
          await saveLocally();
          toast.success(
            "Sem conexão com o servidor — edição salva no aparelho e será enviada automaticamente."
          );
        }
      } else {
        await saveLocally();
        toast.success(
          isOnline
            ? "Pedido atualizado (ainda aguardando sincronização)"
            : "Você está offline — edição salva no aparelho e será enviada quando a internet voltar."
        );
      }
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
          customerId={customerId}
          setCustomerId={setCustomerId}
          status={status}
          setStatus={setStatus}
          priceTable={priceTable}
          setPriceTable={setPriceTable}
          paymentTerm={paymentTerm}
          setPaymentTerm={setPaymentTerm}
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
