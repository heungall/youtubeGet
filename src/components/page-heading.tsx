export function PageHeading({ eyebrow, title, description, action }: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
    <div>
      <p className="mb-2 text-xs font-semibold tracking-[0.15em] text-primary">{eyebrow}</p>
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
    {action}
  </header>;
}
