// HTTP client for the Decoinks Task API. Token lives in localStorage.
const BASE = '/api'
let token = localStorage.getItem('dk_token')

export function setToken(t) {
  token = t
  if (t) localStorage.setItem('dk_token', t)
  else localStorage.removeItem('dk_token')
}
export function hasToken() {
  return Boolean(token)
}

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...opts.headers,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || res.statusText)
  return data
}

export const api = {
  login: (email, password) =>
    req('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => req('/auth/me'),
  stats: () => req('/tasks/stats'),
  tasks: (params = {}) => req('/tasks?' + new URLSearchParams(params)),
  task: (id) => req('/tasks/' + id),
  createTask: (payload) => req('/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  transition: (id, body) =>
    req(`/tasks/${id}/transition`, { method: 'POST', body: JSON.stringify(body) }),
  assignTask: (id, body) =>
    req(`/tasks/${id}/assign`, { method: 'POST', body: JSON.stringify(body) }),
  comment: (id, text, audioData, audioTranscript) =>
    req(`/tasks/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        commentText: text,
        ...(audioData ? { audioData } : {}),
        ...(audioData && audioTranscript ? { audioTranscript } : {}),
      }),
    }),
  transcribe: (audioData) =>
    req('/transcribe', { method: 'POST', body: JSON.stringify({ audioData }) }),
  toggleChecklist: (taskId, itemId, isCompleted) =>
    req(`/tasks/${taskId}/checklist/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isCompleted }),
    }),
  notifications: () => req('/notifications'),
  markNotificationsRead: () => req('/notifications/read-all', { method: 'POST' }),
  remind: (taskId) => req(`/tasks/${taskId}/remind`, { method: 'POST' }),
  assignableUsers: () => req('/users?assignable=1'),
  workload: () => req('/users/workload'),
  users: () => req('/users'),
  inviteUser: (payload) => req('/users', { method: 'POST', body: JSON.stringify(payload) }),
  departments: () => req('/admin/departments'),
  createDepartment: (payload) => req('/admin/departments', { method: 'POST', body: JSON.stringify(payload) }),
  reports: () => req('/admin/reports'),
  activity: () => req('/admin/activity'),
  // Task templates (blueprints that create tasks)
  templates: (params = {}) => req('/templates?' + new URLSearchParams(params)),
  createTemplate: (payload) => req('/templates', { method: 'POST', body: JSON.stringify(payload) }),
  updateTemplate: (id, payload) => req(`/templates/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteTemplate: (id) => req(`/templates/${id}`, { method: 'DELETE' }),
  instantiateTemplate: (id, payload) => req(`/templates/${id}/instantiate`, { method: 'POST', body: JSON.stringify(payload) }),
}
