const BASE = "/api";

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const getTasks        = (params = {}) => req(`/tasks${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ""}`);
export const createTask      = (data) => req("/tasks",       { method: "POST",   body: JSON.stringify(data) });
export const updateTask      = (id, data) => req(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const patchTaskStatus = (id, status) => req(`/tasks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
export const deleteTask      = (id) => req(`/tasks/${id}`,  { method: "DELETE" });

export const getEmployees    = ()       => req("/employees");
export const createEmployee  = (name, role) => req("/employees", { method: "POST", body: JSON.stringify({ name, role }) });
export const deleteEmployee  = (id)    => req(`/employees/${id}`, { method: "DELETE" });

export const getKPI          = ()       => req("/kpi");
