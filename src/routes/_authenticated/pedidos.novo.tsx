import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listCustomers, listProducts, listSellers, upsertOrder } from "@/lib/sales.functions";
import { formatCurrency } from "@/lib/sales-formatters";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pedidos/novo")({
  component: NewOrderPage,
  head: () => ({
    meta: [
      { title: "Novo Pedido | Força de Vendas" },
      { name: "description", content: "Crie um novo pedido de venda." },
    ],
  }),
});

type OrderItem = {
  product_id: string;
  quantity: number;
  unit_price: number;
};

function NewOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: customers } = useSuspenseQuery({
    queryKey: ["customers"],
    queryFn: () => listCustomers(),
  });
  const { data: products } = useSuspenseQuery({
    queryKey: ["products"],
    queryFn: () => listProducts(),
  });
  const { data: sellers } = useSuspenseQuery({
    queryKey: ["sellers"],
    queryFn: () => listSellers(),
  });

  const [customerId, setCustomerId] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState<OrderItem[]>([
    { product_id: "", quantity: 1, unit_price: 0 },
  ]);
  const [loading, setLoading] = useState(false);

  const activeProducts = products.filter((p) => p.active);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
    [items]
  );

  const updateItem = (
    index: number,
    updates: { product_id?: string; quantity?: number; unit_price?: number }
  ) => {
    setItems((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      if (updates.product_id !== undefined) {
        current.product_id = updates.product_id;
        const product = products.find((p) => p.id === updates.product_id);
        if (product) {
          current.unit_price = product.price;
        }
      }
      if (updates.quantity !== undefined) {
        current.quantity = updates.quantity;
      }
      if (updates.unit_price !== undefined) {
        current.unit_price = updates.unit_price;
      }
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [...prev, { product_id: "", quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !sellerId) {
      toast.error("Selecione o cliente e o vendedor");
      return;
    }
    const validItems = items.filter((i) => i.product_id && i.quantity > 0);
    if (validItems.length === 0) {
      toast.error("Adicione pelo menos um item ao pedido");
      return;
    }
    setLoading(true);
    try {
      const result = await upsertOrder({
        data: {
          customer_id: customerId,
          seller_id: sellerId,
          status: status as any,
          items: validItems,
        },
      });
      toast.success("Pedido criado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      navigate({ to: "/pedidos/$id", params: { id: result.id } });
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
        <p className="text-muted-foreground">Monte um pedido de venda.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 rounded-md border p-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="customer">Cliente *</Label>
            <Select value={customerId} onValueChange={setCustomerId} required>
              <SelectTrigger id="customer">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id!}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="seller">Vendedor *</Label>
            <Select value={sellerId} onValueChange={setSellerId} required>
              <SelectTrigger id="seller">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {sellers.map((s) => (
                  <SelectItem key={s.id} value={s.id!}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="shipped">Enviado</SelectItem>
                <SelectItem value="delivered">Entregue</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Itens do pedido</h2>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar item
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="w-28">Qtd</TableHead>
                <TableHead className="w-36">Preço unitário</TableHead>
                <TableHead className="w-36 text-right">Subtotal</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Select
                      value={item.product_id}
                      onValueChange={(value) =>
                        updateItem(index, { product_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeProducts.map((p) => (
                          <SelectItem key={p.id} value={p.id!}>
                            {p.name} — {formatCurrency(p.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, {
                          quantity: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) =>
                        updateItem(index, {
                          unit_price: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.quantity * item.unit_price)}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-end border-t pt-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total do pedido</p>
              <p className="text-2xl font-bold">{formatCurrency(total)}</p>
            </div>
          </div>
        </div>

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
