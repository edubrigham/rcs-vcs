"use client";

import {
  Children,
  createContext,
  useId,
  useRef,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

type InlineCitationCardContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const InlineCitationCardContext = createContext<InlineCitationCardContextValue | null>(null);

type InlineCitationCarouselContextValue = {
  index: number;
  setIndex: (index: number) => void;
  count: number;
  setCount: (count: number) => void;
};

const InlineCitationCarouselContext = createContext<InlineCitationCarouselContextValue | null>(null);

function getHostname(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

export function InlineCitation(props: ComponentProps<"span">) {
  return <span {...props} className={`inline-flex align-middle font-sans ${props.className ?? ""}`} />;
}

export function InlineCitationText(props: ComponentProps<"span">) {
  return <span {...props} />;
}

export function InlineCitationCard(props: ComponentProps<"span">) {
  const [open, setOpen] = useState(false);
  const cardId = useId();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearCloseTimer() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), 130);
  }

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      clearCloseTimer();
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    function onOtherOpen(event: Event) {
      const customEvent = event as CustomEvent<{ id: string }>;
      if (customEvent.detail?.id !== cardId) setOpen(false);
    }
    window.addEventListener("inline-citation-open", onOtherOpen as EventListener);
    return () => window.removeEventListener("inline-citation-open", onOtherOpen as EventListener);
  }, [cardId]);

  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent("inline-citation-open", { detail: { id: cardId } }));
  }, [open, cardId]);

  return (
    <InlineCitationCardContext.Provider
      value={{
        open,
        setOpen: (nextOpen) => {
          clearCloseTimer();
          setOpen(nextOpen);
        },
      }}
    >
      <span
        {...props}
        ref={rootRef}
        className={`relative inline-flex ${props.className ?? ""}`}
        onMouseEnter={(event) => {
          props.onMouseEnter?.(event);
          clearCloseTimer();
        }}
        onMouseLeave={(event) => {
          props.onMouseLeave?.(event);
          scheduleClose();
        }}
      />
    </InlineCitationCardContext.Provider>
  );
}

export function InlineCitationCardTrigger({
  sources,
  ...props
}: ComponentProps<"button"> & { sources: string[] }) {
  const ctx = useContext(InlineCitationCardContext);
  if (!ctx) throw new Error("InlineCitationCardTrigger must be used inside InlineCitationCard.");

  const label = useMemo(() => {
    if (sources.length === 0) return "source";
    const host = getHostname(sources[0]);
    if (sources.length === 1) return host;
    return `${host} +${sources.length - 1}`;
  }, [sources]);

  return (
    <button
      type="button"
      {...props}
      onMouseEnter={(event) => {
        props.onMouseEnter?.(event);
        ctx.setOpen(true);
      }}
      onClick={(event) => {
        props.onClick?.(event);
        ctx.setOpen(!ctx.open);
      }}
      onFocus={(event) => {
        props.onFocus?.(event);
        ctx.setOpen(true);
      }}
      className={`rounded-full border border-line bg-white px-2 py-0.5 font-sans text-[10px] font-semibold text-zinc-700 shadow-sm transition hover:border-line-strong hover:bg-zinc-50 ${ctx.open ? "border-line-strong bg-zinc-50" : ""} ${props.className ?? ""}`}
    >
      {label}
    </button>
  );
}

export function InlineCitationCardBody(props: ComponentProps<"div">) {
  const ctx = useContext(InlineCitationCardContext);
  if (!ctx) throw new Error("InlineCitationCardBody must be used inside InlineCitationCard.");
  if (!ctx.open) return null;

  return (
    <div
      {...props}
      className={`absolute left-0 top-[calc(100%+8px)] z-30 w-[min(380px,64vw)] min-h-[200px] rounded-2xl border border-line bg-white p-2.5 font-sans text-zinc-900 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)] ${props.className ?? ""}`}
    />
  );
}

