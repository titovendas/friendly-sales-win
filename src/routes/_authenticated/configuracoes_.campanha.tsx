import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  Upload,
  Trash2,
  FileSpreadsheet,
  ChevronDown,
  Flame,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ProductImage } from "@/components/products/product-image";
import { formatCurrency } from "@/lib/sales-formatters";
import {
  listCampaignItems,
  importCampaignItems,
  deleteCampaignItem,
} from "@/lib/sales.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/configuracoes_/campanha")({
  component: CampaignSettingsPage,
  head: () => ({
    meta: [
      { title: "Itens em Campanha | Força de Vendas" },
      {
        name: "description",
        content: "Importe a tabela de preços promocionais do mês.",
      },
    ],
  }),
});

type ParsedSheet = {
  headers: string[];
  rows: string[][];
};

function parseWorkbook(data: ArrayBuffer): ParsedSheet {
  const workbook = XLSX.read(data, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return { headers: [], rows: [] };
  const raw: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });
  if (raw.length === 0) return { headers: [], rows: [] };
  const headerRow = raw[0] ?? [];
  const headers = headerRow.map((h: any, i: number) =>
    h === "" || h === undefined ? `Coluna ${i + 1}` : String(h)
  );
  const rows = raw
    .slice(1)
    .map((r) => headers.map((_: string, i: number) => String(r?.[i] ?? "")));
  return { headers, rows };
}

function CampaignSettingsPage() {
  const queryClient = useQueryClient();
  const { data: campaignItems = [], isLoading } = useQuery({
    queryKey: ["campaign-items-admin"],
    queryFn: () => listCampaignItems(),
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [codeColumn, setCodeColumn] = useState("");
  const [priceColumn, setPriceColumn] = useState("");
  const [importing, setImporting] = useState(false);
  const [unmatchedCodes, setUnmatchedCodes] = useState<string[] | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const isOnline = typeof navigator === "undefined" || navigator.onLine;

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const result = parseWorkbook(buffer);
      if (result.headers.length === 0) {
        toast.error("Não consegui ler nenhuma linha nessa planilha.");
        return;
      }
      setFileName(file.name);
      setParsed(result);
      setCodeColumn("");
      setPriceColumn("");
      setImportOpen(true);
    } catch {
      toast.error("Não consegui abrir esse arquivo. Confira se é um .xlsx ou .xls válido.");
    } finally {
      e.target.value = "";
    }
  };

  const handleConfirmImport = async () => {
    if (!parsed || !codeColumn || !priceColumn) return;
    const codeIndex = parsed.headers.indexOf(codeColumn);
    const priceIndex = parsed.headers.indexOf(priceColumn);
    if (codeIndex === -1 || priceIndex === -1) return;

    const rows = parsed.rows
      .map((row) => ({
        code: row[codeIndex]?.trim() ?? "",
        price: parseFloat(
          (row[priceIndex] ?? "").replace(/[^\d,.-]/g, "").replace(",", ".")
        ),
      }))
      .filter((r) => r.code && !Number.isNaN(r.price));

    if (rows.length === 0) {
      toast.error("Não encontrei linhas válidas com código e preço.");
      return;
    }

    setImporting(true);
    try {
      const result = await importCampaignItems({ data: { rows } });
      toast.success(`${result.imported} item(ns) de campanha importado(s).`);
      setImportOpen(false);
      setParsed(null);
      setListOpen(true);
      if (result.unmatched.length > 0) {
        setUnmatchedCodes(result.unmatched);
      }
      queryClient.invalidateQueries({ queryKey: ["campaign-items-admin"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-items"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar a planilha.");
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteCampaignItem({ data: { id: deleteId } });
      toast.success("Item removido da campanha");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["campaign-items-admin"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-items"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/configuracoes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Flame className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Itens em campanha</h1>
          <p className="text-muted-foreground">
            Importe a tabela de preços promocionais do mês.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importar planilha</CardTitle>
          <CardDescription>
            Envie um Excel com código do produto e preço já em campanha. As
            demais informações (descrição, foto, IPI, ST) vêm automaticamente
            do catálogo, casando pelo código.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileSelected}
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isOnline}
          >
            <Upload className="mr-2 h-4 w-4" />
            Importar planilha Excel
          </Button>
          {!isOnline && (
            <p className="mt-2 text-xs text-amber-700">
              A importação precisa de internet — tente novamente quando
              estiver online.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <Collapsible open={listOpen} onOpenChange={setListOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <div>
                <p className="font-medium">
                  Itens em campanha
                  {!isLoading && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({campaignItems.length})
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {listOpen ? "Toque para recolher" : "Toque para ver a lista"}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                  listOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="overflow-x-auto border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Foto</TableHead>
                    <TableHead className="w-24">Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Preço campanha</TableHead>
                    <TableHead className="w-16 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : campaignItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                        Nenhum item em campanha ainda. Importe uma planilha
                        para começar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    campaignItems.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <ProductImage
                            src={item.product?.image_url}
                            alt={item.product?.description ?? item.code}
                            className="h-9 w-9"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.code}
                          {!item.catalog_product_id && (
                            <span
                              className="ml-1.5 inline-flex items-center gap-1 text-amber-600"
                              title="Código não encontrado no catálogo"
                            >
                              <AlertTriangle className="h-3 w-3" />
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.product?.description ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {formatCurrency(item.campaign_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(item.id)}
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
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Diálogo: escolher as colunas da planilha */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              {fileName}
            </DialogTitle>
          </DialogHeader>

          {parsed && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Qual coluna tem o código do produto?</Label>
                <Select value={codeColumn} onValueChange={setCodeColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {parsed.headers.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Qual coluna tem o preço de campanha?</Label>
                <Select value={priceColumn} onValueChange={setPriceColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {parsed.headers.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {codeColumn && priceColumn && (
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Prévia:
                  </p>
                  <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
                    {parsed.rows.slice(0, 6).map((row, i) => (
                      <li key={i}>
                        •{" "}
                        {row[parsed.headers.indexOf(codeColumn)] || "—"}{" "}
                        —{" "}
                        {row[parsed.headers.indexOf(priceColumn)] || "—"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={!codeColumn || !priceColumn || importing}
            >
              {importing ? "Importando..." : "Confirmar importação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aviso de códigos não encontrados no catálogo */}
      <Dialog open={!!unmatchedCodes} onOpenChange={() => setUnmatchedCodes(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Alguns códigos não foram encontrados
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esses códigos foram salvos, mas não bateram com nenhum produto do
            catálogo — confira se estão digitados certinho ou se o produto
            ainda não foi cadastrado:
          </p>
          <ul className="max-h-40 overflow-y-auto rounded-md border bg-muted/40 p-3 text-sm">
            {unmatchedCodes?.map((code) => (
              <li key={code}>• {code}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button onClick={() => setUnmatchedCodes(null)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover item da campanha</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O produto volta a usar o preço normal das tabelas de preço.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
