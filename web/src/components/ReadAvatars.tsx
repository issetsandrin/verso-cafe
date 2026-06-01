import { Avatar } from "./Avatar";

export interface Reader {
  id: string;
  name: string;
}

/** Avatares de quem já leu até esta mensagem. Acima de 3, mostra "+N". */
export function ReadAvatars({ readers, mine }: { readers: Reader[]; mine: boolean }) {
  if (readers.length === 0) return null;
  const shown = readers.slice(0, 3);
  const extra = readers.length - shown.length;

  return (
    <div
      className={`mt-0.5 flex items-center gap-0.5 ${mine ? "justify-end" : "justify-start pl-10"}`}
      title={`Lido por ${readers.map((r) => r.name).join(", ")}`}
    >
      <div className="flex -space-x-1.5">
        {shown.map((r) => (
          <div key={r.id} className="rounded-full ring-2 ring-cream">
            <Avatar id={r.id} name={r.name} size="xs" />
          </div>
        ))}
      </div>
      {extra > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-coffee-200 px-1 text-[9px] font-bold text-coffee-700 ring-2 ring-cream">
          +{extra}
        </span>
      )}
    </div>
  );
}
