import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listCustomers,
  upsertCustomer,
  deleteCustomer,
  lookupCnpj,
} from "@/lib/sales.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: CustomersPage,
  head: () => ({
    meta: [
      { title: "Clientes | Força de Vendas" },
      { name: "description", content: "Gerencie seus clientes." },
    ],
  }),
});

const emptyCustomer = {
  id: "",
  name: "",
  email: "",
  phone: "",
  document: "",
  address: "",
  city: "",
  state: "",
};

function formatCnpj(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function CustomersPage() {
  const queryClient = useQueryClient();
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: () => listCustomers(),
  });

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyCustomer);
  const [cnpjInput, setCnpjInput] = useState("");
  const [found, setFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchingCnpj, setSearchingCnpj] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = customers.filter(
    (c: any) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.document || "").includes(search.replace(/\D/g, ""))
  );

  const openNew = () => {
    setForm(emptyCustomer);
    setCnpjInput("");
    setFound(false);
    setDialogOpen(true);
  };

  const openEdit = (customer: any) => {
    setForm({
      id: customer.id,
      name: customer.name ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      document: customer.document ?? "",
      address: customer.address ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
    });
    setCnpjInput(customer.document ?? "");
    setFound(true);
    setDialogOpen(true);
  };

  const handleSearchCnpj = async () => {
    const digits = cnpjInput.replace(/\D/g, "");
    if (digits.length !== 14) {
      toast.error("Digite um CNPJ válido (14 números)");
      return;
    }
    setSearchingCnpj(true);
    try {
      const result = await lookupCnpj({ data: { cnpj: digits } });
      setForm({
        id: form.id,
        name: result.name,
        email: result.email,
        phone: result.phone,
        document: result.document,
        address: result.address,
        city: result.city,
        state: result.state,
      });
      setFound(true);
      toast.success("Dados do CNPJ carregados");
    } catch (err: any) {
      toast.error(err.message || "Erro ao buscar CNPJ");
    } finally {
      setSearchingCnpj(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await upsertCustomer({ data: form });
      toast.success(form.id ? "Cliente atualizado" : "Cliente criado");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar cliente");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setLoading(true);
    try {
      await deleteCustomer({ data: { id: deleteId } });
      toast.success("Cliente removido");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            Cadastre e gerencie seus clientes.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> Novo cliente
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou CNPJ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-32 text-center text-muted-foreground"
                >
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-32 text-center text-muted-foreground"
                >
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((customer: any) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>
                    {customer.document ? formatCnpj(customer.document) : "—"}
                  </TableCell>
                  <TableCell>{customer.phone || "—"}</TableCell>
                  <TableCell>
                    {[customer.city, customer.state]
                      .filter(Boolean)
                      .join("/") || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(customer)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(customer.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Editar cliente" : "Novo cliente"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <div className="flex gap-2">
              <Input
                id="cnpj"
                placeholder="00.000.000/0000-00"
                value={formatCnpj(cnpjInput)}
                onChange={(e) => {
                  setCnpjInput(e.target.value);
                  setFound(false);
                }}
                maxLength={18}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleSearchCnpj}
                disabled={searchingCnpj}
              >
                {searchingCnpj ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Buscar"
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Digite o CNPJ e clique em Buscar para preencher os dados
              automaticamente. Você pode ajustar as informações antes de
              salvar.
            </p>
          </div>

          {(found || form.id) && (
            <form onSubmit={handleSubmit} className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome / Razão social *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) =>
                      setForm({ ...form, city: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="state">UF</Label>
                  <Input
                    id="state"
                    value={form.state}
                    onChange={(e) =>
                      setForm({ ...form, state: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover cliente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja remover este cliente? Esta ação não pode ser
            desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
