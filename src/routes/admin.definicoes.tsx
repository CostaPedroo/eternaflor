import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, ImagePlus, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { FallbackImage } from "@/components/site/FallbackImage";
import { prepareSiteImage } from "@/lib/site-image";
import { saveSiteImage, siteSettingsQuery, type SiteImageField } from "@/lib/site-settings";
import hero from "@/assets/bouquet-lirios-rose.webp.asset.json";
import hands from "@/assets/hands.jpg";

export const Route = createFileRoute("/admin/definicoes")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data, isPending, isError, refetch } = useQuery(siteSettingsQuery);
  const canEdit = !!data && !isPending && !isError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Definições</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolhe as fotografias da homepage e guarda para atualizar o site.
        </p>
      </div>
      {isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          A carregar as fotografias atuais…
        </p>
      )}
      {(isError || (!isPending && !data)) && (
        <div role="alert" className="space-y-3 border border-border bg-background p-4">
          <p className="text-sm text-destructive">
            Não foi possível carregar as definições da homepage.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="h-11 border border-border px-4 text-sm"
          >
            Tentar novamente
          </button>
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <ImageSetting
          field="hero_image_url"
          title="Imagem principal da homepage"
          currentUrl={data?.hero_image_url}
          fallbackSrc={hero.url}
          canEdit={canEdit}
        />
        <ImageSetting
          field="custom_bouquet_image_url"
          title="Imagem dos personalizados"
          currentUrl={data?.custom_bouquet_image_url}
          fallbackSrc={hands}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}

type ImageSettingProps = {
  field: SiteImageField;
  title: string;
  currentUrl: string | null | undefined;
  fallbackSrc: string;
  canEdit: boolean;
};

function ImageSetting({ field, title, currentUrl, fallbackSrc, canEdit }: ImageSettingProps) {
  const qc = useQueryClient();
  const photoInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const selection = useRef(0);
  const [pending, setPending] = useState<{ image: Blob; preview: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = processing || saving;
  const buttonClass =
    "inline-flex min-h-12 items-center justify-center gap-2 border border-border px-4 text-sm disabled:opacity-50";

  useEffect(
    () => () => {
      selection.current++;
    },
    [],
  );
  useEffect(
    () => () => {
      if (pending) URL.revokeObjectURL(pending.preview);
    },
    [pending],
  );

  const choosePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const request = ++selection.current;
    setProcessing(true);
    try {
      const image = await prepareSiteImage(file);
      if (request !== selection.current) return;
      setPending({ image, preview: URL.createObjectURL(image) });
    } catch (error) {
      if (request === selection.current)
        toast.error(
          error instanceof Error ? error.message : "Não foi possível preparar a fotografia.",
        );
    } finally {
      if (request === selection.current) setProcessing(false);
    }
  };

  const save = async () => {
    if (!pending || busy || !canEdit) return;
    setSaving(true);
    try {
      const url = await saveSiteImage(field, pending.image);
      qc.setQueryData(siteSettingsQuery.queryKey, (settings) =>
        settings ? { ...settings, [field]: url } : settings,
      );
      setPending(null);
      toast.success("Imagem atualizada com sucesso.");
      void qc.invalidateQueries({ queryKey: siteSettingsQuery.queryKey });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível guardar a fotografia. Tenta novamente.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-labelledby={`${field}-title`}
      className="space-y-4 border border-border bg-background p-4 sm:p-6"
    >
      <h2 id={`${field}-title`} className="text-lg font-medium">
        {title}
      </h2>
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        <FallbackImage
          src={pending?.preview ?? currentUrl}
          fallbackSrc={fallbackSrc}
          alt={title}
          className="h-full w-full object-cover"
        />
      </div>
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        aria-label={`Escolher fotografia: ${title}`}
        className="hidden"
        disabled={!canEdit || busy}
        onChange={choosePhoto}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label={`Tirar fotografia: ${title}`}
        className="hidden"
        disabled={!canEdit || busy}
        onChange={choosePhoto}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => photoInput.current?.click()}
          disabled={!canEdit || busy}
          className={buttonClass}
        >
          <ImagePlus className="h-4 w-4" /> Alterar fotografia
        </button>
        <button
          type="button"
          onClick={() => cameraInput.current?.click()}
          disabled={!canEdit || busy}
          className={buttonClass}
        >
          <Camera className="h-4 w-4" /> Tirar fotografia
        </button>
      </div>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {processing
          ? "A preparar a fotografia…"
          : pending
            ? "Nova fotografia selecionada. Guarda para atualizar a homepage."
            : "A fotografia será otimizada antes de ser enviada."}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!canEdit || !pending || busy}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "A guardar…" : "Guardar"}
        </button>
        {pending && (
          <button
            type="button"
            onClick={() => setPending(null)}
            disabled={busy}
            className={buttonClass}
          >
            Cancelar
          </button>
        )}
      </div>
    </section>
  );
}
