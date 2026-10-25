/**
 * @mention handle for a group member: the bot's visible name ("Tomi" → "tomi"),
 * not its internal profile id ("prueba", "default"). Accents are dropped and only
 * the charset the server's mention parser accepts is kept
 * (`[A-Za-z0-9][A-Za-z0-9._:-]*`, gateway/hosted_room_discussion.py).
 */
export function handleFor(member: { profile: string; displayName?: string }): string {
  const fromName = (member.displayName ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '')
    .replace(/^[^a-z0-9]+/, '')
  return fromName && !['all', 'everyone'].includes(fromName) ? fromName : member.profile
}
