// Judge authentication utilities
import type { Judge, JudgeSession } from "./types"
import { getEventData } from "./store"

export const authenticateJudge = (token: string, pin?: string): JudgeSession | null => {
  const event = getEventData()
  const judge = event.judges.find((j) => j.token === token)

  if (!judge) return null

  // If judge has a PIN, verify it
  if (judge.pin && pin !== judge.pin) {
    return null
  }

  return {
    judgeId: judge.id,
    judge,
    eventId: event.id,
    authenticated: true,
  }
}

export const getJudgeByToken = (token: string): Judge | null => {
  const event = getEventData()
  return event.judges.find((j) => j.token === token) || null
}
