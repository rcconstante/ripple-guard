/**
 * One Custom UI resource serves both manifest modules (jira:globalPage and
 * jira:issuePanel). Branch on `(await view.getContext()).extension.type` from
 * `@forge/bridge` when you build the views.
 */
export default function App() {
  return (
    <main className="min-h-svh bg-background p-6 text-foreground">
      <h1 className="font-heading text-xl font-semibold tracking-tight">RippleGuard</h1>
    </main>
  )
}
