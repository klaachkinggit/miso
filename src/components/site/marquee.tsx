interface MarqueeProps {
  items: string[];
}

export function Marquee({ items }: MarqueeProps) {
  if (items.length === 0) return null;
  return (
    <div
      aria-label="Site announcements"
      role="region"
      className="overflow-hidden border-b border-accent/25 bg-[#121212]"
    >
      <div
        aria-hidden="true"
        className="marquee-track flex w-max items-center gap-10 whitespace-nowrap py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-[#E6D8C9]"
      >
        {[...items, ...items].map((item, i) => (
          <span key={`${item}-${i}`} className="flex items-center gap-10">
            <span>{item}</span>
            <span className="text-[#B89B5E]/55">/</span>
          </span>
        ))}
      </div>
      <ul className="sr-only">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
