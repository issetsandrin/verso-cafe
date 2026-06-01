import { CoffeeLogo } from "./Brand";

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="safe-top sticky top-0 z-20 border-b border-coffee-100 bg-cream/90 px-5 pb-3 pt-5 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-accent">
            <CoffeeLogo className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-lg font-bold leading-tight text-coffee-900">{title}</h1>
            {subtitle && <p className="text-xs text-coffee-500">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
    </header>
  );
}
