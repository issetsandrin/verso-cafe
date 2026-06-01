import { initials } from "@/lib/format";

// Cores distintas por usuário — mesma ordem das cores de balão do chat,
// então o avatar e a mensagem da pessoa combinam.
const PALETTE = [
  "bg-rose-500",
  "bg-sky-600",
  "bg-emerald-600",
  "bg-violet-500",
  "bg-amber-600",
  "bg-teal-600",
  "bg-fuchsia-600",
  "bg-cyan-700",
];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function Avatar({
  id,
  name,
  size = "md",
}: {
  id: string;
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const sizes = {
    xs: "h-5 w-5 text-[9px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-lg",
  };
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${colorFor(
        id,
      )} ${sizes[size]}`}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
