import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { MessageCircle, Instagram, Menu, X } from "lucide-react";
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

const faqs = [
  ["Quanto tempo demora uma encomenda?", "Normalmente entre 3 e 7 dias. Confirmamos o prazo ao encomendar."],
  ["Fazem envios para todo o país?", "Sim, enviamos para todo Portugal por CTT. Em Gondomar e Ermesinde entregamos em mão."],
  ["Como é feito o pagamento?", "Indicamos as opções de pagamento ao confirmar a encomenda pelo WhatsApp."],
  ["Posso escolher as cores e as flores?", "Claro — usa o formulário de bouquet personalizado e enviamos-te uma proposta pelo WhatsApp."],
  ["Como devo conservar as flores?", "Mantém longe da humidade e do sol direto. Para limpar o pó, usa um secador em ar frio."],
];

const nav = [
  ["Bouquets", "#catalogo"],
  ["Personalizar", "#personalizados"],
  ["FAQ", "#faq"],
];

const btnPrimary =
  "inline-flex items-center justify-center bg-primary px-12 py-4 text-xs uppercase tracking-[0.2em] text-primary-foreground transition-colors hover:bg-foreground";
const btnOutline =
  "inline-flex items-center justify-center border border-primary px-12 py-4 text-xs uppercase tracking-[0.2em] text-primary transition-all hover:bg-primary hover:text-primary-foreground";
const eyebrow = "text-xs font-medium uppercase tracking-[0.4em] text-sage";

