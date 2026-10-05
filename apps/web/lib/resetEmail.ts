import { Resend } from 'resend'

// Sends a password reset link to a user's email via Resend.
// If RESEND_API_KEY is not configured, logs the token to stdout so the CFO
// can relay it manually (supports self-hosted instances without email).
export async function sendResetEmail(to: string, resetUrl: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log(`[Proviso] Password reset requested. No RESEND_API_KEY set. Reset URL: ${resetUrl}`)
    return
  }

  const resend = new Resend(apiKey)
  const from = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

  await resend.emails.send({
    from,
    to,
    subject: 'Reset your Proviso password',
    html: buildHtml(resetUrl),
  })
}

function buildHtml(resetUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:480px;margin:0 auto;padding:40px 20px;">
  <div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e0e0e0;">
    <div style="font-size:1.1rem;font-weight:600;margin-bottom:8px;">Reset your password</div>
    <p style="font-size:0.85rem;color:#555;margin:0 0 24px;line-height:1.6;">
      Someone requested a password reset for your Proviso account.
      Click the button below to set a new password. This link expires in 1 hour.
    </p>
    <a href="${resetUrl}"
       style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
              padding:10px 22px;border-radius:6px;font-size:0.85rem;font-weight:500;">
      Reset password
    </a>
    <p style="font-size:0.75rem;color:#aaa;margin:24px 0 0;line-height:1.5;">
      If you didn't request this, you can safely ignore this email.
      Your password won't change until you click the link above.
    </p>
  </div>
  <div style="font-size:0.7rem;color:#aaa;text-align:center;padding:16px 0;">Proviso</div>
</div>
</body>
</html>`
}
