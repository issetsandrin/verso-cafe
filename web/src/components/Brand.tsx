export function CoffeeLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path
        d="M10 20h24v8a10 10 0 0 1-10 10h-4A10 10 0 0 1 10 28v-8Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path d="M34 22h3a5 5 0 0 1 0 10h-3" stroke="currentColor" strokeWidth="3" fill="none" />
      <path
        d="M18 6c-2 2-2 4 0 6M24 6c-2 2-2 4 0 6M30 6c-2 2-2 4 0 6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

export function Spinner({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream text-accent">
      <Spinner className="h-10 w-10" />
    </div>
  );
}
