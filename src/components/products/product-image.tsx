
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ProductImageProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
};

/** Miniatura de produto clicável: ao tocar, abre a imagem ampliada em um
 * pop-up, útil para o vendedor confirmar o produto com o cliente na hora
 * da venda. */
export function ProductImage({ src, alt, className }: ProductImageProps) {
  const [open, setOpen] = useState(false);

  if (!src) {
    return (
      <div className={cn("rounded border bg-muted", className)} />
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "cursor-zoom-in overflow-hidden rounded border transition-opacity hover:opacity-80",
          className
        )}
      >
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-base">{alt}</DialogTitle>
          <img
            src={src}
            alt={alt}
            className="mx-auto max-h-[70vh] w-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
