export default function ClientLoading() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm font-medium">Chargement…</span>
      </div>
    </div>
  )
}
