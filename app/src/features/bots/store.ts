import { atom } from 'nanostores'
import { t } from '../../i18n'
import { apiFetch } from '../../lib/api'
import type { Profile } from '../../lib/types'

export const profiles = atom<Profile[]>([])
export const profilesLoading = atom<boolean>(false)
export const profilesError = atom<string>('')

export async function loadProfiles(): Promise<void> {
  profilesLoading.set(true)
  profilesError.set('')
  try {
    const res = await apiFetch<{ profiles: Profile[] }>('/api/profiles')
    profiles.set(res.profiles ?? [])
  } catch (e) {
    profilesError.set(e instanceof Error ? e.message : t('botsStore.loadProfilesFailed'))
  } finally {
    profilesLoading.set(false)
  }
}

/**
 * Create a bot. Like the desktop's create dialog, it clones `cloneFrom` by default
 * (Hermes copies config.yaml, .env and SOUL.md — hermes_cli/profiles.py `_CLONE_CONFIG_FILES`),
 * so the new bot inherits a working model + credentials. Pass `cloneFrom: null` for a blank bot.
 */
export async function createProfile(
  name: string,
  { description, cloneFrom = 'default' }: { description?: string; cloneFrom?: string | null } = {},
): Promise<void> {
  await apiFetch('/api/profiles', {
    method: 'POST',
    body: JSON.stringify({ name, description, clone_from: cloneFrom }),
  })
  // Cloning copies the source bot's SOUL.md too — its persona ("You are Pancho…").
  // The new bot inherits keys and settings, never the identity: give it its own.
  if (cloneFrom) {
    const display = name.charAt(0).toUpperCase() + name.slice(1)
    await apiFetch(`/api/profiles/${encodeURIComponent(name)}/soul`, {
      method: 'PUT',
      body: JSON.stringify({ content: t('bots.defaultSoul', { name: display }) }),
    }).catch(() => undefined)
  }
}
