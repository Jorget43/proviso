import { Resend } from 'resend'
import { fyLabel, type WatchdogReport, type AssumptionStatus } from './watchdog'

const STATUS_COLOR: Record<string, string> = {
  overdue: '#c0392b',
  review:  '#d68910',
  current: '#27ae60',
}

export async function sendWatchdogEmail(report: WatchdogReport) {
  const to = process.env.NOTIFICATION_EMAIL
  if (!to) throw new Error('NOTIFICATION_EMAIL env var not set')

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY env var not set')

  const stale = report.items.filter(i => i.status !== 'current')
  const fy = fyLabel(report.currentFyEnding)
  const subject = `Proviso Watchdog — ${stale.length} assumption${stale.length !== 1 ? 's' : ''} due for review (FY${fy})`

  const resend = new Resend(apiKey)
  const from = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

  await resend.emails.send({ from, to, subject, html: buildHtml(report, stale) })
}

function buildHtml(report: WatchdogReport, stale: AssumptionStatus[]): string {
  const fy = fyLabel(report.currentFyEnding)

  const summaryRows = stale.map(item => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">${item.label}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;font-weight:600;color:${STATUS_COLOR[item.status]};">${item.status}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;color:#888;">${item.fyBehind} FY</td>
    </tr>`).join('')

  const promptBlocks = stale.map(item => `
    <div style="background:#fff;border-radius:8px;padding:20px;border:1px solid #e0e0e0;margin-bottom:12px;">
      <div style="font-size:0.85rem;font-weight:600;margin-bottom:6px;">📋 ${item.label}</div>
      ${item.authorityUrl
        ? `<div style="font-size:0.75rem;color:#666;margin-bottom:8px;">Verify: <a href="${item.authorityUrl}" style="color:#2980b9;">${item.authorityUrl}</a></div>`
        : ''}
      <pre style="background:#f8f8f8;border:1px solid #e8e8e8;border-radius:4px;padding:12px;font-size:0.72rem;white-space:pre-wrap;word-break:break-word;margin:0;line-height:1.5;">${buildPrompt(item, report.currentFyEnding)}</pre>
    </div>`).join('')

  return `<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:20px;">

  <div style="background:#fff;border-radius:8px;padding:20px 24px;border:1px solid #e0e0e0;margin-bottom:12px;">
    <div style="font-size:1.1rem;font-weight:600;margin-bottom:2px;">Proviso Watchdog</div>
    <div style="font-size:0.78rem;color:#888;">FY${fy} · checked ${report.now} · ${stale.length} item${stale.length !== 1 ? 's' : ''} need review</div>
  </div>

  <div style="background:#fff;border-radius:8px;padding:20px;border:1px solid #e0e0e0;margin-bottom:12px;">
    <div style="font-size:0.8rem;font-weight:600;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.04em;color:#555;">Stale assumptions</div>
    <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
      <thead>
        <tr style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.04em;color:#aaa;">
          <th align="left" style="padding:4px 8px;">Assumption</th>
          <th align="left" style="padding:4px 8px;">Status</th>
          <th align="left" style="padding:4px 8px;">Behind</th>
        </tr>
      </thead>
      <tbody>${summaryRows}</tbody>
    </table>
  </div>

  <div style="font-size:0.78rem;color:#555;margin:8px 0 12px;padding:0 2px;">
    Copy the prompt for each stale item into <strong>Claude.ai</strong> or <strong>Gemini</strong> to get the exact code change needed.
  </div>

  ${promptBlocks}

  <div style="font-size:0.72rem;color:#aaa;text-align:center;padding:12px 0;">
    Proviso developer watchdog — internal tooling only
  </div>

</div>
</body>
</html>`
}

export function buildPrompt(item: AssumptionStatus, currentFyEnding: number): string {
  const currFy = fyLabel(currentFyEnding)
  const calFy = fyLabel(item.calibratedFyEnding)
  return `You are helping me maintain Proviso, an Australian household finance dashboard.
An ATO/ABS assumption in the codebase may need updating for FY${currFy}.

Assumption: ${item.label}
Currently in codebase (calibrated for FY${calFy}):
  ${item.currentValue}
Authority: ${item.authority}${item.authorityUrl ? `\nSource URL: ${item.authorityUrl}` : ''}
Code location: ${item.location}
Review trigger: ${item.reviewTrigger}${item.notes ? `\nNote: ${item.notes}` : ''}

Has this changed for FY${currFy}?
1. What is the new value (if changed)?
2. What is the exact code change to apply at: ${item.location}?
3. What should calibratedFyEnding be set to in lib/watchdog.ts?`
}
