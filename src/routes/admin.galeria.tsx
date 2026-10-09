import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  adminGalleryQuery,
  deleteGalleryImage,
  prepareGalleryImage,
  reorderGalleryImages,
  setGalleryVisibility,
  uploadGalleryImage,
  type GalleryRow,
  type PreparedGalleryImage,
} from "@/lib/gallery-admin";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/galeria")({ component: AdminGalleryPage });
type PendingPhoto = PreparedGalleryImage & { id: string; preview: string };

function AdminGalleryPage() {
  const qc = useQueryClient();
  const { data, isPending, isError, error, refetch } = useQuery(adminGalleryQuery);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const pendingRef = useRef<PendingPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const alive = useRef(true);
  const [progress, setProgress] = useState("");
  const [toDelete, setToDelete] = useState<GalleryRow | null>(null);
  const photosInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const canEdit = !!data && !isPending && !isError;
  const buttonClass =
    "inline-flex min-h-11 items-center justify-center gap-2 border border-border px-3 text-sm disabled:opacity-40";

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      pendingRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview));
    };
  }, []);
  const updatePending = (next: PendingPhoto[]) => {
    pendingRef.current = next;
    if (alive.current) setPending(next);
  };
  const discard = (id: string) => {
    const photo = pendingRef.current.find((item) => item.id === id);
    if (photo) URL.revokeObjectURL(photo.preview);
    updatePending(pendingRef.current.filter((item) => item.id !== id));
  };
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: adminGalleryQuery.queryKey }),
      qc.invalidateQueries({ queryKey: ["public-gallery"] }),
    ]);
  };
  const setWorking = (working: boolean) => {
    busyRef.current = working;
    if (alive.current) setBusy(working);
  };

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length || busyRef.current || !canEdit) return;
    setWorking(true);
    let failed = 0;
    for (const [index, file] of files.entries()) {
      if (!alive.current) break;
      setProgress(`A preparar fotografia ${index + 1} de ${files.length}…`);
      try {
        const prepared = await prepareGalleryImage(file);
        if (!alive.current) break;
        updatePending([
          ...pendingRef.current,
          { ...prepared, id: crypto.randomUUID(), preview: URL.createObjectURL(prepared.image) },
        ]);
      } catch (error) {
        failed++;
        if (alive.current)
          toast.error(
            error instanceof Error ? error.message : "Não foi possível preparar a fotografia.",
          );
      }
    }
    if (alive.current)
      setProgress(
        failed
          ? `${failed} fotografia(s) não foram preparadas. As restantes estão prontas para guardar.`
          : "Fotografias preparadas. Guarda para as publicar na galeria.",
      );
    setWorking(false);
  };

  const save = async () => {
    if (!canEdit || busyRef.current || !pendingRef.current.length) return;
    setWorking(true);
    const batch = [...pendingRef.current];
    let order = Math.max(-1, ...(data ?? []).map((photo) => photo.sort_order)) + 1;
    let saved = 0;
    try {
      for (const photo of batch) {
        if (alive.current) setProgress(`A guardar fotografia ${saved + 1} de ${batch.length}…`);
        const row = await uploadGalleryImage(photo, order++);
        qc.setQueryData(adminGalleryQuery.queryKey, (rows) => [...(rows ?? []), row]);
        discard(photo.id);
        saved++;
      }
      toast.success("Fotografias adicionadas à galeria.");
    } catch (error) {
      toast.error(
        `${saved ? `${saved} fotografia(s) guardadas. ` : ""}${error instanceof Error ? error.message : "Não foi possível guardar as fotografias."} As fotografias por guardar continuam selecionadas.`,
      );
    } finally {
      await refresh();
      if (alive.current)
        setProgress(
          pendingRef.current.length
            ? "As fotografias restantes estão prontas para tentar novamente."
            : "",
        );
      setWorking(false);
    }
  };
  const run = async (operation: () => Promise<void>) => {
    if (busyRef.current || !canEdit) return;
    setWorking(true);
    try {
      await operation();
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a galeria.");
    } finally {
      setWorking(false);
    }
  };
  const move = (index: number, direction: number) =>
    run(async () => {
      const next = [...(data ?? [])];
      if (!next[index] || !next[index + direction]) return;
      [next[index], next[index + direction]] = [next[index + direction]!, next[index]!];
      await reorderGalleryImages(next.map((photo) => photo.id));
      qc.setQueryData(
        adminGalleryQuery.queryKey,
        next.map((photo, position) => ({ ...photo, sort_order: position })),
      );
      toast.success("Ordem atualizada.");
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Galeria</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Fotografias de encomendas personalizadas. Adiciona, organiza e escolhe quais mostrar no
          site.
        </p>
      </div>
      {isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          A carregar a galeria…
        </p>
      )}
      {isError && (
        <div role="alert" className="space-y-3 border border-border bg-background p-4">
          <p className="text-sm text-destructive">{error.message}</p>
          <button type="button" onClick={() => refetch()} className={buttonClass}>
            Tentar novamente
          </button>
        </div>
      )}
      <section
        aria-label="Adicionar fotografias"
        className="space-y-4 border border-border bg-background p-4 sm:p-6"
      >
        <input
          ref={photosInput}
          type="file"
          accept="image/*"
          multiple
          aria-label="Escolher fotografias para a galeria"
          className="hidden"
          onChange={choose}
          disabled={!canEdit || busy}
        />
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Tirar fotografia para a galeria"
          className="hidden"
          onChange={choose}
          disabled={!canEdit || busy}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => photosInput.current?.click()}
            disabled={!canEdit || busy}
            className={buttonClass}
          >
            <ImagePlus className="h-4 w-4" />
            Adicionar fotografias
          </button>
          <button
            type="button"
            onClick={() => cameraInput.current?.click()}
            disabled={!canEdit || busy}
            className={buttonClass}
          >
            <Camera className="h-4 w-4" />
            Tirar fotografia
          </button>
        </div>
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {progress || "As fotografias são reduzidas e convertidas para WebP antes do envio."}
        </p>
        {!!pending.length && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {pending.map((photo, index) => (
                <div key={photo.id} className="relative aspect-[4/5] bg-muted">
                  <img
                    src={photo.preview}
                    width={photo.width}
                    height={photo.height}
                    alt={`Nova fotografia ${index + 1}`}
                    className="h-full w-full object-contain"
                  />
                  <button
                    type="button"
                    aria-label={`Remover nova fotografia ${index + 1}`}
                    disabled={busy}
                    onClick={() => discard(photo.id)}
                    className="absolute right-1 top-1 grid h-11 w-11 place-items-center border border-border bg-background/95 disabled:opacity-40"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={save}
              disabled={busy || !canEdit}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50 sm:w-auto"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}Guardar fotografias (
              {pending.length})
            </button>
          </>
        )}
      </section>
      {data?.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Ainda não há fotografias na galeria.
        </p>
      )}
      <ul className="grid grid-cols-1 gap-4 min-[375px]:grid-cols-2 lg:grid-cols-3">
        {data?.map((photo, index) => (
          <li key={photo.id} className="min-w-0 space-y-3 border border-border bg-background p-3">
            <div className="aspect-[4/5] overflow-hidden bg-muted">
              <img
                src={photo.image_url}
                width={photo.width}
                height={photo.height}
                alt={`Fotografia ${index + 1} da galeria`}
                loading="lazy"
                className="h-full w-full object-contain"
                onError={(event) => {
                  event.currentTarget.style.visibility = "hidden";
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span>Fotografia {index + 1}</span>
              <span className="text-xs text-muted-foreground">
                {photo.is_active ? "Visível" : "Oculta"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                aria-label={`Subir fotografia ${index + 1}`}
                disabled={busy || index === 0}
                onClick={() => move(index, -1)}
                className={`${buttonClass} px-0`}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Descer fotografia ${index + 1}`}
                disabled={busy || index === data.length - 1}
                onClick={() => move(index, 1)}
                className={`${buttonClass} px-0`}
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`${photo.is_active ? "Ocultar" : "Mostrar"} fotografia ${index + 1}`}
                aria-pressed={photo.is_active}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await setGalleryVisibility(photo.id, !photo.is_active);
                    toast.success(photo.is_active ? "Fotografia ocultada." : "Fotografia visível.");
                  })
                }
                className={`${buttonClass} px-0`}
              >
                {photo.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button
                type="button"
                aria-label={`Eliminar fotografia ${index + 1}`}
                disabled={busy}
                onClick={() => setToDelete(photo)}
                className={`${buttonClass} px-0 text-destructive`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <AlertDialog
        open={!!toDelete}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar fotografia?</AlertDialogTitle>
            <AlertDialogDescription>
              A fotografia será removida da galeria e do armazenamento. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-destructive-foreground"
              onClick={() => {
                const photo = toDelete;
                setToDelete(null);
                if (photo)
                  void run(async () => {
                    const result = await deleteGalleryImage(photo);
                    toast.success("Fotografia eliminada.");
                    if (result.storageCleanupFailed)
                      toast.error(
                        "A fotografia saiu da galeria, mas não foi possível remover o ficheiro do armazenamento.",
                      );
                  });
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