export function InlineCitationCarousel({ children, ...props }: { children: ReactNode } & ComponentProps<"div">) {
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  return (
    <InlineCitationCarouselContext.Provider value={{ index, setIndex, count, setCount }}>
      <div {...props}>{children}</div>
    </InlineCitationCarouselContext.Provider>
  );
}

export function InlineCitationCarouselContent({
  children,
  ...props
}: { children: ReactNode } & ComponentProps<"div">) {
  const ctx = useContext(InlineCitationCarouselContext);
  if (!ctx) throw new Error("InlineCitationCarouselContent must be used inside InlineCitationCarousel.");

  const items = Children.toArray(children).filter((child) => isValidElement(child));
  useEffect(() => {
    ctx.setCount(items.length || 1);
    if (ctx.index > items.length - 1) ctx.setIndex(0);
  }, [ctx, items.length]);

  return <div {...props} className={`min-h-[150px] ${props.className ?? ""}`}>{items[ctx.index] ?? null}</div>;
}

export function InlineCitationCarouselItem(props: ComponentProps<"div">) {
  return <div {...props} />;
}

export function InlineCitationCarouselHeader(props: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={`-mx-2.5 -mt-2.5 mb-3 grid grid-cols-[auto_auto_1fr] items-center gap-2 rounded-t-2xl border-b border-line bg-zinc-50 px-3 py-2 ${props.className ?? ""}`}
    />
  );
}

export function InlineCitationCarouselIndex(props: ComponentProps<"div">) {
  const ctx = useContext(InlineCitationCarouselContext);
  if (!ctx) throw new Error("InlineCitationCarouselIndex must be used inside InlineCitationCarousel.");
  return (
    <div
      {...props}
      className={`justify-self-end text-base font-medium tabular-nums text-zinc-500 ${props.className ?? ""}`}
    >
      {props.children ?? `${ctx.index + 1}/${ctx.count || 1}`}
    </div>
  );
}

export function InlineCitationCarouselPrev(props: ComponentProps<"button">) {
  const ctx = useContext(InlineCitationCarouselContext);
  if (!ctx) throw new Error("InlineCitationCarouselPrev must be used inside InlineCitationCarousel.");
  return (
    <button
      type="button"
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        ctx.setIndex(Math.max(0, ctx.index - 1));
      }}
      disabled={ctx.index <= 0}
      className={`h-7 w-7 rounded-md text-2xl leading-none text-zinc-500 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 ${props.className ?? ""}`}
      aria-label="Previous citation"
    >
      ←
    </button>
  );
}

export function InlineCitationCarouselNext(props: ComponentProps<"button">) {
  const ctx = useContext(InlineCitationCarouselContext);
  if (!ctx) throw new Error("InlineCitationCarouselNext must be used inside InlineCitationCarousel.");
  return (
    <button
      type="button"
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        ctx.setIndex(Math.min((ctx.count || 1) - 1, ctx.index + 1));
      }}
      disabled={ctx.index >= (ctx.count || 1) - 1}
      className={`h-7 w-7 rounded-md text-2xl leading-none text-zinc-500 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 ${props.className ?? ""}`}
      aria-label="Next citation"
    >
      →
    </button>
  );
}

export function InlineCitationSource({
  title,
  url,
  description,
  ...props
}: ComponentProps<"div"> & { title: string; url: string; description?: string }) {
  return (
    <div {...props} className={`space-y-1 ${props.className ?? ""}`}>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="block text-[13px] font-semibold leading-snug text-zinc-900 underline-offset-2 hover:underline"
      >
        <span>{title}</span>
      </a>
      {description ? <p className="text-[12px] leading-relaxed text-zinc-700">{description}</p> : null}
    </div>
  );
}

export function InlineCitationQuote(props: ComponentProps<"blockquote">) {
  return (
    <blockquote
      {...props}
      className={`mt-2 border-l-2 border-line-strong pl-3 text-sm italic leading-relaxed text-zinc-700 ${props.className ?? ""}`}
    />
  );
}
