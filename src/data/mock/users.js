// Seed users. Avatars are initials-based (no external images).
export const users = {
  'USR-0001': { id: 'USR-0001', name: 'Areeba Khan', role: 'Sales Manager', color: '#2564CF' },
  'USR-0002': { id: 'USR-0002', name: 'Bilal Ahmed', role: 'Manager', color: '#5B4BE6' },
  'USR-0010': { id: 'USR-0010', name: 'Hassan Raza', role: 'Designer', color: '#107C10' },
  'USR-0021': { id: 'USR-0021', name: 'Sana Malik', role: 'Designer', color: '#E8710A' },
  'USR-0030': { id: 'USR-0030', name: 'QA User 01', role: 'QA', color: '#C19C00' },
  'USR-0031': { id: 'USR-0031', name: 'QA User 02', role: 'QA', color: '#D13438' },
}

export const currentUser = users['USR-0001']

export function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
