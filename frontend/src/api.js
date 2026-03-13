const BASE = "/api";

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
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

export const getEmployees    = ()           => req("/employees");
export const createEmployee  = (name, role) => req("/employees", { method: "POST", body: JSON.stringify({ name, role }) });
export const deleteEmployee  = (id)         => req(`/employees/${id}`, { method: "DELETE" });

export const getKPI = () => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  const headers = hrAuth ? { "X-HR-Auth": hrAuth } : {};
  return req("/kpi", { headers });
};

export const getTimeLogs = (params = {}) => req(`/time-logs${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ""}`);
export const logTime     = (data) => req("/time-logs", { method: "POST", body: JSON.stringify(data) });

export const getPhaseTemplates = () => req("/phase-templates");
export const getTaskPhases     = (taskId) => req(`/tasks/${taskId}/phases`);
export const saveTaskPhases    = (taskId, phases) => req(`/tasks/${taskId}/phases`, {
  method: "POST",
  body: JSON.stringify({ phases })
});
export const updatePhase = (taskId, id, data) => req(`/tasks/${taskId}/phases/${id}`, {
  method: "PATCH",
  body: JSON.stringify(data)
});

export const getSettings   = () => req("/settings");
export const updateSetting = (key, value) => req(`/settings/${key}`, {
  method: "PATCH",
  body: JSON.stringify({ value })
});

export const getMonthlyWorkload = (year, month) => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  const headers = hrAuth ? { "X-HR-Auth": hrAuth } : {};
  return req(`/kpi/workload-monthly?year=${year}&month=${month}`, { headers });
};

export const getCosts = (year) => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  const url = year ? `/costs?year=${year}` : "/costs";
  return req(url, { headers: hrAuth ? { "X-HR-Auth": hrAuth } : {} });
};

export const addEmployeeCost = (employeeId, data) => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  return req(`/costs/${employeeId}`, {
    method: "POST",
    body: JSON.stringify(data),
    headers: hrAuth ? { "X-HR-Auth": hrAuth } : {}
  });
};

export const saveWorkHours = (data) => req("/work-hours", { method: "POST", body: JSON.stringify(data) });
export const getWorkHours  = (employeeId, year, month) => req(`/work-hours/${employeeId}?year=${year}&month=${month}`);

export const getOvertimeCosts = (employeeId, year) => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  return req(`/costs/${employeeId}/overtime?year=${year}`, {
    headers: hrAuth ? { "X-HR-Auth": hrAuth } : {}
  });
};

export const saveOvertimeCost = (employeeId, data) => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  return req(`/costs/${employeeId}/overtime`, {
    method: "POST",
    body: JSON.stringify(data),
    headers: hrAuth ? { "X-HR-Auth": hrAuth } : {}
  });
};

export const getTaskFinances = (year) => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  const url = year ? `/task-finances?year=${year}` : "/task-finances";
  return req(url, { headers: hrAuth ? { "X-HR-Auth": hrAuth } : {} });
};

export const saveTaskRevenue = (taskId, data) => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  return req(`/task-finances/${taskId}`, {
    method: "POST",
    body: JSON.stringify(data),
    headers: hrAuth ? { "X-HR-Auth": hrAuth } : {}
  });
};

export const savePhaseMonthlyHours = (phaseId, data) =>
  req(`/phases/${phaseId}/monthly-hours`, { method: "POST", body: JSON.stringify(data) });
export const getPhaseMonthlyHours = (phaseId) =>
  req(`/phases/${phaseId}/monthly-hours`);

// ── FATTURATO ──
export const getFatturato = (year) => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  const url = year ? `/fatturato?year=${year}` : "/fatturato";
  return req(url, { headers: hrAuth ? { "X-HR-Auth": hrAuth } : {} });
};

export const getFatturatoByTask = (year) => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  const url = year ? `/fatturato/by-task?year=${year}` : "/fatturato/by-task";
  return req(url, { headers: hrAuth ? { "X-HR-Auth": hrAuth } : {} });
};

export const createFatturato = (data) => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  return req("/fatturato", {
    method: "POST",
    body: JSON.stringify(data),
    headers: hrAuth ? { "X-HR-Auth": hrAuth } : {}
  });
};

export const updateFatturato = (id, data) => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  return req(`/fatturato/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
    headers: hrAuth ? { "X-HR-Auth": hrAuth } : {}
  });
};

export const deleteFatturato = (id) => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  return req(`/fatturato/${id}`, {
    method: "DELETE",
    headers: hrAuth ? { "X-HR-Auth": hrAuth } : {}
  });
};

// ── CLIENTS ──
export const getClients = () => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  return req("/clients", { headers: hrAuth ? { "X-HR-Auth": hrAuth } : {} });
};

export const getClient = (id) => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  return req(`/clients/${id}`, { headers: hrAuth ? { "X-HR-Auth": hrAuth } : {} });
};

export const createClient = (data) => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  return req("/clients", {
    method: "POST",
    body: JSON.stringify(data),
    headers: hrAuth ? { "X-HR-Auth": hrAuth } : {}
  });
};

export const updateClient = (id, data) => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  return req(`/clients/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
    headers: hrAuth ? { "X-HR-Auth": hrAuth } : {}
  });
};

export const deleteClient = (id) => {
  const hrAuth = sessionStorage.getItem("hrAuth");
  return req(`/clients/${id}`, {
    method: "DELETE",
    headers: hrAuth ? { "X-HR-Auth": hrAuth } : {}
  });
};