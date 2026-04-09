export interface BrevoEmailPayload {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  messageId?: string;
  replyTo?: string;
}

export interface BrevoSendResult {
  messageId: string;
}

/**
 * Envia um e-mail via Brevo Transactional Email API v3.
 * Documentação: https://developers.brevo.com/reference/sendtransacemail
 */
export async function sendBrevoEmail(
  payload: BrevoEmailPayload,
  apiKey: string,
): Promise<BrevoSendResult> {
  const fromMatch = payload.from.match(/^(.*?)\s*<(.+)>$/);
  const senderName = fromMatch?.[1]?.trim() || 'MicroFlow';
  const senderEmail = fromMatch?.[2]?.trim() || payload.from;

  const body = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: payload.to }],
    replyTo: { email: payload.replyTo ?? 'suporte@microflow.dev' },
    subject: payload.subject,
    htmlContent: payload.html,
    ...(payload.text ? { textContent: payload.text } : {}),
    ...(payload.messageId ? { headers: { 'Message-ID': payload.messageId } } : {}),
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown error');
    const err = new Error(`Brevo API error ${response.status}: ${errorText}`);
    (err as any).status = response.status;
    throw err;
  }

  const result = await response.json() as { messageId: string };
  return { messageId: result.messageId };
}
