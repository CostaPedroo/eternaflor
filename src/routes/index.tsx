import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { MessageCircle, Star, Instagram, Menu, X, Leaf, Hand, Palette, Camera } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import hero from "@/assets/hero.jpg";
import bFloral from "@/assets/bouquet-floral.jpg";
import bAzul from "@/assets/bouquet-azul.jpg";
import bRosa from "@/assets/bouquet-rosa.jpg";
import bTulipas from "@/assets/bouquet-tulipas.jpg";
import hands from "@/assets/hands.jpg";
import vase from "@/assets/vase.jpg";
import gift from "@/assets/gift.jpg";

const TITLE = "Eterna Flor | Bouquets e Flores Artesanais que Não Murcham";
const DESC =
  "Bouquets e flores artesanais feitos à mão em Portugal. Flores que não murcham, personalizáveis e perfeitas para oferecer.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { name: "keywords", content: "flores que não murcham, bouquet eterno, flores artesanais, flores feitas à mão, bouquet personalizado, presente personalizado, flores eternas, presentes personalizados Portugal" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_PT" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

// TODO: definir o número de WhatsApp (formato internacional, sem "+")
const WHATSAPP_NUMBER = "351000000000";
const wa = (msg: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
const INSTAGRAM = "https://instagram.com/eternaflor.pt";
const TIKTOK = "https://tiktok.com/@eternaflor.pt";

const products = [
  { name: "Bouquet Floral", price: 30, img: bFloral, desc: "Mistura alegre de girassóis, rosas e flores do campo." },
  { name: "Bouquet Azul", price: 25, img: bAzul, desc: "Tulipas azuis e margaridas, fresco e sereno." },
  { name: "Bouquet Rosa", price: 25, img: bRosa, desc: "Rosas em rosa-velho, o clássico romântico." },
  { name: "Bouquet Tulipas", price: 18, img: bTulipas, desc: "Tulipas creme e coral em papel kraft." },
];

const categories = [
  { name: "Bouquets", img: bRosa },
  { name: "Flores individuais", img: gift },
  { name: "Vasos", img: vase },
  { name: "Personalizados", img: hero },
  { name: "Presentes até 15€", img: bTulipas },
];

const occasions = [
  { name: "Aniversários", img: bFloral },
  { name: "Namorada / namorado", img: bRosa },
  { name: "Dia da Mãe", img: hero },
  { name: "Dia dos Namorados", img: gift },
  { name: "Professores", img: bTulipas },
  { name: "Casamentos", img: bAzul },
  { name: "Aniversários de namoro", img: bRosa },
  { name: "Agradecimentos", img: vase },
  { name: "Presentes espontâneos", img: bTulipas },
];

const faqs = [
  ["As flores são mesmo feitas à mão?", "Sim. Cada flor é moldada à mão, fio a fio, no nosso atelier em Portugal."],
  ["Posso escolher as cores?", "Claro. Diz-nos as cores que preferes e adaptamos o bouquet."],
  ["Posso pedir um bouquet totalmente personalizado?", "Sim — usa o formulário de bouquet personalizado e enviamos-te uma proposta pelo WhatsApp."],
  ["Quanto tempo demora uma encomenda?", "Normalmente entre 3 e 7 dias, conforme o tamanho e a época. Confirmamos o prazo ao encomendar."],
  ["Fazem envios para todo o país?", "Sim, enviamos para todo Portugal por CTT."],
  ["Como é feito o pagamento?", "Indicamos as opções de pagamento ao confirmar a encomenda pelo WhatsApp."],
  ["Posso levantar pessoalmente?", "Fazemos entrega em mão em Gondomar e Ermesinde. Combina connosco pelo WhatsApp."],
  ["Como devo conservar as flores?", "Mantém longe da humidade e do sol direto. Para limpar o pó, usa um secador em ar frio."],
];

const nav = [
  ["Início", "#inicio"],
  ["Catálogo", "#catalogo"],
  ["Personalizados", "#personalizados"],
  ["Como funciona", "#como-funciona"],
  ["Feedback", "#feedback"],
  ["FAQ", "#faq"],
];

const btnPrimary =
  "inline-flex h-13 items-center justify-center rounded-full bg-primary px-7 py-3.5 text-[15px] font-medium tracking-wide text-primary-foreground transition hover:opacity-90";
const btnOutline =
  "inline-flex h-13 items-center justify-center rounded-full border border-primary/30 px-7 py-3.5 text-[15px] font-medium tracking-wide text-primary transition hover:bg-primary/5";
const eyebrow = "text-xs font-medium uppercase tracking-[0.25em] text-sage";

function Index() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 lg:flex lg:justify-between">
          <a href="#inicio" className="truncate font-serif text-2xl italic">Eterna Flor</a>
          <nav className="hidden gap-7 text-sm lg:flex">
            {nav.map(([l, h]) => (
              <a key={h} href={h} className="text-muted-foreground transition hover:text-foreground">{l}</a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <a href="#catalogo" className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">Encomendar</a>
            <button aria-label="Menu" onClick={() => setOpen(!open)} className="grid h-11 w-11 place-items-center lg:hidden">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-border/60 px-5 pb-4 lg:hidden">
            {nav.map(([l, h]) => (
              <a key={h} href={h} onClick={() => setOpen(false)} className="block border-b border-border/40 py-4 font-serif text-2xl last:border-0">{l}</a>
            ))}
          </nav>
        )}
      </header>

      {/* Hero */}
      <section id="inicio" className="mx-auto grid max-w-6xl gap-8 px-5 pb-12 pt-6 md:grid-cols-2 md:items-center md:gap-14 md:py-20">
        <div className="relative overflow-hidden rounded-[2rem] md:order-2">
          <img src={hero} alt="Bouquet Eterna Flor feito à mão com flores que não murcham" width={1024} height={1280} className="aspect-[4/5] w-full object-cover" />
          <span className="absolute left-4 top-4 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium">A partir de 18€</span>
        </div>
        <div>
          <p className={eyebrow}>Flores artesanais · Portugal</p>
          <h1 className="mt-4 text-5xl leading-[1.02] md:text-7xl">Flores que <em>não murcham.</em></h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">Bouquets feitos à mão para oferecer hoje e guardar durante anos.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#catalogo" className={btnPrimary}>Ver bouquets</a>
            <a href="#personalizados" className={btnOutline}>Criar o meu bouquet</a>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Feito à mão em Portugal · Envio por CTT</p>
        </div>
      </section>

      {/* Categories */}
      <section className="pb-16">
        <div className="mx-auto max-w-6xl px-5">
          <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-5 md:px-0">
            {categories.map((c) => (
              <a key={c.name} href={c.name === "Personalizados" ? "#personalizados" : "#catalogo"} className="group w-36 shrink-0 snap-start md:w-auto">
                <div className="overflow-hidden rounded-2xl">
                  <img src={c.img} alt={c.name} loading="lazy" width={800} height={1000} className="aspect-[3/4] w-full object-cover transition duration-500 group-hover:scale-105" />
                </div>
                <p className="mt-2.5 text-[15px] font-medium">{c.name}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Best sellers */}
      <section id="catalogo" className="scroll-mt-20 bg-secondary/60 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <p className={eyebrow}>Mais pedidos</p>
          <h2 className="mt-3 text-4xl md:text-5xl">Os favoritos</h2>
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {products.map((p) => (
              <article key={p.name} className="flex flex-col">
                <div className="overflow-hidden rounded-2xl bg-card">
                  <img src={p.img} alt={`${p.name} — flores feitas à mão`} loading="lazy" width={800} height={1008} className="aspect-[4/5] w-full object-cover" />
                </div>
                <div className="mt-4 flex items-baseline justify-between gap-3">
                  <h3 className="text-2xl">{p.name}</h3>
                  <span className="shrink-0 text-xl font-medium">{p.price}€</span>
                </div>
                <p className="mt-1 text-[15px] text-muted-foreground">{p.desc}</p>
                <a
                  href={wa(`Olá! Gostava de encomendar o ${p.name} de ${p.price}€. Podem confirmar disponibilidade?`)}
                  target="_blank"
                  rel="noreferrer"
                  className={`${btnPrimary} mt-4 w-full`}
                >
                  Quero este
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Custom */}
      <CustomSection />

      {/* Why */}
      <section className="mx-auto grid max-w-6xl gap-4 px-5 py-16 md:grid-cols-3">
        {[
          [Leaf, "Não murcham", "Uma recordação que pode durar anos."],
          [Hand, "Feitas à mão", "Cada flor é criada individualmente."],
          [Palette, "Personalizáveis", "Escolhe cores, flores e estilo."],
        ].map(([Icon, t, d]) => {
          const I = Icon as typeof Leaf;
          return (
            <div key={t as string} className="flex items-start gap-4 rounded-2xl border border-border p-6">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sage-soft text-foreground"><I className="h-5 w-5" /></span>
              <div>
                <h3 className="text-2xl">{t as string}</h3>
                <p className="mt-1 text-muted-foreground">{d as string}</p>
              </div>
            </div>
          );
        })}
      </section>

      {/* Process */}
      <section id="como-funciona" className="scroll-mt-20 bg-primary py-16 text-primary-foreground md:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-blush">Como funciona</p>
          <h2 className="mt-3 max-w-xl text-4xl md:text-5xl">De um simples fio a uma flor eterna.</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              ["01", "Escolhes", "Cores, flores e orçamento.", hero],
              ["02", "Criamos", "Cada flor é feita manualmente.", hands],
              ["03", "Recebes", "Pronta para oferecer.", gift],
            ].map(([n, t, d, img]) => (
              <div key={n}>
                <img src={img} alt={t} loading="lazy" width={800} height={1000} className="aspect-[4/5] w-full rounded-2xl object-cover" />
                <div className="mt-4 flex items-baseline gap-3">
                  <span className="font-serif text-lg italic text-blush">{n}</span>
                  <h3 className="text-3xl">{t}</h3>
                </div>
                <p className="mt-1 opacity-75">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Occasions */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <h2 className="max-w-lg text-4xl md:text-5xl">Há sempre uma razão para oferecer flores.</h2>
        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">
          {occasions.map((o) => (
            <a key={o.name} href="#catalogo" className="group relative overflow-hidden rounded-2xl">
              <img src={o.img} alt={`Flores para ${o.name}`} loading="lazy" width={800} height={1000} className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-primary/0 to-transparent" />
              <span className="absolute bottom-3 left-3 right-3 font-serif text-xl leading-tight text-primary-foreground md:text-2xl">{o.name}</span>
            </a>
          ))}
        </div>
      </section>

      {/* Social proof — placeholders */}
      <section id="feedback" className="scroll-mt-20 bg-secondary/60 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-4xl md:text-5xl">Quem recebe uma Eterna Flor</h2>
          <p className="mt-3 text-muted-foreground">As opiniões das nossas clientes vão aparecer aqui em breve.</p>
          <div className="-mx-5 mt-8 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex aspect-[9/16] w-56 shrink-0 snap-start flex-col justify-between rounded-3xl border-2 border-dashed border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <span className="h-9 w-9 rounded-full bg-blush ring-2 ring-sage ring-offset-2 ring-offset-card" />
                  <span className="text-sm text-muted-foreground">Nome</span>
                </div>
                <div className="grid flex-1 place-items-center text-muted-foreground"><Camera className="h-8 w-8 opacity-40" /></div>
                <div>
                  <div className="flex gap-0.5 text-border">{[...Array(5)].map((_, s) => <Star key={s} className="h-4 w-4 fill-current" />)}</div>
                  <p className="mt-2 text-sm text-muted-foreground">Espaço para opinião de cliente.</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Instagram */}
      <section className="mx-auto max-w-6xl px-5 py-16 text-center md:py-24">
        <h2 className="text-4xl md:text-5xl">Feitas à mão. Partilhadas com amor.</h2>
        <p className="mt-3 text-muted-foreground">@eternaflor.pt</p>
        <div className="mt-8 grid grid-cols-3 gap-1.5 md:gap-3">
          {[hero, bRosa, hands, bAzul, vase, gift].map((img, i) => (
            <img key={i} src={img} alt="Fotografia Eterna Flor no Instagram" loading="lazy" width={800} height={800} className="aspect-square w-full rounded-lg object-cover" />
          ))}
        </div>
        <a href={INSTAGRAM} target="_blank" rel="noreferrer" className={`${btnOutline} mt-8 gap-2`}>
          <Instagram className="h-4 w-4" /> Seguir no Instagram
        </a>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 mx-auto max-w-3xl px-5 pb-20">
        <h2 className="text-4xl md:text-5xl">Perguntas frequentes</h2>
        <Accordion type="single" collapsible className="mt-8">
          {faqs.map(([q, a], i) => (
            <AccordionItem key={i} value={`f${i}`}>
              <AccordionTrigger className="py-5 text-left text-base font-medium">{q}</AccordionTrigger>
              <AccordionContent className="text-[15px] leading-relaxed text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <a href={wa("Olá! Tenho uma dúvida sobre as vossas flores.")} target="_blank" rel="noreferrer" className={`${btnPrimary} mt-8`}>Falar no WhatsApp</a>
      </section>

      {/* Footer */}
      <footer id="contactos" className="bg-primary px-5 pb-28 pt-14 text-primary-foreground">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3">
          <div>
            <p className="font-serif text-3xl italic">Eterna Flor</p>
            <p className="mt-2 opacity-75">Flores que não murcham.</p>
          </div>
          <div className="space-y-2 text-sm opacity-85">
            <p>Envios: CTT Portugal</p>
            <p>Entrega em mão: Gondomar & Ermesinde</p>
            <p>Instagram: @eternaflor.pt</p>
            <p>TikTok: @eternaflor.pt</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a href={wa("Olá!")} target="_blank" rel="noreferrer">Contactos</a>
            <a href="#faq">FAQ</a>
            <a href="#faq">Envios</a>
            <a href={INSTAGRAM} target="_blank" rel="noreferrer">Instagram</a>
            <a href={TIKTOK} target="_blank" rel="noreferrer">TikTok</a>
          </nav>
        </div>
      </footer>

      {/* Floating WhatsApp */}
      <a
        href={wa("Olá! Precisava de ajuda com uma encomenda.")}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-whatsapp px-5 py-3.5 text-sm font-medium text-primary-foreground shadow-soft"
      >
        <MessageCircle className="h-5 w-5" /> Precisas de ajuda?
      </a>
    </div>
  );
}

const budgets = ["Até 15€", "15€–25€", "25€–40€", "40€–60€", "60€+"];
const field = "mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-3.5 text-base outline-none focus:border-sage focus:ring-2 focus:ring-sage/30";
const label = "text-sm font-medium";

function CustomSection() {
  const [budget, setBudget] = useState(budgets[1]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) || "").trim() || "—";
    const msg = [
      "Olá! Gostava de pedir um bouquet personalizado 🌸",
      "",
      `Nome: ${g("nome")}`,
      `Ocasião: ${g("ocasiao")}`,
      `Data: ${g("data")}`,
      `Orçamento: ${budget}`,
      `Cores: ${g("cores")}`,
      `Flores: ${g("flores")}`,
      `Detalhes: ${g("detalhes")}`,
    ].join("\n");
    window.open(wa(msg), "_blank");
  };

  return (
    <section id="personalizados" className="scroll-mt-20 mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
      <div>
        <p className={eyebrow}>Personalizados</p>
        <h2 className="mt-3 text-4xl leading-tight md:text-5xl">Um bouquet feito só para essa pessoa.</h2>
        <p className="mt-4 text-lg text-muted-foreground">Escolhe as cores, as flores, o orçamento e a ocasião. Nós tratamos do resto.</p>
        <img src={hands} alt="Flor de chenille a ser feita à mão" loading="lazy" width={1024} height={1024} className="mt-8 hidden aspect-square w-full rounded-[2rem] object-cover md:block" />
      </div>
      <form onSubmit={submit} className="space-y-5 rounded-[2rem] bg-blush/40 p-6 md:p-8">
        <h3 className="text-3xl">Criar bouquet personalizado</h3>
        <label className="block"><span className={label}>Nome</span><input name="nome" required className={field} /></label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block"><span className={label}>Ocasião</span><input name="ocasiao" placeholder="Aniversário, Dia da Mãe…" className={field} /></label>
          <label className="block"><span className={label}>Data em que precisa</span><input name="data" type="date" className={field} /></label>
        </div>
        <div>
          <span className={label}>Orçamento</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {budgets.map((b) => (
              <button
                type="button"
                key={b}
                onClick={() => setBudget(b)}
                className={`rounded-full border px-4 py-2.5 text-sm transition ${budget === b ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card"}`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
        <label className="block"><span className={label}>Cores preferidas</span><input name="cores" placeholder="Rosa-velho, creme, verde…" className={field} /></label>
        <label className="block"><span className={label}>Flores preferidas</span><input name="flores" placeholder="Rosas, tulipas, margaridas…" className={field} /></label>
        <label className="block"><span className={label}>Detalhes adicionais</span><textarea name="detalhes" rows={3} className={field} /></label>
        <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-whatsapp px-7 py-4 text-[15px] font-medium text-primary-foreground">
          <MessageCircle className="h-5 w-5" /> Enviar pedido pelo WhatsApp
        </button>
      </form>
    </section>
  );
}
