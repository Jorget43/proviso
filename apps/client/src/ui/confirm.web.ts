// The browser's own confirm dialog (React Native's Alert does nothing on the web).

export function confirmAction(title: string, message: string, _action: string, onConfirm: () => void): void {
  if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm()
}
