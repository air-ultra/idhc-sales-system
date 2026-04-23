const API_BASE = '/api';

const getToken = () => localStorage.getItem('token');

const api = async (path, options = {}) => {
  const token = getToken();
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  };

  const res = await fetch(`${API_BASE}${path}`, config);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
};

export const login = (username, password) =>
  api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

export const getMe = () => api('/auth/me');

export const changePassword = (currentPassword, newPassword) =>
  api('/auth/change-password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  });

export const getStaffList = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api(`/staff?${query}`);
};

export const getStaff = (id) => api(`/staff/${id}`);

export const createStaff = (data) =>
  api('/staff', { method: 'POST', body: JSON.stringify(data) });

export const updateStaff = (id, data) =>
  api(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteStaff = (id) =>
  api(`/staff/${id}`, { method: 'DELETE' });

export const getDepartments = () => api('/staff/departments/list');

export const getUsers = () => api('/users');

export const createUser = (data) =>
  api('/users', { method: 'POST', body: JSON.stringify(data) });

export default api;

// Staff Detail APIs
export const getStaffContact = (id) => api(`/staff/${id}/contact`);
export const saveStaffContact = (id, data) =>
  api(`/staff/${id}/contact`, { method: 'PUT', body: JSON.stringify(data) });

export const getStaffAddress = (id) => api(`/staff/${id}/address`);
export const saveStaffAddress = (id, data) =>
  api(`/staff/${id}/address`, { method: 'PUT', body: JSON.stringify(data) });

export const getStaffEmployment = (id) => api(`/staff/${id}/employment`);
export const saveStaffEmployment = (id, data) =>
  api(`/staff/${id}/employment`, { method: 'PUT', body: JSON.stringify(data) });

export const getStaffSalary = (id) => api(`/staff/${id}/salary`);
export const saveStaffSalary = (id, data) =>
  api(`/staff/${id}/salary`, { method: 'PUT', body: JSON.stringify(data) });

export const getStaffHistory = (id) => api(`/staff/${id}/history`);

export const getStaffNotes = (id) => api(`/staff/${id}/notes`);
export const createStaffNote = (id, content) =>
  api(`/staff/${id}/notes`, { method: 'POST', body: JSON.stringify({ content }) });

// Document APIs
export const getStaffDocuments = (id) => api(`/staff/${id}/documents`);
export const uploadStaffDocument = async (id, file, documentType) => {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('document_type', documentType);
  const res = await fetch(`/api/staff/${id}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
};
export const deleteStaffDocument = (id, docId) =>
  api(`/staff/${id}/documents/${docId}`, { method: 'DELETE' });

// User Management APIs
export const getRoles = () => api('/users/roles');
export const updateUser = (id, data) =>
  api(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const resetUserPassword = (id, newPassword) =>
  api(`/users/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({ newPassword }) });

// Role Permissions APIs
export const getRolePermissions = (roleId) => api(`/users/roles/${roleId}/permissions`);
export const saveRolePermissions = (roleId, permissionIds) =>
  api(`/users/roles/${roleId}/permissions`, { method: 'PUT', body: JSON.stringify({ permission_ids: permissionIds }) });

// Payroll APIs
export const getPayroll = (year, month) => api(`/payroll?year=${year}&month=${month}`);
export const generatePayroll = (year, month) =>
  api('/payroll/generate', { method: 'POST', body: JSON.stringify({ year, month }) });
export const updatePayrollItem = (id, data) =>
  api(`/payroll/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const approvePayroll = (year, month) =>
  api(`/payroll/approve/${year}/${month}`, { method: 'PUT' });
export const getStaffPayroll = (staffId) => api(`/payroll/staff/${staffId}`);
export const getWithholdingCert = (staffId, year) => api(`/payroll/cert/${staffId}/${year}`);
