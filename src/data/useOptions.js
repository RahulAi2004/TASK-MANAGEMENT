// The editable dropdown lists (type of work, category, linked to, reason for delay), shared by every
// screen: an option added in one form shows up in all the others straight away.
import { useEffect, useState } from 'react'
import { api } from './api'
import { t as tr } from '../i18n'

let options = []
let inFlight = null
const listeners = new Set()
const publish = (next) => {
  options = next
  listeners.forEach((fn) => fn(options))
}

function load() {
  if (!inFlight) {
    inFlight = api
      .options()
      .then((d) => publish(d.options))
      .finally(() => { inFlight = null })
  }
  return inFlight
}

/** What people read for a stored value. */
export const optionLabel = (list, value) => (list === 'linkedTo' && value === 'General' ? tr('Nothing specific') : tr(value))

export function useOptions() {
  const [all, setAll] = useState(options)
  useEffect(() => {
    listeners.add(setAll)
    setAll(options)
    load().catch(() => {}) // keep what we have; a form still shows its current value
    return () => listeners.delete(setAll)
  }, [])
  return {
    all,
    /** Option texts someone can pick from today */
    active: (list) => all.filter((o) => o.list === list && o.isActive).map((o) => o.value),
    add: async (list, value) => {
      const { option } = await api.addOption({ list, value })
      publish([...options.filter((o) => o.id !== option.id), option])
      return option
    },
    setActive: async (id, isActive) => {
      const { option } = await api.updateOption(id, { isActive })
      publish(options.map((o) => (o.id === option.id ? option : o)))
    },
  }
}
