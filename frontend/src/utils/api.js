const BASE = 'http://localhost:4000';
async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
export const api = {
  getWorkItems:  ()       => request('/api/work-items'),
  getWorkItem:   (id)     => request(`/api/work-items/${id}`),
  transition:    (id, ns) => request(`/api/work-items/${id}/transition`, { method: 'PATCH', body: { nextState: ns } }),
  submitRCA:     (id, b)  => request(`/api/rca/${id}`, { method: 'POST', body: b }),
  getRCA:        (id)     => request(`/api/rca/${id}`),
  getCategories: ()       => request('/api/rca/categories'),
  sendSignal:    (s)      => request('/api/signals', { method: 'POST', body: s }),
  sendBatch:     (arr)    => request('/api/signals/batch', { method: 'POST', body: arr }),
  getHealth:     ()       => request('/health'),
  getTimeSeries: ()       => request('/api/timeseries'),
};
