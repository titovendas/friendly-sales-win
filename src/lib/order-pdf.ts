import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/uzzy-logo.png";
import { formatCurrency, formatDate, statusLabel } from "@/lib/sales-formatters";
import { priceTableLabel } from "@/lib/price-tables";

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateOrderPdf(order: any, items: any[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const logoData = await toDataUrl(logo);
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", 40, 28, 110, 34);
    } catch {
      /* ignore */
    }
  }

  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text("Cópia do pedido", pageWidth - 40, 44, { align: "right" });
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Nº ${String(order.id).slice(0, 8).toUpperCase()}`, pageWidth - 40, 60, {
    align: "right",
  });
  doc.text(formatDate(order.created_at), pageWidth - 40, 74, { align: "right" });

  doc.setDrawColor(200);
  doc.line(40, 88, pageWidth - 40, 88);

  doc.setTextColor(40);
  doc.setFontSize(10);
  const customer = order.customer ?? {};
  const left = [
    `Cliente: ${order.customer_name ?? "—"}`,
    `Documento: ${customer.document ?? "—"}`,
    `Telefone: ${customer.phone ?? "—"}`,
    `Endereço: ${[customer.address, customer.city, customer.state].filter(Boolean).join(", ") || "—"}`,
  ];
  const right = [
    `Vendedor: ${order.seller_name ?? "—"}`,
    `Tabela: ${priceTableLabel(order.price_table)}`,
    `Status: ${statusLabel(order.status)}`,
  ];
  left.forEach((line, i) => doc.text(line, 40, 106 + i * 14));
  right.forEach((line, i) =>
    doc.text(line, pageWidth - 40, 106 + i * 14, { align: "right" })
  );

  const images = await Promise.all(
    items.map((item) => (item.image_url ? toDataUrl(item.image_url) : null))
  );

  autoTable(doc, {
    startY: 175,
    head: [
      ["Foto", "Código", "Descrição", "Qtd", "Unit.", "IPI", "ST", "Total"],
    ],
    body: items.map((item) => [
      "",
      item.code ?? "—",
      item.description ?? "—",
      String(item.quantity),
      formatCurrency(item.unit_price),
      `${formatCurrency(item.ipi_value)} (${item.ipi_percent}%)`,
      `${formatCurrency(item.st_value)} (${item.st_percent}%)`,
      formatCurrency(item.total),
    ]),
    styles: { fontSize: 8, cellPadding: 4, valign: "middle" },
    headStyles: { fillColor: [200, 30, 35], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 38, minCellHeight: 38 },
      1: { cellWidth: 48 },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 52, halign: "right" },
      5: { cellWidth: 62, halign: "right" },
      6: { cellWidth: 62, halign: "right" },
      7: { cellWidth: 58, halign: "right" },
    },
    didDrawCell: (data: any) => {
      if (data.section === "body" && data.column.index === 0) {
        const img = images[data.row.index];
        if (img) {
          try {
            doc.addImage(img, "JPEG", data.cell.x + 3, data.cell.y + 3, 32, 32);
          } catch {
            /* ignore */
          }
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 20;
  const rows: [string, number][] = [
    ["Subtotal", Number(order.subtotal ?? 0)],
    ["IPI", Number(order.ipi_total ?? 0)],
    ["ST", Number(order.st_total ?? 0)],
  ];
  doc.setFontSize(10);
  rows.forEach(([label, value], i) => {
    doc.text(label, pageWidth - 160, finalY + i * 15);
    doc.text(formatCurrency(value), pageWidth - 40, finalY + i * 15, {
      align: "right",
    });
  });
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Total", pageWidth - 160, finalY + 55);
  doc.text(formatCurrency(Number(order.total ?? 0)), pageWidth - 40, finalY + 55, {
    align: "right",
  });

  doc.save(`pedido-${String(order.id).slice(0, 8)}.pdf`);
}
