import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { listCatalog } from "@/lib/sales.functions";
import { formatCurrency } from "@/lib/sales-formatters";
import { PRICE_TABLES, catalogPrice, type PriceTable } from "@/lib/price-tables";
import { PAYMENT_TERMS } from "@/lib/sales.functions";

export type FormItem = {
  catalog_product_id: string;
  code: string;
  description: string;
  image_url: string | null;
  quantity: number;
  unit_price: number;
  ipi_percent: number;
  st_percent: number;
  prices: { atacado: number; varejo_10: number; varejo_75: number };
};

type Props = {
  customers: any[];
  customerId: string;
  setCustomerId: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  priceTable: PriceTable;
  setPriceTable: (v: PriceTable) => void;
  paymentTerm: string;
  setPaymentTerm: (v: string) => void;
  items: FormItem[];
  setItems: React.Dispatch<React.SetStateAction<FormItem[]>>;
};

export function OrderForm({
  customers,
  customerId,
  setCustomerId,
  status,
  setStatus,
  priceTable,
  setPriceTable,
  paymentTerm,
  setPaymentTerm,
  items,
  setItems,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: catalog = [], isLoading: catalogLoading } = useQuery({
    queryKey: ["catalog", search],
    queryFn: () => listCatalog({ data: { search } }),
    enabled: pickerOpen,
  });

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const ipi = items.reduce(
      (s, i) => s + (i.quantity * i.unit_price * i.ipi_percent) / 100,
      0
    );
    const st = items.reduce(
      (s, i) => s + (i.quantity * i.unit_price * i.st_percent) / 100,
      0
    );
    return { subtotal, ipi, st, total: subtotal + ipi + st };
  }, [items]);

  const onCustomerChange = (value: string) => {
    setCustomerId(value);
  };

  const changePriceTable = (table: PriceTable) => {
    setPriceTable(table);
    setItems((prev) =>
      prev.map((i) => ({
        ...i,
        unit_price: i.prices?.[table] ?? i.unit_price,
      }))
    );
  };

  const addProduct = (product: any) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.catalog_product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.catalog_product_id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [
        ...prev,
        {
          catalog_product_id: product.id,
          code: product.code,
          description: product.description,
          image_url: product.image_url ?? null,
          quantity: 1,
          unit_price: catalogPrice(product, priceTable),
          ipi_percent: Number(product.ipi_percent ?? 0),
          st_percent: Number(product.st_percent ?? 0),
          prices: {
            atacado: Number(product.price_atacado ?? 0),
            varejo_10: Number(product.price_varejo_10 ?? 0),
            varejo_75: Number(product.price_varejo_75 ?? 0),
          },
        },
      ];
    });
    setPickerOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-2">
          <Label>Cliente *</Label>
          <Select value={customerId} onValueChange={onCustomerChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Tabela de preço *</Label>
          <Select
            value={priceTable}
            onValueChange={(v) => changePriceTable(v as PriceTable)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICE_TABLES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Condição de pagamento</Label>
          <Select value={paymentTerm} onValueChange={setPaymentTerm}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_TERMS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
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
          <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar produto
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Foto</TableHead>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-20">Qtd</TableHead>
                <TableHead className="w-32">Unitário</TableHead>
                <TableHead className="w-28 text-right">IPI</TableHead>
                <TableHead className="w-28 text-right">ST</TableHead>
                <TableHead className="w-32 text-right">Total</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    Nenhum produto adicionado.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => {
                  const base = item.quantity * item.unit_price;
                  const ipi = (base * item.ipi_percent) / 100;
                  const st = (base * item.st_percent) / 100;
                  return (
                    <TableRow key={item.catalog_product_id}>
                      <TableCell>
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.description}
                            className="h-10 w-10 rounded border object-contain"
                            loading="lazy"
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.code}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-sm">
                        {item.description}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((i, idx) =>
                                idx === index
                                  ? { ...i, quantity: parseInt(e.target.value) || 1 }
                                  : i
                              )
                            )
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
                            setItems((prev) =>
                              prev.map((i, idx) =>
                                idx === index
                                  ? { ...i, unit_price: parseFloat(e.target.value) || 0 }
                                  : i
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(ipi)}
                        <span className="block text-xs text-muted-foreground">
                          {item.ipi_percent}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(st)}
                        <span className="block text-xs text-muted-foreground">
                          {item.st_percent}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(base + ipi + st)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setItems((prev) => prev.filter((_, i) => i !== index))
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end border-t pt-4">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IPI</span>
              <span>{formatCurrency(totals.ipi)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ST</span>
              <span>{formatCurrency(totals.st)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-lg font-bold">
              <span>Total</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Buscar produto no catálogo</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Código, referência, descrição ou código de barras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {catalogLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Carregando...
              </p>
            ) : catalog.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum produto encontrado.
              </p>
            ) : (
              catalog.map((p: any) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className="flex w-full items-center gap-3 rounded-md border p-2 text-left hover:bg-accent"
                >
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.description}
                      className="h-12 w-12 rounded border object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded border" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Cód. {p.code} · IPI {p.ipi_percent}% · ST {p.st_percent}%
                    </p>
                  </div>
                  <div className="text-right text-sm font-semibold">
                    {formatCurrency(catalogPrice(p, priceTable))}
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
