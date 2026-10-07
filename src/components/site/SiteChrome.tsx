import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, MessageCircle, X } from "lucide-react";
import { wa, INSTAGRAM, TIKTOK } from "@/lib/config";

type NavItem = { label: string; to: "/" | "/catalogo"; hash?: string };
const nav: NavItem[] = [
  { label: "Início", to: "/" },
  { label: "Catálogo", to: "/catalogo" },
  { label: "Personalizados", to: "/", hash: "personalizados" },
  { label: "FAQ", to: "/", hash: "faq" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-6 py-5 md:px-16 lg:flex lg:justify-between">
        <Link to="/" className="truncate font-serif text-2xl italic tracking-wide">Eterna Flor</Link>
        <nav className="hidden gap-10 text-[10px] font-medium uppercase tracking-[0.25em] lg:flex">
          {nav.map((n) => (
            <Link key={n.label} to={n.to} {...(n.hash ? { hash: n.hash } : {})} className="transition-colors hover:text-sage">{n.label}</Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/catalogo" className="inline-flex border border-primary px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-primary hover:text-primary-foreground sm:px-6">
            Encomendar
          </Link>
          <button aria-label="Menu" onClick={() => setOpen(!open)} className="grid h-11 w-11 place-items-center lg:hidden">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-border px-6 pb-4 lg:hidden">
          {nav.map((n) => (
            <Link key={n.label} to={n.to} {...(n.hash ? { hash: n.hash } : {})} onClick={() => setOpen(false)} className="block border-b border-border/60 py-4 font-serif text-2xl last:border-0">{n.label}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer id="contactos" className="bg-primary px-6 pb-32 pt-20 text-primary-foreground md:px-16 md:pb-28">
      <div className="mx-auto grid max-w-[1440px] gap-12 md:grid-cols-3">
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
          <a href={wa("Olá!")} target="_blank" rel="noreferrer">WhatsApp</a>
          <Link to="/" hash="faq">FAQ</Link>
          <a href={INSTAGRAM} target="_blank" rel="noreferrer">Instagram</a>
          <a href={TIKTOK} target="_blank" rel="noreferrer">TikTok</a>
        </nav>
      </div>
    </footer>
  );
}

export function MobileCtaBar({ onCatalog = false }: { onCatalog?: boolean }) {
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className={`grid gap-2 px-4 py-3 ${onCatalog ? "grid-cols-1" : "grid-cols-2"}`}>
          {!onCatalog && <Link to="/catalogo" className="inline-flex items-center justify-center bg-primary py-3.5 text-[11px] uppercase tracking-[0.2em] text-primary-foreground">
            Ver catálogo
          </Link>}
          <a href={wa("Olá! Precisava de ajuda com uma encomenda.")} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 border border-primary py-3.5 text-[11px] uppercase tracking-[0.2em]">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </div>
      </div>
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
