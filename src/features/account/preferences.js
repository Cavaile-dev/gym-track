export const defaultPreferences = {
  restDuration: 90,
  reduceMotion: false,
  customRestDuration: null,
}

export const validRestDuration = (value) => Number.isInteger(value) && value >= 1 && value <= 3600

export function readPreferences(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(`gym-track:preferences:${userId}`))
    return {
      restDuration: validRestDuration(saved?.restDuration) ? saved.restDuration : 90,
      customRestDuration: validRestDuration(saved?.customRestDuration)
        ? saved.customRestDuration
        : validRestDuration(saved?.restDuration) && ![60, 90, 120].includes(saved.restDuration)
          ? saved.restDuration
          : null,
      reduceMotion: saved?.reduceMotion === true,
    }
  } catch {
    return { ...defaultPreferences }
  }
}

export function savePreferences(userId, preferences) {
  localStorage.setItem(`gym-track:preferences:${userId}`, JSON.stringify(preferences))
}
