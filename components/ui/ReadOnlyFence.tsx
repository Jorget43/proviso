// Wraps edit controls so non-CFO users see them disabled rather than buttons
// that 403. When `canEdit` is true it renders children untouched (no extra DOM);
// otherwise a native `fieldset disabled` disables every nested form control.
// The server-side authorize() guards remain the real security boundary — this
// is purely the UX layer.
export default function ReadOnlyFence({
  canEdit,
  children,
  title = 'Read-only — editing is reserved for CFO members',
}: {
  canEdit: boolean
  children: React.ReactNode
  title?: string
}) {
  if (canEdit) return <>{children}</>
  return (
    <fieldset className="ro-fence" disabled title={title}>
      {children}
    </fieldset>
  )
}
