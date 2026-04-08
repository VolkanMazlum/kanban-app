const BASE = "/api";

async function req(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const login = (data) => req("/login", { method: "POST", body: JSON.stringify(data) });
export const logout = () => req("/logout", { method: "POST" });

export const getTasks = (params = {}) => req(`/tasks${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ""}`);
export const getTask = (id) => req(`/tasks/${id}`);
export const createTask = (data) => req("/tasks", { method: "POST", body: JSON.stringify(data) });
export const updateTask = (id, data) => req(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const patchTaskStatus = (id, status) => req(`/tasks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
export const deleteTask = (id) => req(`/tasks/${id}`, { method: "DELETE" });

export const getEmployees = () => req(`/employees?t=${Date.now()}`);
export const createEmployee = (name, position, category = "internal") => req("/employees", { method: "POST", body: JSON.stringify({ name, position, category }) });
export const deleteEmployee = (id) => req(`/employees/${id}`, { method: "DELETE" });

export const getKPI = (year, month) => {
  const params = new URLSearchParams();
  if (year) params.append("year", year);
  if (month) params.append("month", month);
  const q = params.toString();
  return req(`/kpi${q ? `?${q}` : ""}`);
};

export const getTimeLogs = (params = {}) => req(`/time-logs${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ""}`);
export const logTime = (data) => req("/time-logs", { method: "POST", body: JSON.stringify(data) });

export const getPhaseTemplates = () => req("/phase-templates");
export const getTaskPhases = (taskId) => req(`/tasks/${taskId}/phases`);
export const saveTaskPhases = (taskId, phases) => req(`/tasks/${taskId}/phases`, {
  method: "POST",
  body: JSON.stringify({ phases })
});
export const updatePhase = (taskId, id, data) => req(`/tasks/${taskId}/phases/${id}`, {
  method: "PATCH",
  body: JSON.stringify(data)
});

export const getSettings = () => req("/settings");
export const getAvailableYears = () => req("/settings/years");
export const updateSetting = (key, value) => req(`/settings/${key}`, {
  method: "PATCH",
  body: JSON.stringify({ value })
});


export const getMonthlyWorkload = (year, month) => {
  return req(`/kpi/workload-monthly?year=${year}&month=${month}`);
};

export const getCosts = (year) => {
  const url = year ? `/costs?year=${year}` : "/costs";
  return req(url);
};

export const addEmployeeCost = (employeeId, data) => {
  return req(`/costs/${employeeId}`, {
    method: "POST",
    body: JSON.stringify(data)
  });
};

export const saveWorkHours = (data) => req("/work-hours", { method: "POST", body: JSON.stringify(data) });
export const getWorkHours = (employeeId, year, month) => req(`/work-hours/${employeeId}?year=${year}&month=${month}`);

export const getOvertimeCosts = (employeeId, year) => {
  return req(`/costs/${employeeId}/overtime?year=${year}`);
};

export const saveOvertimeCost = (employeeId, data) => {
  return req(`/costs/${employeeId}/overtime`, {
    method: "POST",
    body: JSON.stringify(data)
  });
};

export const getEmployeeExtraCosts = (employeeId, year) => {
  const url = year ? `/costs/${employeeId}/extra?year=${year}` : `/costs/${employeeId}/extra`;
  return req(url);
};

export const saveEmployeeExtraCost = (employeeId, data) => {
  return req(`/costs/${employeeId}/extra`, {
    method: "POST",
    body: JSON.stringify(data)
  });
};

export const deleteEmployeeExtraCost = (id) => {
  return req(`/costs/extra/${id}`, {
    method: "DELETE"
  });
};

export const getTaskFinances = (year, startDate, endDate) => {
  const params = new URLSearchParams();
  if (year) params.append("year", year);
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const qs = params.toString();
  return req(`/task-finances${qs ? `?${qs}` : ""}`);
};

export const saveTaskRevenue = (taskId, data) => {
  return req(`/task-finances/${taskId}`, {
    method: "POST",
    body: JSON.stringify(data)
  });
};

export const savePhaseMonthlyHours = (phaseId, data) =>
  req(`/phases/${phaseId}/monthly-hours`, { method: "POST", body: JSON.stringify(data) });
export const getPhaseMonthlyHours = (phaseId) =>
  req(`/phases/${phaseId}/monthly-hours`);

// ── FATTURATO ──
export const getFatturato = (year) => {
  const url = year ? `/fatturato?year=${year}` : "/fatturato";
  return req(url);
};

export const getFatturatoByTask = (year, startDate, endDate) => {
  const params = new URLSearchParams();
  if (year) params.append("year", year);
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const qs = params.toString();
  return req(`/fatturato/by-task${qs ? `?${qs}` : ""}`);
};

export const createFatturato = (data) => {
  return req("/fatturato", {
    method: "POST",
    body: JSON.stringify(data)
  });
};

export const updateFatturato = (id, data) => {
  return req(`/fatturato/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
};

export const deleteFatturato = (id) => {
  return req(`/fatturato/${id}`, {
    method: "DELETE"
  });
};

// ── FATTURATO ORDINI (percentage-based installments per attivita) ──
export const getLineOrdini = (lineId) => req(`/fatturato-lines/${lineId}/ordini`);
export const createOrdine = (lineId, data) => req(`/fatturato-lines/${lineId}/ordini`, { method: "POST", body: JSON.stringify(data) });
export const updateOrdine = (id, data) => req(`/fatturato-ordini/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteOrdine = (id) => req(`/fatturato-ordini/${id}`, { method: "DELETE" });



// ── CLIENTS ──
export const getClients = () => {
  return req("/clients");
};

export const getClient = (id) => {
  return req(`/clients/${id}`);
};

export const createClient = (data) => {
  return req("/clients", {
    method: "POST",
    body: JSON.stringify(data)
  });
};

export const updateClient = (id, data) => {
  return req(`/clients/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
};

export const deleteClient = (id) => {
  return req(`/clients/${id}`, {
    method: "DELETE"
  });
};

// ── USERS ──
export const getUsers = () => req("/users");
export const createUser = (data) => req("/users", { method: "POST", body: JSON.stringify(data) });
export const updateUser = (id, data) => req(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) });

