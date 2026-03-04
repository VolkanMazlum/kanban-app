const BASE = "/api";
// Get credentials from environment variables (in production, these would be set on the server)
const AUTH_USERNAME = import.meta.env.VITE_AUTH_USERNAME ;
const AUTH_PASSWORD = import.meta.env.VITE_AUTH_PASSWORD ;

// Encode credentials for Basic Auth
const encodeCredentials = (username, password) => {
  return btoa(`${username}:${password}`);
};

async function req(path, options = {}) {
  const defaultHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Basic ${encodeCredentials(AUTH_USERNAME, AUTH_PASSWORD)}`
  };
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),  // extra header'lar merge edilir
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const getTasks        = (params = {}) => req(`/tasks${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ""}`);
export const getTask         = (id) => req(`/tasks/${id}`);
export const createTask      = (data) => req("/tasks",       { method: "POST",   body: JSON.stringify(data) });
export const updateTask      = (id, data) => req(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const patchTaskStatus = (id, status) => req(`/tasks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
export const deleteTask      = (id) => req(`/tasks/${id}`,  { method: "DELETE" });

export const getEmployees    = ()       => req("/employees");
export const createEmployee  = (name, role) => req("/employees", { method: "POST", body: JSON.stringify({ name, role }) });
export const deleteEmployee  = (id)    => req(`/employees/${id}`, { method: "DELETE" });

//export const getKPI          = ()       => req("/kpi");
export const getKPI = () => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  const headers = hrAuth ? { "X-HR-Auth": hrAuth } : {};
  return req("/kpi", { headers });
};

export const getTimeLogs     = (params = {}) => req(`/time-logs${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ""}`);
export const logTime         = (data) => req("/time-logs", { method: "POST", body: JSON.stringify(data) });

export const getPhaseTemplates  = () => req("/phase-templates");
export const getTaskPhases      = (taskId) => req(`/tasks/${taskId}/phases`);
export const saveTaskPhases     = (taskId, phases) => req(`/tasks/${taskId}/phases`, {
  method: "POST",
  body: JSON.stringify({ phases })
});
export const updatePhase        = (taskId, id, data) => req(`/tasks/${taskId}/phases/${id}`, {
  method: "PATCH",
  body: JSON.stringify(data)
});
export const getSettings        = () => req("/settings");
export const updateSetting       = (key, value) => req(`/settings/${key}`, {
  method: "PATCH",
  body: JSON.stringify({ value })
});
//export const getWorkloadMonthly = (year, month) => req(`/kpi/workload-monthly?year=${year}&month=${month}`);
export const getMonthlyWorkload = (year, month) => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  const headers = hrAuth ? { "X-HR-Auth": hrAuth } : {};
  return req(`/kpi/workload-monthly?year=${year}&month=${month}`, { headers });
};
