const blockedTerms = (process.env.CHAT_BLOCKED_TERMS || '')
  .normalize('NFKC')
  .toLowerCase()
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
export function blockedMessage(message) {
  const normalized = message.normalize('NFKC').toLowerCase();
  return blockedTerms.some((term) => normalized.includes(term));
}