// ── REPORTS ──
export const exportTasks = () => `${BASE}/reports/tasks`;
export const exportFinances = (year) => `${BASE}/reports/finances${year ? `?year=${year}` : ""}`;
export const exportWorkload = (year) => `${BASE}/reports/workload${year ? `?year=${year}` : ""}`;
export const exportEmployees = () => `${BASE}/reports/employees`;
export const exportClients = () => `${BASE}/reports/clients`;

// ── SAL & OBIETTIVI ──
export const getMonthlySAL = (year, month) => req(`/fatturato-sal?year=${year}${month ? `&month=${month}` : ""}`);
export const updateMonthlySAL = (data) => req("/fatturato-sal/bulk", { method: "POST", body: JSON.stringify(data) });
export const deleteMonthlySAL = (id) => req(`/fatturato-sal/${id}`, { method: "DELETE" });
export const getProjectObiettivi = (commId) => req(`/commesse/${commId}/obiettivi`);
export const updateProjectObiettivi = (commId, data) => req(`/commesse/${commId}/obiettivi`, { method: "POST", body: JSON.stringify(data) });
export const updateLineObiettiviBulk = (lineId, data) => req(`/fatturato-lines/${lineId}/obiettivi/bulk`, { method: "POST", body: JSON.stringify(data) });

// ── OFFERTE ──
export const getOfferteSummary = () => req("/offerte/summary");
export const getPreventiviEsistenti = () => req("/offerte/preventivi-esistenti");
export const getOfferte = (anno, status) => {
  const query = [];
  if (anno && anno !== 'all') query.push(`anno=${anno}`);
  if (status && status !== 'all') query.push(`status=${status}`);
  return req(`/offerte${query.length ? '?' + query.join('&') : ''}`);
};
export const createOfferta = (data) => req("/offerte", { method: "POST", body: JSON.stringify(data) });
export const updateOfferta = (id, data) => req(`/offerte/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteOfferta = (id) => req(`/offerte/${id}`, { method: "DELETE" });
export const acceptOfferta = (id) => req(`/offerte/${id}/accept`, { method: "POST" });

// ── AUDIT LOGS ──
export const getAuditLogs = (limit = 100) => req(`/audit-logs?limit=${limit}`);
