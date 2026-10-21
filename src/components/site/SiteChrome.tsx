import { Link } from "@tanstack/react-router";
import { useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { Menu, MessageCircle, X } from "lucide-react";
import { wa, INSTAGRAM, TIKTOK } from "@/lib/config";
import { MenuBackdrop } from "@/components/site/MenuBackdrop";

type NavItem = { label: string; to: "/" | "/catalogo" | "/galeria"; hash?: string };
const nav: NavItem[] = [
  { label: "Início", to: "/" },
  { label: "Catálogo", to: "/catalogo" },
  { label: "Galeria", to: "/galeria" },
  { label: "Personalizados", to: "/", hash: "personalizados" },
  { label: "FAQ", to: "/", hash: "faq" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} asChild>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <MenuBackdrop open={open} close={() => setOpen(false)} />
        <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-6 py-5 md:px-16 lg:flex lg:justify-between">
          <Link to="/" className="truncate font-serif text-2xl italic tracking-wide">
            Eterna Flor
          </Link>
          <nav className="hidden gap-10 text-[10px] font-medium uppercase tracking-[0.25em] lg:flex">
            {nav.map((n) => (
              <Link
                key={n.label}
                to={n.to}
                {...(n.to === "/galeria" ? { preload: false } : {})}
                {...(n.hash ? { hash: n.hash } : {})}
                className="storefront-nav-link transition-colors hover:text-sage"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/catalogo"
              className="inline-flex border border-primary px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-primary hover:text-primary-foreground sm:px-6"
            >
              Encomendar
            </Link>
            <Collapsible.Trigger asChild>
              <button aria-label="Menu" className="grid h-11 w-11 place-items-center lg:hidden">
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </Collapsible.Trigger>
          </div>
        </div>
        <Collapsible.Content className="storefront-menu lg:hidden">
          <nav className="border-t border-border px-6 pb-4">
            {nav.map((n) => (
              <Link
                key={n.label}
                to={n.to}
                {...(n.to === "/galeria" ? { preload: false } : {})}
                {...(n.hash ? { hash: n.hash } : {})}
                onClick={() => setOpen(false)}
                className="block border-b border-border/60 py-4 font-serif text-2xl last:border-0"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </Collapsible.Content>
      </header>
    </Collapsible.Root>
  );
}

export function SiteFooter() {
  return (
    <footer
      id="contactos"
      className="bg-primary px-6 pb-32 pt-20 text-primary-foreground md:px-16 md:pb-28"
    >
      <div data-reveal="footer" className="mx-auto grid max-w-[1440px] gap-12 md:grid-cols-3">
        <div>
          <p className="font-serif text-3xl italic">Eterna Flor</p>
          <p className="mt-3 font-light opacity-75">Flores que não murcham.</p>
        </div>
        <div className="space-y-2 text-sm font-light opacity-85">
          <p>Envios: CTT Portugal</p>
          <p>Entrega em mão: Gondomar & Ermesinde</p>
          <p>WhatsApp: 916 883 724</p>
        </div>
        <nav className="flex flex-wrap gap-x-8 gap-y-3 text-[10px] uppercase tracking-[0.25em]">
          <Link to="/catalogo">Catálogo</Link>
          <Link to="/galeria" preload={false}>
            Galeria
          </Link>
          <a href={wa("Olá!")} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <Link to="/" hash="faq">
            FAQ
          </Link>
          <a href={INSTAGRAM} target="_blank" rel="noreferrer">
            Instagram
          </a>
          <a href={TIKTOK} target="_blank" rel="noreferrer">
            TikTok
          </a>
        </nav>
      </div>
    </footer>
  );
}

export function FloatingWhatsApp() {
  return (
    <>
      <a
        href={wa("Olá! Precisava de ajuda com uma encomenda.")}
        target="_blank"
        rel="noreferrer"
        aria-label="Contactar pelo WhatsApp"
        className="fixed z-20 grid h-16 w-16 place-items-center rounded-full bg-whatsapp text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary md:hidden"
        style={{
          bottom: "calc(20px + env(safe-area-inset-bottom))",
          right: "18px",
          boxShadow: "0 6px 20px rgba(0, 0, 0, 0.14)",
        }}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="h-8 w-8"
        >
          {/* WhatsApp brand mark from Bootstrap Icons (MIT). */}
          <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232" />
        </svg>
      </a>
      <a
        href={wa("Olá! Precisava de ajuda com uma encomenda.")}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-5 right-5 z-50 hidden items-center gap-2 bg-whatsapp px-5 py-3.5 text-sm font-medium text-primary-foreground shadow-soft md:inline-flex"
      >
        <MessageCircle className="h-5 w-5" /> Precisas de ajuda?
      </a>
    </>
  );
}
