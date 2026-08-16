import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { upsertOrder } from "@/lib/sales.functions";
import { listCustomersMerged, queueOrder } from "@/lib/offline-queue";
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
    queryFn: () => listCustomersMerged(),
  });

  const [customerId, setCustomerId] = useState("");
  const [priceTable, setPriceTable] = useState<PriceTable>("varejo_10");
  const [paymentTerm, setPaymentTerm] = useState("");
  const [items, setItems] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(false);

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
    const orderPayload = {
      customer_id: customerId,
      status: "orcamento" as any,
      price_table: priceTable,
      payment_term: paymentTerm,
      items: items.map(({ prices, ...item }) => item),
    };
    const isOnline = typeof navigator === "undefined" || navigator.onLine;

    try {
      if (isOnline) {
        try {
          const result = await upsertOrder({ data: orderPayload });
          toast.success("Pedido criado com sucesso");
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          navigate({ to: "/pedidos/$id", params: { id: result.id! } });
          return;
        } catch (err: any) {
          // Sem conexão com o servidor mesmo online (ex: instabilidade) —
          // guarda localmente e segue.
        }
      }

      const customerSnapshot =
        customers.find((c: any) => c.id === customerId) ?? null;
      const record = await queueOrder(orderPayload, customerSnapshot);
      toast.success(
        isOnline
          ? "Sem conexão com o servidor — pedido salvo no aparelho e será enviado automaticamente."
          : "Você está offline — pedido salvo no aparelho e será enviado quando a internet voltar."
      );
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      navigate({ to: "/pedidos/$id", params: { id: record.localId } });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar pedido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Novo orçamento</h1>
        <p className="text-muted-foreground">
          Selecione a tabela de preço e monte o orçamento pelo catálogo.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <OrderForm
          customers={customers}
          customerId={customerId}
          setCustomerId={setCustomerId}
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
            {loading ? "Salvando..." : "Salvar orçamento"}
          </Button>
        </div>
      </form>
    </div>
  );
}
