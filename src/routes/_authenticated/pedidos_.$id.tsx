import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Package, User, FileDown, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getOrder } from "@/lib/sales.functions";
import { getOrderForDisplay } from "@/lib/offline-queue";
import {
  formatCurrency,
  formatDate,
  statusLabel,
  statusVariant,
} from "@/lib/sales-formatters";
import { priceTableLabel } from "@/lib/price-tables";
import { generateOrderPdf } from "@/lib/order-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pedidos_/$id")({
  component: OrderDetailPage,
  head: ({ params }) => ({
    meta: [
      { title: `Pedido #${params.id.slice(0, 8)} | Força de Vendas` },
      { name: "description", content: "Detalhes do pedido." },
    ],
  }),
});

function OrderDetailPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const local = await getOrderForDisplay(id);
      if (local) return local;
      return getOrder({ data: { id } });
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const { order, items } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link to="/pedidos">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Pedido #{id.slice(0, 8)}
              {(order as any).__pending && (
                <span className="ml-3 align-middle rounded bg-amber-100 px-2 py-1 text-xs font-normal text-amber-700">
                  aguardando sincronização
                </span>
              )}
            </h1>
            <p className="text-muted-foreground">
              Criado em {formatDate(order.created_at)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await generateOrderPdf(order, items);
              } catch (err: any) {
                toast.error(err?.message || "Erro ao gerar o PDF");
              }
            }}
          >
            <FileDown className="mr-2 h-4 w-4" /> Baixar PDF
          </Button>
          <Button asChild>
            <Link to="/pedidos/$id/editar" params={{ id }}>
              Editar pedido
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {order.customer_name || "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={statusVariant(order.status!)} className="text-base">
              {statusLabel(order.status!)}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Tabela de preço</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {priceTableLabel((order as any).price_table)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Itens do pedido</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Foto</TableHead>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Unitário</TableHead>
                <TableHead className="text-right">IPI</TableHead>
                <TableHead className="text-right">ST</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.description ?? "Produto"}
                        className="h-10 w-10 rounded border object-contain"
                        loading="lazy"
                      />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {item.code || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.description || "—"}
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.unit_price)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.ipi_value)}
                    <span className="block text-xs text-muted-foreground">
                      {item.ipi_percent}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.st_value)}
                    <span className="block text-xs text-muted-foreground">
                      {item.st_percent}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IPI</span>
                <span>{formatCurrency(order.ipi_total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ST</span>
                <span>{formatCurrency(order.st_total)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