function Index() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-blush">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-6 py-5 md:px-16 lg:flex lg:justify-between">
          <a href="#inicio" className="truncate font-serif text-2xl italic tracking-wide">Eterna Flor</a>
          <nav className="hidden gap-10 text-[10px] font-medium uppercase tracking-[0.25em] lg:flex">
            {nav.map(([l, h]) => (
              <a key={h} href={h} className="transition-colors hover:text-sage">{l}</a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <a href="#catalogo" className="inline-flex border border-primary px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-primary hover:text-primary-foreground sm:px-6">
              Encomendar
            </a>
            <button aria-label="Menu" onClick={() => setOpen(!open)} className="grid h-11 w-11 place-items-center lg:hidden">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-border px-6 pb-4 lg:hidden">
            {nav.map(([l, h]) => (
              <a key={h} href={h} onClick={() => setOpen(false)} className="block border-b border-border/60 py-4 font-serif text-2xl last:border-0">{l}</a>
            ))}
          </nav>
        )}
      </header>

      {/* Hero */}
      <section id="inicio" className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-10 px-6 pt-8 pb-20 md:px-16 md:pt-20 md:pb-32 lg:grid-cols-12 lg:gap-12">
        <div className="relative lg:order-2 lg:col-span-7">
          <div className="aspect-[4/5] overflow-hidden bg-muted sm:aspect-[5/4] lg:aspect-[4/5]">
            <img src={hero} alt="Bouquet Eterna Flor feito à mão com flores que não murcham" width={1024} height={1280} className="h-full w-full object-cover" />
          </div>
          <div className="absolute bottom-0 left-0 border border-blush bg-background px-5 py-4 xl:bottom-8 xl:-translate-x-1/4 xl:p-8">
            <span className="text-[10px] uppercase tracking-[0.2em] text-sage xl:text-xs">Coleção permanente</span>
            <p className="mt-1 font-serif text-xl xl:mt-2 xl:text-2xl">A partir de 18€</p>
          </div>
        </div>
        <div className="lg:order-1 lg:col-span-5">
          <p className={eyebrow}>Flores artesanais · Portugal</p>
          <h1 className="mt-5 text-5xl font-light leading-[0.95] md:text-[92px]">
            Flores que <br /><em className="italic">não murcham.</em>
          </h1>
          <p className="mt-6 max-w-sm text-base font-light leading-relaxed md:mt-8 md:text-lg">
            Bouquets feitos à mão para oferecer hoje e guardar durante anos.
          </p>
          <div className="mt-8 flex flex-col gap-3 md:mt-12 sm:flex-row sm:gap-6">
            <a href="#catalogo" className={btnPrimary}>Ver bouquets</a>
            <a href="#personalizados" className={btnOutline}>Criar o meu bouquet</a>
          </div>
          <p className="mt-8 text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:mt-10">
            Feito à mão em Portugal · Envio por CTT
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-[1440px] px-6 pb-20 md:px-16 md:pb-48">
        <div className="-mx-6 flex snap-x gap-4 overflow-x-auto px-6 pb-2 md:mx-0 md:grid md:grid-cols-5 md:px-0">
          {categories.map((c, i) => (
            <a
              key={c.name}
              href={c.name === "Personalizados" ? "#personalizados" : "#catalogo"}
              className={`group w-40 shrink-0 snap-start md:w-auto ${i % 2 === 1 ? "md:mt-12" : ""}`}
            >
              <div className="aspect-[3/4] overflow-hidden bg-muted">
                <img src={c.img} alt={c.name} loading="lazy" width={800} height={1000} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <p className="mt-4 text-center font-serif text-xl italic">{c.name}</p>
            </a>
          ))}
        </div>
      </section>

      {/* Best sellers */}
      <section id="catalogo" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-[1440px] px-6 py-24 md:px-16 md:py-32">
          <div className="mb-16 flex flex-col justify-between gap-4 md:mb-20 md:flex-row md:items-baseline">
            <div>
              <p className={eyebrow}>Mais pedidos</p>
              <h2 className="mt-4 text-5xl font-light md:text-6xl">Os favoritos</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-12 md:gap-x-10 md:gap-y-16 lg:grid-cols-4 lg:gap-y-20">
            {products.map((p) => (
              <article key={p.name} className="group">
                <div className="relative aspect-[4/5] overflow-hidden bg-card">
                  <img src={p.img} alt={`${p.name} — flores feitas à mão`} loading="lazy" width={800} height={1008} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <span className="absolute bottom-0 left-0 bg-background px-3 py-1.5 text-sm font-light md:hidden">{p.price}€</span>
                </div>
                <div className="mt-4 flex items-baseline justify-between gap-3 md:mt-8">
                  <h3 className="text-xl font-light md:text-3xl">{p.name}</h3>
                  <span className="hidden shrink-0 text-lg font-light md:inline">{p.price}€</span>
                </div>
                <p className="mt-3 hidden text-sm font-light leading-relaxed text-muted-foreground md:block">{p.desc}</p>
                <a
                  href={wa(`Olá! Gostava de encomendar o ${p.name} de ${p.price}€. Podem confirmar disponibilidade?`)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex w-full items-center justify-center border border-primary py-3.5 text-[10px] uppercase tracking-[0.25em] transition-all hover:bg-primary hover:text-primary-foreground md:mt-8 md:py-4"
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

      {/* Process */}
      <section id="como-funciona" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-[1440px] px-6 py-24 md:px-16 md:py-32">
          <p className={eyebrow}>Como funciona</p>
          <h2 className="mt-4 max-w-xl text-5xl font-light md:text-6xl">De um simples fio a uma flor eterna.</h2>
          <div className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10">
            {[
              ["01", "Escolhes", "Cores, flores e orçamento.", hero],
              ["02", "Criamos", "Cada flor é feita manualmente.", hands],
              ["03", "Recebes", "Pronta para oferecer.", gift],
            ].map(([n, t, d, img]) => (
              <div key={n}>
                <div className="aspect-[4/5] overflow-hidden bg-muted">
                  <img src={img} alt={t} loading="lazy" width={800} height={1000} className="h-full w-full object-cover" />
                </div>
                <div className="mt-6 flex items-baseline gap-4">
                  <span className="font-serif text-lg italic text-sage">{n}</span>
                  <h3 className="text-3xl font-light">{t}</h3>
                </div>
                <p className="mt-2 text-sm font-light text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof — placeholders */}
      <section id="feedback" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-[1440px] px-6 py-24 md:px-16 md:py-32">
          <p className={eyebrow}>Feedback</p>
          <h2 className="mt-4 text-5xl font-light md:text-6xl">Quem recebe uma Eterna Flor</h2>
          <p className="mt-4 max-w-md font-light text-muted-foreground">As opiniões das nossas clientes vão aparecer aqui em breve.</p>
          <div className="-mx-6 mt-12 flex snap-x gap-6 overflow-x-auto px-6 pb-2 md:mx-0 md:grid md:grid-cols-4 md:px-0">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex aspect-[3/4] w-56 shrink-0 snap-start flex-col justify-between border border-dashed border-border p-8 md:w-auto">
                <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Cliente</span>
                <p className="font-serif text-2xl italic font-light text-muted-foreground">Espaço para opinião de cliente.</p>
                <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Em breve</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Instagram */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[1440px] px-6 py-24 text-center md:px-16 md:py-32">
          <p className={eyebrow}>Instagram</p>
          <h2 className="mt-4 text-5xl font-light md:text-6xl">Feitas à mão. Partilhadas com amor.</h2>
          <p className="mt-4 font-light text-muted-foreground">@eternaflor.pt</p>
          <div className="mt-12 grid grid-cols-3 gap-2 md:gap-4">
            {[hero, bRosa, hands, bAzul, vase, gift].map((img, i) => (
              <div key={i} className="aspect-square overflow-hidden bg-muted">
                <img src={img} alt="Fotografia Eterna Flor no Instagram" loading="lazy" width={800} height={800} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
          <a href={INSTAGRAM} target="_blank" rel="noreferrer" className={`${btnOutline} mt-12 gap-3`}>
            <Instagram className="h-4 w-4" /> Seguir no Instagram
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-24 md:py-32">
          <p className={eyebrow}>FAQ</p>
          <h2 className="mt-4 text-5xl font-light md:text-6xl">Perguntas frequentes</h2>
          <Accordion type="single" collapsible className="mt-12">
            {faqs.map(([q, a], i) => (
              <AccordionItem key={i} value={`f${i}`}>
                <AccordionTrigger className="py-6 text-left font-serif text-xl font-light">{q}</AccordionTrigger>
                <AccordionContent className="font-light leading-relaxed text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <a href={wa("Olá! Tenho uma dúvida sobre as vossas flores.")} target="_blank" rel="noreferrer" className={`${btnPrimary} mt-12`}>Falar no WhatsApp</a>
        </div>
      </section>

      {/* Footer */}
      <footer id="contactos" className="bg-primary px-6 pb-32 pt-20 text-primary-foreground md:px-16 md:pb-28">
        <div className="mx-auto grid max-w-[1440px] gap-12 md:grid-cols-3">
          <div>
            <p className="font-serif text-3xl italic">Eterna Flor</p>
            <p className="mt-3 font-light opacity-75">Flores que não murcham.</p>
          </div>
          <div className="space-y-2 text-sm font-light opacity-85">
            <p>Envios: CTT Portugal</p>
            <p>Entrega em mão: Gondomar & Ermesinde</p>
            <p>Instagram: @eternaflor.pt</p>
            <p>TikTok: @eternaflor.pt</p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-3 text-[10px] uppercase tracking-[0.25em]">
            <a href={wa("Olá!")} target="_blank" rel="noreferrer">Contactos</a>
            <a href="#faq">FAQ</a>
            <a href="#faq">Envios</a>
            <a href={INSTAGRAM} target="_blank" rel="noreferrer">Instagram</a>
            <a href={TIKTOK} target="_blank" rel="noreferrer">TikTok</a>
          </nav>
        </div>
      </footer>

      {/* Sticky mobile CTA bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-2 gap-2 px-4 py-3">
          <a href="#catalogo" className="inline-flex items-center justify-center bg-primary py-3.5 text-[11px] uppercase tracking-[0.2em] text-primary-foreground">
            Ver bouquets · 18€+
          </a>
          <a
            href={wa("Olá! Precisava de ajuda com uma encomenda.")}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 border border-primary py-3.5 text-[11px] uppercase tracking-[0.2em]"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </div>
      </div>

      {/* Floating WhatsApp (desktop) */}
      <a
        href={wa("Olá! Precisava de ajuda com uma encomenda.")}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-5 right-5 z-50 hidden items-center gap-2 bg-whatsapp px-5 py-3.5 text-sm font-medium text-primary-foreground shadow-soft md:inline-flex"
      >
        <MessageCircle className="h-5 w-5" /> Precisas de ajuda?
      </a>
    </div>
  );
}

const budgets = ["Até 15€", "15€–25€", "25€–40€", "40€–60€", "60€+"];
const fieldLabel = "block text-[10px] uppercase tracking-[0.2em] text-muted-foreground";
const field = "w-full border-b border-border bg-transparent pb-2 pt-1 text-lg font-light outline-none transition-colors focus:border-sage placeholder:text-muted-foreground/50";

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
    <section id="personalizados" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-16 px-6 py-24 md:px-16 md:py-32 lg:grid-cols-2 lg:gap-24">
        <div>
          <p className={eyebrow}>Personalizados</p>
          <h2 className="mt-6 text-5xl font-light leading-[1.05] md:text-6xl">Um bouquet feito só para essa pessoa.</h2>
          <p className="mt-8 max-w-lg text-lg font-light leading-relaxed text-muted-foreground">
            Escolhe as cores, as flores, o orçamento e a ocasião. Nós tratamos do resto.
          </p>
          <div className="mt-16 hidden aspect-video overflow-hidden bg-muted md:block">
            <img src={hands} alt="Flor de chenille a ser feita à mão" loading="lazy" width={1024} height={1024} className="h-full w-full object-cover" />
          </div>
        </div>

        <form onSubmit={submit} className="space-y-8 border border-blush bg-card p-6 md:space-y-10 md:p-16">
          <h3 className="font-serif text-3xl font-light italic md:text-4xl">Formulário de pedido</h3>
          <label className="block">
            <span className={fieldLabel}>Nome</span>
            <input name="nome" required className={field} />
          </label>
          <div className="grid gap-10 sm:grid-cols-2">
            <label className="block">
              <span className={fieldLabel}>Ocasião</span>
              <input name="ocasiao" placeholder="Aniversário, Dia da Mãe…" className={field} />
            </label>
            <label className="block">
              <span className={fieldLabel}>Data em que precisa</span>
              <input name="data" type="date" className={field} />
            </label>
          </div>
          <div>
            <span className={fieldLabel}>Orçamento</span>
            <div className="mt-4 flex flex-wrap gap-3">
              {budgets.map((b) => (
                <button
                  type="button"
                  key={b}
                  onClick={() => setBudget(b)}
                  className={`border px-6 py-2 text-[10px] uppercase tracking-[0.15em] transition-colors ${budget === b ? "border-primary bg-primary text-primary-foreground" : "border-primary/30 hover:border-primary"}`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className={fieldLabel}>Cores preferidas</span>
            <input name="cores" placeholder="Rosa-velho, creme, verde…" className={field} />
          </label>
          <label className="block">
            <span className={fieldLabel}>Flores preferidas</span>
            <input name="flores" placeholder="Rosas, tulipas, margaridas…" className={field} />
          </label>
          <label className="block">
            <span className={fieldLabel}>Detalhes adicionais</span>
            <textarea name="detalhes" rows={2} className={`${field} resize-none`} />
          </label>
          <button type="submit" className="inline-flex w-full items-center justify-center gap-3 bg-whatsapp py-5 text-xs uppercase tracking-[0.3em] text-primary-foreground transition-opacity hover:opacity-90">
            <MessageCircle className="h-4 w-4" /> Enviar pedido pelo WhatsApp
          </button>
        </form>
      </div>
    </section>
  );
}
