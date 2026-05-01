// Build a wa.me URL.
// We strip everything but digits because WhatsApp expects E.164 (no leading +
// nor formatting). The user's WhatsApp client will validate further.
export function buildWaMeUrl(phone: string, body: string): string {
  const digits = phone.replace(/\D/g, '')
  const encoded = encodeURIComponent(body)
  return `https://wa.me/${digits}?text=${encoded}`
}
