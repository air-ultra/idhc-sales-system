import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation, Navigate } from 'react-router-dom';
import { login as apiLogin, getMe, getStaffList, getStaff, createStaff, updateStaff, deleteStaff, getDepartments, changePassword, getStaffContact, saveStaffContact, getStaffAddress, saveStaffAddress, getStaffEmployment, saveStaffEmployment, getStaffSalary, saveStaffSalary, getStaffHistory, getStaffNotes, createStaffNote, getStaffDocuments, uploadStaffDocument, deleteStaffDocument, getUsers, getRoles, createUser, updateUser, resetUserPassword, getRolePermissions, saveRolePermissions, getPayroll, generatePayroll, updatePayrollItem, approvePayroll, getStaffPayroll, getWithholdingCert } from './api';

const authHeaders = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

/* ========== STYLES ========== */
const styles = {
  global: `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; color: #333; }
    button { cursor: pointer; border: none; outline: none; }
    input, select, textarea { outline: none; font-family: inherit; }
    /* Hide spinner on number inputs */
    input[type=number]::-webkit-outer-spin-button,
    input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    input[type=number] { -moz-appearance: textfield; }
  `,
  loginPage: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)' },
  loginCard: { background: '#fff', borderRadius: 12, padding: '40px 36px', width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
  loginTitle: { fontSize: 24, fontWeight: 700, color: '#1e3a5f', marginBottom: 8, textAlign: 'center' },
  loginSub: { fontSize: 14, color: '#888', marginBottom: 28, textAlign: 'center' },
  inputGroup: { marginBottom: 18 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 },
  input: { width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, transition: 'border 0.2s' },
  btnPrimary: { width: '100%', padding: '12px', background: '#1e3a5f', color: '#fff', borderRadius: 8, fontSize: 15, fontWeight: 600 },
  error: { background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 },
  success: { background: '#ecfdf5', color: '#059669', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 },
  layout: { display: 'flex', minHeight: '100vh' },
  sidebar: { width: 240, background: '#1e3a5f', color: '#fff', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100 },
  sidebarLogo: { padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  sidebarLogoText: { fontSize: 16, fontWeight: 700 },
  sidebarLogoSub: { fontSize: 11, opacity: 0.6, marginTop: 2 },
  sidebarNav: { flex: 1, padding: '12px 0' },
  sidebarItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 14, color: 'rgba(255,255,255,0.7)', textDecoration: 'none', cursor: 'pointer', transition: 'all 0.2s', border: 'none', background: 'none', width: '100%', textAlign: 'left' },
  sidebarItemActive: { background: 'rgba(255,255,255,0.1)', color: '#fff', borderRight: '3px solid #60a5fa' },
  sidebarUser: { padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' },
  sidebarUserName: { fontSize: 13, fontWeight: 600 },
  sidebarUserRole: { fontSize: 11, opacity: 0.6 },
  main: { marginLeft: 240, flex: 1, padding: '24px 32px', minHeight: '100vh' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#1e3a5f' },
  card: { background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid #f0f2f5', background: '#fafbfc' },
  td: { padding: '12px 16px', fontSize: 14, borderBottom: '1px solid #f0f2f5' },
  trHover: { cursor: 'pointer', transition: 'background 0.15s' },
  badge: (color) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
    ...(color === 'green' ? { background: '#ecfdf5', color: '#059669' } :
       color === 'red' ? { background: '#fef2f2', color: '#dc2626' } :
       color === 'blue' ? { background: '#eff6ff', color: '#2563eb' } :
       { background: '#f3f4f6', color: '#6b7280' })
  }),
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: 12, width: 560, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f0f2f5' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#1e3a5f' },
  modalBody: { padding: '24px' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid #f0f2f5' },
  btn: (v) => ({
    padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
    ...(v === 'primary' ? { background: '#1e3a5f', color: '#fff' } :
       v === 'danger' ? { background: '#dc2626', color: '#fff' } :
       v === 'success' ? { background: '#059669', color: '#fff' } :
       { background: '#f3f4f6', color: '#555', border: '1px solid #ddd' })
  }),
  searchBar: { display: 'flex', gap: 12, marginBottom: 20 },
  searchInput: { flex: 1, padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 },
  detailHeader: { padding: '24px', borderBottom: '1px solid #f0f2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  detailAvatar: { width: 64, height: 64, borderRadius: '50%', background: '#1e3a5f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 },
  detailName: { fontSize: 20, fontWeight: 700, color: '#1e3a5f' },
  detailSub: { fontSize: 14, color: '#888', marginTop: 2 },
  tabs: { display: 'flex', borderBottom: '2px solid #f0f2f5', overflowX: 'auto' },
  tab: (a) => ({ padding: '12px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'none', color: a ? '#1e3a5f' : '#888', borderBottom: a ? '2px solid #1e3a5f' : '2px solid transparent', marginBottom: -2, whiteSpace: 'nowrap' }),
  detailGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 32px', padding: 24 },
  fieldLabel: { fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldValue: { fontSize: 15, color: '#333', marginTop: 4 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 },
  statCard: { background: '#fff', borderRadius: 12, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  statValue: { fontSize: 28, fontWeight: 700, color: '#1e3a5f' },
  statLabel: { fontSize: 13, color: '#888', marginTop: 4 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
};

/* ========== LOGIN ========== */
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { const data = await apiLogin(username, password); localStorage.setItem('token', data.token); onLogin(data.user); }
    catch (err) { setError(err.message || 'Login failed'); } finally { setLoading(false); }
  };
  return (
    <div style={styles.loginPage}><div style={styles.loginCard}>
      <div style={styles.loginTitle}>Sales Management</div>
      <div style={styles.loginSub}>เข้าสู่ระบบเพื่อจัดการข้อมูล</div>
      {error && <div style={styles.error}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={styles.inputGroup}><label style={styles.label}>Username</label><input style={styles.input} value={username} onChange={e => setUsername(e.target.value)} placeholder="กรอก username" autoFocus /></div>
        <div style={styles.inputGroup}><label style={styles.label}>Password</label><input style={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="กรอก password" /></div>
        <button type="submit" style={{ ...styles.btnPrimary, opacity: loading ? 0.7 : 1 }} disabled={loading}>{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>
      </form>
    </div></div>
  );
}

/* ========== SIDEBAR ========== */
const menuItems = [
  { key: 'dashboard', icon: '📊', label: 'Dashboard' },
  { key: 'staff', icon: '👥', label: 'Staff Management' },
  { key: 'payroll', icon: '💰', label: 'Payroll' },
  { key: 'stock', icon: '📦', label: 'คลังสินค้า' },
  { key: 'purchase', icon: '🛒', label: 'ใบสั่งซื้อ' },
  { key: 'withholding', icon: '📄', label: 'หัก ณ ที่จ่าย' },
  { key: 'users', icon: '🔐', label: 'User Management' },
  { key: 'settings', icon: '⚙️', label: 'ตั้งค่า' },
];
function Sidebar({ active, onNavigate, user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isOnPurchaseRoute = location.pathname.startsWith('/purchase');
  return (
    <div style={styles.sidebar}>
      <div style={styles.sidebarLogo}><div style={styles.sidebarLogoText}>Sales System</div><div style={styles.sidebarLogoSub}>Management Platform</div></div>
      <nav style={styles.sidebarNav}>
        {menuItems.map(item => {
          const isActive = item.key === 'purchase' ? isOnPurchaseRoute : (active === item.key && !isOnPurchaseRoute);
          const handleClick = () => {
            if (item.key === 'purchase') {
              navigate('/purchase');
            } else {
              if (isOnPurchaseRoute) navigate('/');
              onNavigate(item.key);
            }
          };
          return (
            <button key={item.key} onClick={handleClick} style={{ ...styles.sidebarItem, ...(isActive ? styles.sidebarItemActive : {}) }}>
              <span>{item.icon}</span><span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div style={styles.sidebarUser}>
        <div style={styles.sidebarUserName}>{user?.first_name_th} {user?.last_name_th}</div>
        <div style={styles.sidebarUserRole}>{user?.role_name || user?.role_code}</div>
        <button onClick={onLogout} style={{ ...styles.btn('default'), marginTop: 10, width: '100%', fontSize: 12 }}>ออกจากระบบ</button>
      </div>
    </div>
  );
}

/* ========== DASHBOARD ========== */
function DashboardPage({ staffList }) {
  const active = staffList.filter(s => s.status === 'active').length;
  const depts = [...new Set(staffList.map(s => s.department_name).filter(Boolean))];
  return (
    <div>
      <div style={styles.pageHeader}><h1 style={styles.pageTitle}>Dashboard</h1></div>
      <div style={styles.statsRow}>
        <div style={styles.statCard}><div style={styles.statValue}>{staffList.length}</div><div style={styles.statLabel}>พนักงานทั้งหมด</div></div>
        <div style={styles.statCard}><div style={styles.statValue}>{active}</div><div style={styles.statLabel}>Active</div></div>
        <div style={styles.statCard}><div style={styles.statValue}>{depts.length}</div><div style={styles.statLabel}>แผนก</div></div>
        <div style={styles.statCard}><div style={styles.statValue}>{staffList.length - active}</div><div style={styles.statLabel}>Inactive</div></div>
      </div>
      <div style={styles.card}><div style={{ padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>พนักงานล่าสุด</h3>
        <table style={styles.table}><thead><tr><th style={styles.th}>รหัส</th><th style={styles.th}>ชื่อ</th><th style={styles.th}>แผนก</th><th style={styles.th}>ตำแหน่ง</th><th style={styles.th}>สถานะ</th></tr></thead>
        <tbody>{staffList.slice(0, 5).map(s => (
          <tr key={s.id}><td style={styles.td}>{s.employee_code}</td><td style={styles.td}>{s.first_name_th} {s.last_name_th}</td><td style={styles.td}>{s.department_name || '-'}</td><td style={styles.td}>{s.position || '-'}</td><td style={styles.td}><span style={styles.badge(s.status === 'active' ? 'green' : 'red')}>{s.status}</span></td></tr>
        ))}</tbody></table>
      </div></div>
    </div>
  );
}

/* ========== STAFF LIST ========== */
function StaffListPage({ staffList, onSelect, onRefresh }) {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [departments, setDepartments] = useState([]);
  useEffect(() => { getDepartments().then(d => setDepartments(d.data || [])).catch(() => {}); }, []);
  const filtered = staffList.filter(s => !search || [s.employee_code, s.first_name_th, s.last_name_th, s.first_name_en, s.last_name_en].some(f => f && f.toLowerCase().includes(search.toLowerCase())));
  return (
    <div>
      <div style={styles.pageHeader}><h1 style={styles.pageTitle}>Staff Management</h1><button style={styles.btn('primary')} onClick={() => setShowCreate(true)}>+ เพิ่มพนักงาน</button></div>
      <div style={styles.searchBar}><input style={styles.searchInput} placeholder="ค้นหาพนักงาน..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div style={styles.card}><table style={styles.table}><thead><tr><th style={styles.th}>รหัส</th><th style={styles.th}>ชื่อ-นามสกุล</th><th style={styles.th}>ชื่อ (EN)</th><th style={styles.th}>แผนก</th><th style={styles.th}>ตำแหน่ง</th><th style={styles.th}>สถานะ</th></tr></thead>
      <tbody>{filtered.map(s => (
        <tr key={s.id} style={styles.trHover} onClick={() => onSelect(s.id)} onMouseEnter={e => e.currentTarget.style.background='#f8fafc'} onMouseLeave={e => e.currentTarget.style.background=''}>
          <td style={styles.td}><span style={{ fontWeight: 600, color: '#1e3a5f' }}>{s.employee_code}</span></td>
          <td style={styles.td}>{s.title_th}{s.first_name_th} {s.last_name_th}</td>
          <td style={styles.td}>{s.first_name_en ? `${s.first_name_en} ${s.last_name_en || ''}` : '-'}</td>
          <td style={styles.td}>{s.department_name || '-'}</td><td style={styles.td}>{s.position || '-'}</td>
          <td style={styles.td}><span style={styles.badge(s.status === 'active' ? 'green' : 'red')}>{s.status}</span></td>
        </tr>
      ))}{filtered.length === 0 && <tr><td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: '#888', padding: 40 }}>ไม่พบข้อมูลพนักงาน</td></tr>}</tbody></table></div>
      {showCreate && <CreateStaffModal departments={departments} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); onRefresh(); }} />}
    </div>
  );
}

/* ========== CREATE STAFF MODAL ========== */
function CreateStaffModal({ departments, onClose, onCreated }) {
  const [form, setForm] = useState({ title_th: 'นาย', first_name_th: '', last_name_th: '', nickname_th: '', first_name_en: '', last_name_en: '', department_id: '', position: '', hire_date: '', id_card_number: '', date_of_birth: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const h = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const handleSubmit = async () => {
    setError('');
    if (!form.first_name_th || !form.last_name_th) return setError('กรุณากรอกชื่อและนามสกุล');
    setLoading(true);
    try { await createStaff({ ...form, department_id: form.department_id || null }); onCreated(); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  return (
    <div style={styles.overlay}><div style={styles.modal} onClick={e => e.stopPropagation()}>
      <div style={styles.modalHeader}><span style={styles.modalTitle}>เพิ่มพนักงานใหม่</span><button onClick={onClose} style={{ background: 'none', fontSize: 20, color: '#888' }}>✕</button></div>
      <div style={styles.modalBody}>
        {error && <div style={styles.error}>{error}</div>}
        <div style={styles.formGrid}>
          <div><label style={styles.label}>รหัสพนักงาน</label><div style={{...styles.input, background:'#f3f4f6', color:'#888'}}>Auto-generated</div></div>
          <div><label style={styles.label}>คำนำหน้า</label><select style={styles.input} value={form.title_th} onChange={e => h('title_th', e.target.value)}><option>นาย</option><option>นาง</option><option>นางสาว</option></select></div>
          <div><label style={styles.label}>ชื่อ (TH) *</label><input style={styles.input} value={form.first_name_th} onChange={e => h('first_name_th', e.target.value)} /></div>
          <div><label style={styles.label}>นามสกุล (TH) *</label><input style={styles.input} value={form.last_name_th} onChange={e => h('last_name_th', e.target.value)} /></div>
          <div><label style={styles.label}>ชื่อเล่น (TH)</label><input style={styles.input} value={form.nickname_th} onChange={e => h('nickname_th', e.target.value)} /></div>
          <div><label style={styles.label}>เลขบัตรประชาชน</label><input style={styles.input} value={form.id_card_number} onChange={e => h('id_card_number', e.target.value)} /></div>
          <div><label style={styles.label}>ชื่อ (EN)</label><input style={styles.input} value={form.first_name_en} onChange={e => h('first_name_en', e.target.value)} /></div>
          <div><label style={styles.label}>นามสกุล (EN)</label><input style={styles.input} value={form.last_name_en} onChange={e => h('last_name_en', e.target.value)} /></div>
          <div><label style={styles.label}>แผนก</label><select style={styles.input} value={form.department_id} onChange={e => h('department_id', e.target.value)}><option value="">-- เลือกแผนก --</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div><label style={styles.label}>ตำแหน่ง</label><input style={styles.input} value={form.position} onChange={e => h('position', e.target.value)} /></div>
          <div><label style={styles.label}>วันเกิด</label><input style={styles.input} type="date" value={form.date_of_birth} onChange={e => h('date_of_birth', e.target.value)} /></div>
          <div><label style={styles.label}>วันเริ่มงาน</label><input style={styles.input} type="date" value={form.hire_date} onChange={e => h('hire_date', e.target.value)} /></div>
        </div>
      </div>
      <div style={styles.modalFooter}><button style={styles.btn('default')} onClick={onClose}>ยกเลิก</button><button style={{ ...styles.btn('primary'), opacity: loading ? 0.7 : 1 }} onClick={handleSubmit} disabled={loading}>{loading ? 'กำลังบันทึก...' : 'บันทึก'}</button></div>
    </div></div>
  );
}

/* ========== EDITABLE SUB-TAB COMPONENT ========== */
function EditableTab({ staffId, fetchFn, saveFn, fields, title }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { load(); }, [staffId]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchFn(staffId);
      setData(res.data);
      setForm(res.data || {});
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true); setMsg('');
    try {
      const res = await saveFn(staffId, form);
      setData(res.data);
      setForm(res.data);
      setEditing(false);
      setMsg(res.message || 'บันทึกสำเร็จ');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg('Error: ' + err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>กำลังโหลด...</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f' }}>{title}</h3>
        {!editing && <button style={styles.btn('primary')} onClick={() => setEditing(true)}>แก้ไข</button>}
      </div>
      {msg && <div style={msg.startsWith('Error') ? styles.error : styles.success}>{msg}</div>}
      {!editing ? (
        <div style={styles.detailGrid}>
          {fields.map(f => (
            <div key={f.key}>
              <div style={styles.fieldLabel}>{f.label}</div>
              <div style={styles.fieldValue}>{f.type === 'date' && data?.[f.key] ? new Date(data[f.key]).toLocaleDateString('th-TH') : (data?.[f.key] || '-')}</div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div style={styles.formGrid}>
            {fields.map(f => (
              <div key={f.key}>
                <label style={styles.label}>{f.label}</label>
                {f.type === 'select' ? (
                  <select style={styles.input} value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}>
                    <option value="">-- เลือก --</option>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea style={{ ...styles.input, minHeight: 80 }} value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                ) : f.type === 'date' ? (
                  <input style={styles.input} type="date" value={form[f.key] ? String(form[f.key]).substring(0, 10) : ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                ) : (
                  <input style={styles.input} type={f.type || 'text'} value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <button style={styles.btn('default')} onClick={() => { setEditing(false); setForm(data || {}); }}>ยกเลิก</button>
            <button style={{ ...styles.btn('success'), opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== CONTACT FIELDS ========== */
const contactFields = [
  { key: 'mobile_phone', label: 'เบอร์มือถือ' },
  { key: 'email', label: 'อีเมล' },
  { key: 'line_id', label: 'Line ID' },
  { key: 'address', label: 'ที่อยู่', type: 'textarea' },
  { key: 'emergency_contact_name', label: 'ผู้ติดต่อฉุกเฉิน' },
  { key: 'emergency_contact_phone', label: 'เบอร์ผู้ติดต่อฉุกเฉิน' },
];

/* ========== ADDRESS FIELDS ========== */
const addressFields = [
  { key: 'house_no', label: 'เลขที่' },
  { key: 'moo', label: 'หมู่ที่' },
  { key: 'soi', label: 'ซอย' },
  { key: 'intersection', label: 'แยก' },
  { key: 'road', label: 'ถนน' },
  { key: 'sub_district', label: 'ตำบล/แขวง' },
  { key: 'district', label: 'อำเภอ/เขต' },
  { key: 'province', label: 'จังหวัด' },
  { key: 'postal_code', label: 'รหัสไปรษณีย์' },
];

/* ========== EMPLOYMENT FIELDS ========== */
const employmentFields = [
  { key: 'hire_date', label: 'วันที่เริ่มงาน', type: 'date' },
  { key: 'department', label: 'แผนก' },
  { key: 'position', label: 'ตำแหน่ง' },
  { key: 'payment_channel', label: 'ช่องทางการจ่าย', type: 'select', options: ['โอนเงิน', 'เงินสด', 'เช็ค'] },
  { key: 'bank_name', label: 'ธนาคาร', type: 'select', options: ['ธ.กรุงเทพ', 'ธ.กสิกรไทย', 'ธ.ไทยพาณิชย์', 'ธ.กรุงไทย', 'ธ.ทหารไทยธนชาต', 'ธ.กรุงศรีอยุธยา'] },
  { key: 'bank_account_no', label: 'เลขที่บัญชี' },
  { key: 'bank_account_type', label: 'ประเภทบัญชี', type: 'select', options: ['บัญชีออมทรัพย์', 'บัญชีกระแสรายวัน'] },
  { key: 'bank_branch', label: 'สาขา' },
];

/* ========== SALARY TAB (Custom) ========== */
/* ========== TAX CALCULATION ========== */
const TAX_BRACKETS = [
  { min: 0, max: 150000, rate: 0 },
  { min: 150000, max: 300000, rate: 0.05 },
  { min: 300000, max: 500000, rate: 0.10 },
  { min: 500000, max: 750000, rate: 0.15 },
  { min: 750000, max: 1000000, rate: 0.20 },
  { min: 1000000, max: 2000000, rate: 0.25 },
  { min: 2000000, max: 5000000, rate: 0.30 },
  { min: 5000000, max: Infinity, rate: 0.35 },
];

function calcProgressiveTax(netIncome) {
  let tax = 0;
  let details = [];
  for (const b of TAX_BRACKETS) {
    if (netIncome <= b.min) break;
    const taxable = Math.min(netIncome, b.max) - b.min;
    const t = taxable * b.rate;
    tax += t;
    if (taxable > 0) details.push({ range: `${b.min.toLocaleString()}-${b.max === Infinity ? 'ขึ้นไป' : b.max.toLocaleString()}`, rate: (b.rate * 100) + '%', taxable, tax: t });
  }
  return { tax: Math.round(tax), details };
}

function calcTaxSummary(salary, ssMonthly, ssEligible) {
  const monthSalary = parseFloat(salary) || 0;
  const yearlyIncome = monthSalary * 12;
  const expense = Math.min(yearlyIncome * 0.5, 100000);
  const personal = 60000;
  const ssYearly = ssEligible ? (parseFloat(ssMonthly) || 0) * 12 : 0;
  const netIncome = Math.max(yearlyIncome - expense - personal - ssYearly, 0);
  const { tax: yearlyTax, details } = calcProgressiveTax(netIncome);
  const monthlyTax = Math.round(yearlyTax / 12);
  return { yearlyIncome, expense, personal, ssYearly, netIncome, yearlyTax, monthlyTax, details };
}

function SalaryTab({ staffId }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [showTaxDetail, setShowTaxDetail] = useState(false);

  useEffect(() => { load(); }, [staffId]);

  const load = async () => {
    setLoading(true);
    try { const res = await getStaffSalary(staffId); setData(res.data); setForm(res.data || {}); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const calcSS = (salary, rate, maxSalary) => {
    const s = parseFloat(salary) || 0;
    const r = parseFloat(rate) || 5;
    const m = parseFloat(maxSalary) || 17500;
    return Math.round(Math.min(s, m) * r / 100);
  };

  const handleSave = async () => {
    setSaving(true); setMsg('');
    try {
      const isEligible = form.social_security_eligible === true || form.social_security_eligible === 'true';
      const ssAmount = isEligible ? calcSS(form.salary, form.ss_rate, form.ss_max_salary) : 0;
      const taxInfo = calcTaxSummary(form.salary, ssAmount, isEligible);
      const autoCalc = form.auto_calc_tax === true || form.auto_calc_tax === 'true';
      const wht = autoCalc ? taxInfo.monthlyTax : (parseFloat(form.withholding_tax) || 0);
      const payload = { ...form, social_security_eligible: isEligible, social_security: ssAmount, withholding_tax: wht, tax_condition: autoCalc ? 'คำนวณอัตโนมัติ (ขั้นบันได)' : form.tax_condition };
      const res = await saveStaffSalary(staffId, payload);
      setData(res.data); setForm(res.data); setEditing(false);
      setMsg('บันทึกข้อมูลเงินเดือนสำเร็จ');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg('Error: ' + err.message); }
    finally { setSaving(false); }
  };

  const h = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const isEligible = form.social_security_eligible === true || form.social_security_eligible === 'true';
  const autoCalc = form.auto_calc_tax === true || form.auto_calc_tax === 'true';
  const ssMonthly = isEligible ? calcSS(form.salary, form.ss_rate || 5, form.ss_max_salary || 17500) : 0;
  const taxInfo = calcTaxSummary(form.salary, ssMonthly, isEligible);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>กำลังโหลด...</div>;

  const fmtNum = (v) => v ? parseFloat(v).toLocaleString('th-TH') : '0';
  const fmtB = (v) => (v || 0).toLocaleString('th-TH');
  const boxStyle = { background: '#f8fafc', borderRadius: 8, padding: 16, marginTop: 16 };
  const summaryRow = { display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 };
  const hrStyle = { border: 'none', borderTop: '1px dashed #ddd', margin: '8px 0' };

  // View for saved data
  const viewTax = data ? calcTaxSummary(data.salary, data.social_security, data.social_security_eligible) : null;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f' }}>ข้อมูลเงินเดือน</h3>
        {!editing && <button style={styles.btn('primary')} onClick={() => setEditing(true)}>แก้ไข</button>}
      </div>
      {msg && <div style={msg.startsWith('Error') ? styles.error : styles.success}>{msg}</div>}

      {!editing ? (
        <div>
          <div style={styles.detailGrid}>
            <div><div style={styles.fieldLabel}>ประเภทพนักงาน</div><div style={styles.fieldValue}>{data?.employee_type === 'monthly' ? 'รายเดือน' : data?.employee_type === 'daily' ? 'รายวัน' : data?.employee_type || '-'}</div></div>
            <div><div style={styles.fieldLabel}>เงินเดือน/ค่าจ้าง</div><div style={styles.fieldValue}>{fmtNum(data?.salary)} บาท</div></div>
            <div><div style={styles.fieldLabel}>ประกันสังคม</div><div style={styles.fieldValue}><span style={styles.badge(data?.social_security_eligible ? 'green' : 'red')}>{data?.social_security_eligible ? 'มี' : 'ไม่มี'}</span></div></div>
            {data?.social_security_eligible && (
              <>
                <div><div style={styles.fieldLabel}>อัตราสมทบ (%)</div><div style={styles.fieldValue}>{data?.ss_rate || 5}%</div></div>
                <div><div style={styles.fieldLabel}>ฐานเงินเดือนสูงสุด</div><div style={styles.fieldValue}>{fmtNum(data?.ss_max_salary)} บาท</div></div>
                <div><div style={styles.fieldLabel}>เงินสมทบประกันสังคม</div><div style={{ fontSize: 15, color: '#059669', fontWeight: 600 }}>{fmtNum(data?.social_security)} บาท/เดือน</div></div>
              </>
            )}
            <div><div style={styles.fieldLabel}>หัก ณ ที่จ่ายรายเดือน</div><div style={{ fontSize: 15, color: '#dc2626', fontWeight: 600 }}>{fmtNum(data?.withholding_tax)} บาท</div></div>
            <div><div style={styles.fieldLabel}>เงื่อนไขภาษี</div><div style={styles.fieldValue}>{data?.tax_condition || '-'}</div></div>
          </div>

          {viewTax && data?.salary > 0 && (
            <div style={boxStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f' }}>สรุปการคำนวณภาษี (ประมาณการทั้งปี)</span>
                <button style={{ ...styles.btn('default'), fontSize: 12 }} onClick={() => setShowTaxDetail(!showTaxDetail)}>{showTaxDetail ? 'ซ่อน' : 'ดูรายละเอียด'}</button>
              </div>
              {showTaxDetail && (
                <div style={{ marginTop: 12 }}>
                  <div style={summaryRow}><span>รายได้ทั้งปี ({fmtNum(data?.salary)} x 12)</span><span style={{ fontWeight: 600 }}>{fmtB(viewTax.yearlyIncome)} บาท</span></div>
                  <div style={summaryRow}><span>หักค่าใช้จ่าย (50% ไม่เกิน 100,000)</span><span style={{ color: '#dc2626' }}>-{fmtB(viewTax.expense)} บาท</span></div>
                  <div style={summaryRow}><span>หักค่าลดหย่อนส่วนตัว</span><span style={{ color: '#dc2626' }}>-{fmtB(viewTax.personal)} บาท</span></div>
                  {viewTax.ssYearly > 0 && <div style={summaryRow}><span>หักประกันสังคม ({fmtNum(data?.social_security)} x 12)</span><span style={{ color: '#dc2626' }}>-{fmtB(viewTax.ssYearly)} บาท</span></div>}
                  <hr style={hrStyle} />
                  <div style={{ ...summaryRow, fontWeight: 700 }}><span>เงินได้สุทธิ</span><span>{fmtB(viewTax.netIncome)} บาท</span></div>
                  <hr style={hrStyle} />
                  {viewTax.details.map((d, i) => (
                    <div key={i} style={{ ...summaryRow, fontSize: 13, color: '#666' }}><span>{d.range} ({d.rate})</span><span>{fmtB(d.tax)} บาท</span></div>
                  ))}
                  <hr style={hrStyle} />
                  <div style={{ ...summaryRow, fontWeight: 700, color: '#1e3a5f' }}><span>ภาษีทั้งปี</span><span>{fmtB(viewTax.yearlyTax)} บาท</span></div>
                  <div style={{ ...summaryRow, fontWeight: 700, color: '#dc2626', fontSize: 16 }}><span>หัก ณ ที่จ่ายรายเดือน (÷ 12)</span><span>{fmtB(viewTax.monthlyTax)} บาท</span></div>
                </div>
              )}
            </div>
          )}

          {data?.remarks && <div style={{ marginTop: 16 }}><div style={styles.fieldLabel}>หมายเหตุ</div><div style={styles.fieldValue}>{data.remarks}</div></div>}
        </div>
      ) : (
        <div>
          <div style={styles.formGrid}>
            <div><label style={styles.label}>ประเภทพนักงาน</label>
              <select style={styles.input} value={form.employee_type || ''} onChange={e => h('employee_type', e.target.value)}>
                <option value="">-- เลือก --</option><option value="monthly">รายเดือน</option><option value="daily">รายวัน</option><option value="hourly">รายชั่วโมง</option><option value="contract">สัญญาจ้าง</option>
              </select>
            </div>
            <div><label style={styles.label}>เงินเดือน/ค่าจ้าง (บาท)</label><input style={styles.input} type="number" value={form.salary || ''} onChange={e => h('salary', e.target.value)} /></div>
            <div><label style={styles.label}>ประกันสังคม</label>
              <select style={styles.input} value={String(isEligible)} onChange={e => h('social_security_eligible', e.target.value)}>
                <option value="false">ไม่มี</option><option value="true">มี</option>
              </select>
            </div>
            {isEligible && (
              <>
                <div><label style={styles.label}>อัตราสมทบ (%)</label><input style={styles.input} type="number" step="0.5" value={form.ss_rate || 5} onChange={e => h('ss_rate', e.target.value)} /></div>
                <div><label style={styles.label}>ฐานเงินเดือนสูงสุด (บาท)</label><input style={styles.input} type="number" value={form.ss_max_salary || 17500} onChange={e => h('ss_max_salary', e.target.value)} /></div>
                <div>
                  <label style={styles.label}>เงินสมทบ (คำนวณอัตโนมัติ)</label>
                  <div style={{ ...styles.input, background: '#ecfdf5', color: '#059669', fontWeight: 700, fontSize: 16 }}>
                    {calcSS(form.salary, form.ss_rate || 5, form.ss_max_salary || 17500).toLocaleString('th-TH')} บาท/เดือน
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={{ ...boxStyle, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f' }}>คำนวณภาษีหัก ณ ที่จ่าย</span>
              <select style={{ ...styles.input, width: 'auto' }} value={String(autoCalc)} onChange={e => h('auto_calc_tax', e.target.value)}>
                <option value="true">อัตโนมัติ (ขั้นบันได)</option>
                <option value="false">กำหนดเอง</option>
              </select>
            </div>

            {autoCalc && parseFloat(form.salary) > 0 && (
              <div>
                <div style={summaryRow}><span>รายได้ทั้งปี ({fmtB(parseFloat(form.salary) || 0)} x 12)</span><span style={{ fontWeight: 600 }}>{fmtB(taxInfo.yearlyIncome)}</span></div>
                <div style={summaryRow}><span>หักค่าใช้จ่าย (50% ไม่เกิน 100,000)</span><span style={{ color: '#dc2626' }}>-{fmtB(taxInfo.expense)}</span></div>
                <div style={summaryRow}><span>หักค่าลดหย่อนส่วนตัว</span><span style={{ color: '#dc2626' }}>-{fmtB(taxInfo.personal)}</span></div>
                {taxInfo.ssYearly > 0 && <div style={summaryRow}><span>หักประกันสังคม ({fmtB(ssMonthly)} x 12)</span><span style={{ color: '#dc2626' }}>-{fmtB(taxInfo.ssYearly)}</span></div>}
                <hr style={hrStyle} />
                <div style={{ ...summaryRow, fontWeight: 700 }}><span>เงินได้สุทธิ</span><span>{fmtB(taxInfo.netIncome)} บาท</span></div>
                <hr style={hrStyle} />
                {taxInfo.details.map((d, i) => (
                  <div key={i} style={{ ...summaryRow, fontSize: 13, color: '#666' }}><span>{d.range} ({d.rate})</span><span>{fmtB(d.tax)}</span></div>
                ))}
                <hr style={hrStyle} />
                <div style={{ ...summaryRow, fontWeight: 700, color: '#1e3a5f' }}><span>ภาษีทั้งปี</span><span>{fmtB(taxInfo.yearlyTax)} บาท</span></div>
                <div style={{ ...summaryRow, fontWeight: 700, color: '#dc2626', fontSize: 18, background: '#fef2f2', padding: '8px 12px', borderRadius: 8, marginTop: 4 }}>
                  <span>หัก ณ ที่จ่ายรายเดือน</span><span>{fmtB(taxInfo.monthlyTax)} บาท</span>
                </div>
              </div>
            )}

            {!autoCalc && (
              <div style={styles.formGrid}>
                <div><label style={styles.label}>หัก ณ ที่จ่ายรายเดือน (บาท)</label><input style={styles.input} type="number" value={form.withholding_tax || ''} onChange={e => h('withholding_tax', e.target.value)} /></div>
                <div><label style={styles.label}>เงื่อนไขภาษี</label><input style={styles.input} value={form.tax_condition || ''} onChange={e => h('tax_condition', e.target.value)} /></div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 16 }}><label style={styles.label}>หมายเหตุ</label><textarea style={{ ...styles.input, minHeight: 60 }} value={form.remarks || ''} onChange={e => h('remarks', e.target.value)} /></div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <button style={styles.btn('default')} onClick={() => { setEditing(false); setForm(data || {}); }}>ยกเลิก</button>
            <button style={{ ...styles.btn('success'), opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== HISTORY TAB ========== */
function HistoryTab({ staffId }) {
  const [history, setHistory] = useState([]);
  const [salary, setSalary] = useState(null);
  const [employment, setEmployment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    Promise.all([
      getStaffHistory(staffId).then(r => setHistory(r.data || [])),
      getStaffSalary(staffId).then(r => setSalary(r.data)).catch(() => {}),
      getStaffEmployment(staffId).then(r => setEmployment(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [staffId]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>กำลังโหลด...</div>;

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
  const fmtTime = (d) => d ? new Date(d).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
  const fmtNum = (v) => v ? parseFloat(v).toLocaleString('th-TH') : '0';

  const cardStyle = { background: '#f8fafc', borderRadius: 10, padding: '16px 20px', marginBottom: 16, border: '1px solid #e2e8f0' };
  const labelStyle = { fontSize: 12, color: '#888', fontWeight: 600 };
  const valueStyle = { fontSize: 15, color: '#333', marginTop: 2 };

  const filters = [
    { key: 'all', label: 'ทั้งหมด', icon: '📋' },
    { key: 'เงินเดือน', label: 'เงินเดือน', icon: '💰' },
    { key: 'ตำแหน่ง', label: 'ตำแหน่ง', icon: '📌' },
    { key: 'แผนก', label: 'แผนก', icon: '🏢' },
    { key: 'other', label: 'อื่นๆ', icon: '📝' },
  ];

  const mainFields = ['เงินเดือน', 'ตำแหน่ง', 'แผนก'];
  const filtered = filter === 'all' ? history
    : filter === 'other' ? history.filter(h => !mainFields.includes(h.field_changed))
    : history.filter(h => h.field_changed === filter);

  // Group by date
  const grouped = {};
  filtered.forEach(h => {
    const dateKey = fmtDate(h.changed_at);
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(h);
  });

  const filterBtnStyle = (active) => ({
    padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
    background: active ? '#1e3a5f' : '#f3f4f6', color: active ? '#fff' : '#666', transition: 'all 0.2s'
  });

  return (
    <div style={{ padding: 24 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>ตำแหน่งและเงินเดือน/ค่าจ้าง</h3>

      {/* Current Info Card */}
      <div style={{ ...cardStyle, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f' }}>ข้อมูลปัจจุบัน</span>
          {history.length > 0 && (
            <span style={{ fontSize: 12, color: '#888' }}>อัปเดตล่าสุด {fmtTime(history[0]?.changed_at)} โดย {history[0]?.changed_by_name || '-'}</span>
          )}
        </div>
        {employment?.hire_date && (() => {
          const hd = new Date(employment.hire_date);
          const now = new Date();
          let years = now.getFullYear() - hd.getFullYear();
          let months = now.getMonth() - hd.getMonth();
          let days = now.getDate() - hd.getDate();
          if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
          if (months < 0) { years--; months += 12; }
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '8px 12px', background: '#fff', borderRadius: 8 }}>
              <span style={{ fontSize: 16 }}>📅</span>
              <span style={{ fontSize: 13, color: '#555' }}>เริ่มงาน {fmtDate(employment.hire_date)}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f' }}>({years} ปี {months} เดือน {days} วัน)</span>
            </div>
          );
        })()}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 24px' }}>
          <div><div style={labelStyle}>แผนก</div><div style={valueStyle}>{employment?.department || '-'}</div></div>
          <div><div style={labelStyle}>ตำแหน่ง</div><div style={valueStyle}>{employment?.position || '-'}</div></div>
          <div><div style={labelStyle}>เงินเดือน/ค่าจ้าง</div><div style={{ ...valueStyle, color: '#1e3a5f', fontWeight: 700 }}>{fmtNum(salary?.salary)} บาท</div></div>
          <div><div style={labelStyle}>ประกันสังคม</div><div style={{ ...valueStyle, color: '#059669' }}>{salary?.social_security_eligible ? fmtNum(salary?.social_security) + ' บาท/เดือน' : 'ไม่มี'}</div></div>
          <div><div style={labelStyle}>หัก ณ ที่จ่าย</div><div style={{ ...valueStyle, color: '#dc2626' }}>{fmtNum(salary?.withholding_tax)} บาท/เดือน</div></div>
          <div><div style={labelStyle}>รับสุทธิ (ประมาณ)</div><div style={{ ...valueStyle, color: '#1e3a5f', fontWeight: 700 }}>{fmtNum((parseFloat(salary?.salary || 0) - parseFloat(salary?.social_security || 0) - parseFloat(salary?.withholding_tax || 0)))} บาท</div></div>
        </div>
      </div>

      {/* Filter + History */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f' }}>ประวัติการเปลี่ยนแปลง</h3>
        <span style={{ fontSize: 13, color: '#888' }}>{filtered.length} รายการ</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button key={f.key} style={filterBtnStyle(filter === f.key)} onClick={() => setFilter(f.key)}>
            {f.icon} {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>ไม่มีประวัติ{filter !== 'all' ? `ในหมวด "${filters.find(f=>f.key===filter)?.label}"` : ''}</div>
      ) : (
        Object.entries(grouped).map(([date, items]) => (
          <div key={date} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', marginBottom: 8, padding: '4px 12px', background: '#f0f2f5', borderRadius: 6, display: 'inline-block' }}>{date}</div>
            {items.map(h => (
              <div key={h.id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1e3a5f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  {h.field_changed === 'เงินเดือน' ? '💰' : h.field_changed === 'ตำแหน่ง' ? '📌' : h.field_changed === 'แผนก' ? '🏢' : '📝'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
                    {h.field_changed}: <span style={{ color: '#dc2626', textDecoration: 'line-through' }}>{h.old_value || '-'}</span> → <span style={{ color: '#059669' }}>{h.new_value || '-'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>โดย {h.changed_by_name || '-'} เมื่อ {fmtTime(h.changed_at)}</div>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

/* ========== NOTES TAB ========== */
function NotesTab({ staffId }) {
  const [notes, setNotes] = useState([]);
  const [docs, setDocs] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('สำเนาบัตรประชาชน');

  useEffect(() => { load(); }, [staffId]);
  const load = () => {
    setLoading(true);
    Promise.all([
      getStaffNotes(staffId).then(r => setNotes(r.data || [])),
      getStaffDocuments(staffId).then(r => setDocs(r.data || [])),
    ]).catch(() => {}).finally(() => setLoading(false));
  };
  const handleAdd = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    try { await createStaffNote(staffId, newNote); setNewNote(''); load(); }
    catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadStaffDocument(staffId, file, docType);
      load();
    } catch (err) { alert(err.message); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleDeleteDoc = async (docId) => {
    if (!confirm('ต้องการลบเอกสารนี้?')) return;
    try { await deleteStaffDocument(staffId, docId); load(); }
    catch (err) { alert(err.message); }
  };

  const fmtSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>กำลังโหลด...</div>;

  const docCategories = ['สำเนาบัตรประชาชน', 'สำเนาทะเบียนบ้าน', 'เอกสารอื่นๆ'];
  const cardStyle = { background: '#f8fafc', borderRadius: 10, padding: '16px 20px', marginBottom: 16, border: '1px solid #e2e8f0' };

  return (
    <div style={{ padding: 24 }}>
      {/* Documents Section */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>เอกสารสำคัญ</h3>

      {docCategories.map(cat => {
        const catDocs = docs.filter(d => d.document_type === cat);
        return (
          <div key={cat} style={{ ...cardStyle, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>{cat}</span>
              <label style={{ ...styles.btn('default'), fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {uploading && docType === cat ? '...' : '📎 แนบไฟล์'}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }}
                  onChange={(e) => { setDocType(cat); handleUpload(e); }} />
              </label>
            </div>
            {catDocs.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#aaa', background: '#fff', borderRadius: 8, border: '2px dashed #e2e8f0' }}>
                <div style={{ fontSize: 13 }}>ยังไม่มีเอกสาร</div>
              </div>
            ) : (
              catDocs.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#fff', borderRadius: 8, marginBottom: 6, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 20 }}>{d.mime_type?.includes('pdf') ? '📄' : d.mime_type?.includes('image') ? '🖼️' : '📎'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{d.file_name}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{fmtSize(d.file_size)} | อัพโหลดโดย {d.uploaded_by_name || '-'} | {new Date(d.uploaded_at).toLocaleDateString('th-TH')}</div>
                  </div>
                  <a href={`/api/staff/documents/file/${d.file_path}`} target="_blank" style={{ ...styles.btn('default'), fontSize: 12, textDecoration: 'none' }}>ดู</a>
                  <button style={{ ...styles.btn('danger'), fontSize: 12, padding: '4px 10px' }} onClick={() => handleDeleteDoc(d.id)}>ลบ</button>
                </div>
              ))
            )}
          </div>
        );
      })}

      {/* Notes Section */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 16, marginTop: 24 }}>หมายเหตุ</h3>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <textarea style={{ ...styles.input, flex: 1, minHeight: 60 }} placeholder="เพิ่มหมายเหตุ..." value={newNote} onChange={e => setNewNote(e.target.value)} />
        <button style={{ ...styles.btn('primary'), alignSelf: 'flex-end' }} onClick={handleAdd} disabled={saving}>{saving ? '...' : 'เพิ่ม'}</button>
      </div>
      {notes.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 20 }}>ยังไม่มีหมายเหตุ</div>
      ) : (
        notes.map(n => (
          <div key={n.id} style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 14 }}>{n.content}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>โดย {n.created_by_name || '-'} | {new Date(n.created_at).toLocaleString('th-TH')}</div>
          </div>
        ))
      )}
    </div>
  );
}

/* ========== STAFF DETAIL ========== */
function StaffDetailPage({ staffId, onBack, onRefresh }) {
  const [staff, setStaff] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStaff(); getDepartments().then(d => setDepartments(d.data || [])).catch(() => {}); }, [staffId]);

  const loadStaff = async () => {
    setLoading(true);
    try { const data = await getStaff(staffId); setStaff(data.data); setEditForm(data.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    try { await updateStaff(staffId, editForm); setEditing(false); loadStaff(); onRefresh(); }
    catch (err) { alert(err.message); }
  };

  const handleDelete = async () => {
    if (!confirm('ต้องการปิดใช้งานพนักงานนี้?')) return;
    try { await deleteStaff(staffId); onBack(); onRefresh(); }
    catch (err) { alert(err.message); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>กำลังโหลด...</div>;
  if (!staff) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>ไม่พบข้อมูล</div>;

  const initials = (staff.first_name_en || staff.first_name_th || '?')[0].toUpperCase();
  const tabList = [
    { key: 'info', label: 'ข้อมูลส่วนตัว' },
    { key: 'contact', label: 'ข้อมูลติดต่อ' },
    { key: 'address', label: 'ที่อยู่' },
    { key: 'employment', label: 'การจ้างงาน' },
    { key: 'salary', label: 'เงินเดือน' },
    { key: 'payslip', label: 'สลิปเงินเดือน' },
    { key: 'history', label: 'ประวัติ' },
    { key: 'notes', label: 'เอกสาร/หมายเหตุ' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}><button onClick={onBack} style={{ ...styles.btn('default'), fontSize: 13 }}>← กลับ</button></div>
      <div style={styles.card}>
        <div style={styles.detailHeader}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={styles.detailAvatar}>{initials}</div>
            <div>
              <div style={styles.detailName}>{staff.title_th}{staff.first_name_th} {staff.last_name_th}</div>
              <div style={styles.detailSub}>{staff.first_name_en} {staff.last_name_en} | {staff.employee_code}</div>
              <div style={{ marginTop: 6 }}>
                <span style={styles.badge(staff.status === 'active' ? 'green' : 'red')}>{staff.status}</span>
                {staff.department_name && <span style={{ ...styles.badge('blue'), marginLeft: 6 }}>{staff.department_name}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {activeTab === 'info' && !editing && <button style={styles.btn('primary')} onClick={() => setEditing(true)}>แก้ไข</button>}
            {activeTab === 'info' && !editing && <button style={styles.btn('danger')} onClick={handleDelete}>ปิดใช้งาน</button>}
          </div>
        </div>

        <div style={styles.tabs}>
          {tabList.map(t => <button key={t.key} style={styles.tab(activeTab === t.key)} onClick={() => { setActiveTab(t.key); setEditing(false); }}>{t.label}</button>)}
        </div>

        {activeTab === 'info' && !editing && (
          <div style={styles.detailGrid}>
            <div><div style={styles.fieldLabel}>คำนำหน้า</div><div style={styles.fieldValue}>{staff.title_th || '-'}</div></div>
            <div><div style={styles.fieldLabel}>ชื่อเล่น</div><div style={styles.fieldValue}>{staff.nickname_th || '-'}</div></div>
            <div><div style={styles.fieldLabel}>ชื่อ (TH)</div><div style={styles.fieldValue}>{staff.first_name_th}</div></div>
            <div><div style={styles.fieldLabel}>นามสกุล (TH)</div><div style={styles.fieldValue}>{staff.last_name_th}</div></div>
            <div><div style={styles.fieldLabel}>ชื่อ (EN)</div><div style={styles.fieldValue}>{staff.first_name_en || '-'}</div></div>
            <div><div style={styles.fieldLabel}>นามสกุล (EN)</div><div style={styles.fieldValue}>{staff.last_name_en || '-'}</div></div>
            <div><div style={styles.fieldLabel}>เลขบัตรประชาชน</div><div style={styles.fieldValue}>{staff.id_card_number || '-'}</div></div>
            <div><div style={styles.fieldLabel}>วันเกิด</div><div style={styles.fieldValue}>{staff.date_of_birth ? new Date(staff.date_of_birth).toLocaleDateString('th-TH') : '-'}</div></div>
          </div>
        )}

        {activeTab === 'info' && editing && (
          <div style={{ padding: 24 }}>
            <div style={styles.formGrid}>
              <div><label style={styles.label}>คำนำหน้า</label><select style={styles.input} value={editForm.title_th || ''} onChange={e => setEditForm(p => ({ ...p, title_th: e.target.value }))}><option>นาย</option><option>นาง</option><option>นางสาว</option></select></div>
              <div><label style={styles.label}>ชื่อเล่น</label><input style={styles.input} value={editForm.nickname_th || ''} onChange={e => setEditForm(p => ({ ...p, nickname_th: e.target.value }))} /></div>
              <div><label style={styles.label}>ชื่อ (TH)</label><input style={styles.input} value={editForm.first_name_th || ''} onChange={e => setEditForm(p => ({ ...p, first_name_th: e.target.value }))} /></div>
              <div><label style={styles.label}>นามสกุล (TH)</label><input style={styles.input} value={editForm.last_name_th || ''} onChange={e => setEditForm(p => ({ ...p, last_name_th: e.target.value }))} /></div>
              <div><label style={styles.label}>ชื่อ (EN)</label><input style={styles.input} value={editForm.first_name_en || ''} onChange={e => setEditForm(p => ({ ...p, first_name_en: e.target.value }))} /></div>
              <div><label style={styles.label}>นามสกุล (EN)</label><input style={styles.input} value={editForm.last_name_en || ''} onChange={e => setEditForm(p => ({ ...p, last_name_en: e.target.value }))} /></div>
              <div><label style={styles.label}>เลขบัตรประชาชน</label><input style={styles.input} value={editForm.id_card_number || ''} onChange={e => setEditForm(p => ({ ...p, id_card_number: e.target.value }))} /></div>
              <div><label style={styles.label}>วันเกิด</label><input style={styles.input} type="date" value={editForm.date_of_birth ? editForm.date_of_birth.substring(0, 10) : ''} onChange={e => setEditForm(p => ({ ...p, date_of_birth: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={styles.btn('default')} onClick={() => { setEditing(false); setEditForm(staff); }}>ยกเลิก</button>
              <button style={styles.btn('success')} onClick={handleSave}>บันทึก</button>
            </div>
          </div>
        )}

        {activeTab === 'contact' && <EditableTab staffId={staffId} fetchFn={getStaffContact} saveFn={saveStaffContact} fields={contactFields} title="ข้อมูลติดต่อ" />}
        {activeTab === 'address' && <EditableTab staffId={staffId} fetchFn={getStaffAddress} saveFn={saveStaffAddress} fields={addressFields} title="ที่อยู่ตามบัตรประชาชน" />}
        {activeTab === 'employment' && <EditableTab staffId={staffId} fetchFn={getStaffEmployment} saveFn={saveStaffEmployment} fields={employmentFields} title="ข้อมูลการจ้างงาน" />}
        {activeTab === 'salary' && <SalaryTab staffId={staffId} />}
        {activeTab === 'history' && <HistoryTab staffId={staffId} />}
        {activeTab === 'payslip' && <PayslipTab staffId={staffId} />}
        {activeTab === 'notes' && <NotesTab staffId={staffId} />}
      </div>
    </div>
  );
}

/* ========== MAIN APP ========== */
export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

function AppInner() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isOnPurchaseRoute = location.pathname.startsWith('/purchase');

  useEffect(() => { const s = document.createElement('style'); s.textContent = styles.global; document.head.appendChild(s); return () => s.remove(); }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) { getMe().then(data => setUser(data.user)).catch(() => localStorage.removeItem('token')).finally(() => setAuthChecked(true)); }
    else { setAuthChecked(true); }
  }, []);

  const loadStaff = useCallback(async () => {
    try { const data = await getStaffList({ limit: 100 }); setStaffList(data.data || []); }
    catch (err) { console.error('Load staff error:', err); }
  }, []);

  useEffect(() => { if (user) loadStaff(); }, [user, loadStaff]);

  const handleLogout = () => { localStorage.removeItem('token'); setUser(null); setPage('dashboard'); setSelectedStaffId(null); navigate('/'); };

  if (!authChecked) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: '#888' }}>กำลังโหลด...</div>;
  if (!user) return <LoginPage onLogin={setUser} />;

  return (
    <div style={styles.layout}>
      <Sidebar active={page} onNavigate={(p) => { setPage(p); setSelectedStaffId(null); }} user={user} onLogout={handleLogout} />
      <main style={styles.main}>
        <Routes>
          <Route path="/purchase" element={<PurchaseOrderPage />} />
          <Route path="/purchase/new" element={<POFormPage />} />
          <Route path="/purchase/:id" element={<PODetailPage />} />
          <Route path="/purchase/:id/edit" element={<POFormPage />} />
          <Route path="*" element={
            <>
              {page === 'dashboard' && <DashboardPage staffList={staffList} />}
              {page === 'staff' && !selectedStaffId && <StaffListPage staffList={staffList} onSelect={setSelectedStaffId} onRefresh={loadStaff} />}
              {page === 'staff' && selectedStaffId && <StaffDetailPage staffId={selectedStaffId} onBack={() => setSelectedStaffId(null)} onRefresh={loadStaff} />}
              {page === 'payroll' && <PayrollPage />}
              {page === 'stock' && <StockPage />}
              {page === 'withholding' && <WithholdingTaxPage />}
              {page === 'users' && <UserManagementPage staffList={staffList} />}
              {page === 'settings' && <SettingsPage />}
            </>
          } />
        </Routes>
      </main>
    </div>
  );
}

/* ========== PAYSLIP TAB (Staff Detail) ========== */
function PayslipTab({ staffId }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getStaffPayroll(staffId).then(r => setRecords(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, [staffId]);

  const fmtNum = (v) => v ? parseFloat(v).toLocaleString('th-TH') : '0';
  const months = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>กำลังโหลด...</div>;
  return (
    <div style={{ padding: 24 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>ประวัติเงินเดือน</h3>
      {records.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>ยังไม่มีข้อมูล</div>
      ) : (
        <table style={styles.table}>
          <thead><tr>
            <th style={styles.th}>เดือน</th><th style={styles.th}>เงินเดือน</th><th style={styles.th}>OT</th><th style={styles.th}>โบนัส</th>
            <th style={styles.th}>ประกันสังคม</th><th style={styles.th}>ภาษี</th><th style={styles.th}>หักอื่นๆ</th><th style={styles.th}>รับสุทธิ</th><th style={styles.th}>สถานะ</th>
          </tr></thead>
          <tbody>{records.map(r => (
            <tr key={r.id}>
              <td style={styles.td}>{months[r.month]} {r.year + 543}</td>
              <td style={styles.td}>{fmtNum(r.salary)}</td>
              <td style={styles.td}>{fmtNum(r.overtime)}</td>
              <td style={styles.td}>{fmtNum(r.bonus)}</td>
              <td style={styles.td}>{fmtNum(r.social_security)}</td>
              <td style={styles.td}>{fmtNum(r.withholding_tax)}</td>
              <td style={styles.td}>{fmtNum(r.other_deduction)}</td>
              <td style={{ ...styles.td, fontWeight: 700, color: '#1e3a5f' }}>{fmtNum(r.net_pay)}</td>
              <td style={styles.td}><span style={styles.badge(r.status === 'approved' ? 'green' : 'default')}>{r.status === 'approved' ? 'อนุมัติ' : 'ร่าง'}</span></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}

/* ========== PAYROLL PAGE ========== */
function PayrollPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffList, setStaffList] = useState([]);

  const monthNames = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const fmtNum = (v) => v ? parseFloat(v).toLocaleString('th-TH') : '0';

  const load = async () => {
    setLoading(true);
    try { const res = await getPayroll(year, month); setRecords(res.data || []); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [year, month]);

  const handleGenerate = async () => {
    setMsg('');
    try { const res = await generatePayroll(year, month); setMsg(res.message); load(); }
    catch (err) { setMsg('Error: ' + err.message); }
  };

  const handleApprove = async () => {
    if (!confirm(`ยืนยันอนุมัติเงินเดือน ${monthNames[month]} ${year + 543}?`)) return;
    setMsg('');
    try { const res = await approvePayroll(year, month); setMsg(res.message); load(); }
    catch (err) { setMsg('Error: ' + err.message); }
  };

  const handleDeleteMonth = async () => {
    if (!confirm(`ยืนยันลบรายการเงินเดือน ${monthNames[month]} ${year + 543} ทั้งหมด?`)) return;
    setMsg('');
    try {
      const res = await fetch(`/api/payroll/month/${year}/${month}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(data.message); load();
    } catch (err) { setMsg('Error: ' + err.message); }
  };

  const handleDeleteSingle = async (id) => {
    if (!confirm('ยืนยันลบรายการนี้?')) return;
    try {
      const res = await fetch(`/api/payroll/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      load();
    } catch (err) { alert(err.message); }
  };

  const handleAddStaff = async (staffId) => {
    try {
      const res = await fetch('/api/payroll/add-single', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ staff_id: staffId, year, month }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(data.message); setShowAddStaff(false); load();
    } catch (err) { alert(err.message); }
  };

  const openAddStaff = async () => {
    try { const res = await getStaffList({ limit: 100 }); setStaffList(res.data || []); setShowAddStaff(true); }
    catch (err) { alert(err.message); }
  };

  const startEdit = (r) => {
    setEditId(r.id);
    setEditForm({ bonus: r.bonus || 0, overtime: r.overtime || 0, other_income: r.other_income || 0, other_deduction: r.other_deduction || 0 });
  };

  const saveEdit = async () => {
    try {
      await updatePayrollItem(editId, editForm);
      setEditId(null); load();
    } catch (err) { alert(err.message); }
  };

  const totalSalary = records.reduce((s, r) => s + parseFloat(r.salary || 0), 0);
  const totalSS = records.reduce((s, r) => s + parseFloat(r.social_security || 0), 0);
  const totalTax = records.reduce((s, r) => s + parseFloat(r.withholding_tax || 0), 0);
  const totalNet = records.reduce((s, r) => s + parseFloat(r.net_pay || 0), 0);
  const hasDraft = records.some(r => r.status === 'draft');

  return (
    <div>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Payroll - รายการเงินเดือน</h1>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={{ ...styles.input, width: 160 }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
          {monthNames.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select style={{ ...styles.input, width: 120 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y} value={y}>{y + 543}</option>)}
        </select>
        <button style={styles.btn('primary')} onClick={handleGenerate}>สร้างรายการเงินเดือน</button>
        {records.length > 0 && hasDraft && <button style={styles.btn('success')} onClick={handleApprove}>อนุมัติทั้งหมด</button>}
        {records.length > 0 && <button style={styles.btn('default')} onClick={openAddStaff}>+ เพิ่มพนักงาน</button>}
        {records.length > 0 && hasDraft && <button style={styles.btn('danger')} onClick={handleDeleteMonth}>ลบทั้งเดือน</button>}
      </div>

      {msg && <div style={msg.startsWith('Error') ? styles.error : styles.success}>{msg}</div>}

      {/* Summary Cards */}
      {records.length > 0 && (
        <div style={styles.statsRow}>
          <div style={styles.statCard}><div style={styles.statValue}>{records.length}</div><div style={styles.statLabel}>จำนวนพนักงาน</div></div>
          <div style={styles.statCard}><div style={styles.statValue}>{fmtNum(totalSalary)}</div><div style={styles.statLabel}>เงินเดือนรวม</div></div>
          <div style={styles.statCard}><div style={styles.statValue}>{fmtNum(totalTax)}</div><div style={styles.statLabel}>ภาษีหัก ณ ที่จ่าย</div></div>
          <div style={styles.statCard}><div style={styles.statValue}>{fmtNum(totalNet)}</div><div style={styles.statLabel}>จ่ายสุทธิรวม</div></div>
        </div>
      )}

      {/* Table */}
      <div style={styles.card}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>กำลังโหลด...</div>
        ) : records.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
            <div>ยังไม่มีรายการเงินเดือน {monthNames[month]} {year + 543}</div>
            <div style={{ fontSize: 13, color: '#aaa', marginTop: 8 }}>กดปุ่ม "สร้างรายการเงินเดือน" เพื่อดึงข้อมูลจากระบบ</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead><tr>
                <th style={styles.th}>รหัส</th><th style={styles.th}>ชื่อ-นามสกุล</th><th style={styles.th}>แผนก</th>
                <th style={styles.th}>เงินเดือน</th><th style={styles.th}>OT</th><th style={styles.th}>โบนัส</th><th style={styles.th}>รายได้อื่น</th>
                <th style={styles.th}>ปกส.</th><th style={styles.th}>ภาษี</th><th style={styles.th}>หักอื่นๆ</th>
                <th style={styles.th}>รับสุทธิ</th><th style={styles.th}>สถานะ</th><th style={styles.th}>จัดการ</th>
              </tr></thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td style={styles.td}>{r.employee_code}</td>
                    <td style={styles.td}>{r.title_th}{r.first_name_th} {r.last_name_th}</td>
                    <td style={styles.td}>{r.department_name || '-'}</td>
                    <td style={styles.td}>{fmtNum(r.salary)}</td>
                    <td style={styles.td}>{editId === r.id ? <input type="number" style={{ ...styles.input, width: 80, padding: 4 }} value={editForm.overtime} onChange={e => setEditForm(p => ({...p, overtime: e.target.value}))} /> : fmtNum(r.overtime)}</td>
                    <td style={styles.td}>{editId === r.id ? <input type="number" style={{ ...styles.input, width: 80, padding: 4 }} value={editForm.bonus} onChange={e => setEditForm(p => ({...p, bonus: e.target.value}))} /> : fmtNum(r.bonus)}</td>
                    <td style={styles.td}>{editId === r.id ? <input type="number" style={{ ...styles.input, width: 80, padding: 4 }} value={editForm.other_income} onChange={e => setEditForm(p => ({...p, other_income: e.target.value}))} /> : fmtNum(r.other_income)}</td>
                    <td style={styles.td}>{fmtNum(r.social_security)}</td>
                    <td style={styles.td}>{fmtNum(r.withholding_tax)}</td>
                    <td style={styles.td}>{editId === r.id ? <input type="number" style={{ ...styles.input, width: 80, padding: 4 }} value={editForm.other_deduction} onChange={e => setEditForm(p => ({...p, other_deduction: e.target.value}))} /> : fmtNum(r.other_deduction)}</td>
                    <td style={{ ...styles.td, fontWeight: 700, color: '#1e3a5f' }}>{fmtNum(r.net_pay)}</td>
                    <td style={styles.td}><span style={styles.badge(r.status === 'approved' ? 'green' : 'default')}>{r.status === 'approved' ? 'อนุมัติ' : 'ร่าง'}</span></td>
                    <td style={styles.td}>
                      {r.status === 'draft' && editId !== r.id && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button style={{ ...styles.btn('default'), fontSize: 12, padding: '4px 10px' }} onClick={() => startEdit(r)}>แก้ไข</button>
                          <button style={{ ...styles.btn('danger'), fontSize: 12, padding: '4px 10px' }} onClick={() => handleDeleteSingle(r.id)}>ลบ</button>
                        </div>
                      )}
                      {editId === r.id && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button style={{ ...styles.btn('success'), fontSize: 12, padding: '4px 8px' }} onClick={saveEdit}>บันทึก</button>
                          <button style={{ ...styles.btn('default'), fontSize: 12, padding: '4px 8px' }} onClick={() => setEditId(null)}>ยกเลิก</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: '#f0f2f5', fontWeight: 700 }}>
                  <td style={styles.td} colSpan={3}>รวม</td>
                  <td style={styles.td}>{fmtNum(totalSalary)}</td>
                  <td style={styles.td}>{fmtNum(records.reduce((s,r)=>s+parseFloat(r.overtime||0),0))}</td>
                  <td style={styles.td}>{fmtNum(records.reduce((s,r)=>s+parseFloat(r.bonus||0),0))}</td>
                  <td style={styles.td}>{fmtNum(records.reduce((s,r)=>s+parseFloat(r.other_income||0),0))}</td>
                  <td style={styles.td}>{fmtNum(totalSS)}</td>
                  <td style={styles.td}>{fmtNum(totalTax)}</td>
                  <td style={styles.td}>{fmtNum(records.reduce((s,r)=>s+parseFloat(r.other_deduction||0),0))}</td>
                  <td style={{ ...styles.td, color: '#1e3a5f' }}>{fmtNum(totalNet)}</td>
                  <td style={styles.td}></td><td style={styles.td}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      {showAddStaff && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, width: 480 }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}><span style={styles.modalTitle}>เพิ่มพนักงานในรายการเดือนนี้</span><button onClick={() => setShowAddStaff(false)} style={{ background: 'none', fontSize: 20, color: '#888' }}>✕</button></div>
            <div style={styles.modalBody}>
              <div style={{ maxHeight: 400, overflow: 'auto' }}>
                {staffList.filter(s => s.status === 'active' && !records.find(r => r.staff_id === s.id)).map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #f0f2f5' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{s.employee_code} - {s.first_name_th} {s.last_name_th}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{s.department_name || '-'} | {s.position || '-'}</div>
                    </div>
                    <button style={{ ...styles.btn('primary'), fontSize: 12, padding: '4px 12px' }} onClick={() => handleAddStaff(s.id)}>เพิ่ม</button>
                  </div>
                ))}
                {staffList.filter(s => s.status === 'active' && !records.find(r => r.staff_id === s.id)).length === 0 && (
                  <div style={{ textAlign: 'center', color: '#888', padding: 20 }}>พนักงานทุกคนมีรายการแล้ว</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== USER MANAGEMENT PAGE ========== */
function UserManagementPage({ staffList }) {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetPwUser, setResetPwUser] = useState(null);

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([getUsers(), getRoles()]);
      setUsers(u.data || []);
      setRoles(r.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>กำลังโหลด...</div>;

  return (
    <div>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>User Management</h1>
        {activeTab === 'users' && <button style={styles.btn('primary')} onClick={() => setShowCreate(true)}>+ เพิ่มผู้ใช้</button>}
      </div>
      <div style={styles.card}>
        <div style={styles.tabs}>
          <button style={styles.tab(activeTab === 'users')} onClick={() => setActiveTab('users')}>👥 ผู้ใช้งาน</button>
          <button style={styles.tab(activeTab === 'roles')} onClick={() => setActiveTab('roles')}>🛡️ Roles & Permissions</button>
        </div>

        {activeTab === 'users' && (
          <table style={styles.table}>
            <thead><tr>
              <th style={styles.th}>Username</th><th style={styles.th}>พนักงาน</th><th style={styles.th}>Email</th><th style={styles.th}>Role</th><th style={styles.th}>สถานะ</th><th style={styles.th}>Login ล่าสุด</th><th style={styles.th}>จัดการ</th>
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={styles.td}><span style={{ fontWeight: 600, color: '#1e3a5f' }}>{u.username}</span></td>
                  <td style={styles.td}>{u.first_name_th ? `${u.first_name_th} ${u.last_name_th}` : '-'}</td>
                  <td style={styles.td}>{u.email || '-'}</td>
                  <td style={styles.td}><span style={styles.badge('blue')}>{u.role_name}</span></td>
                  <td style={styles.td}><span style={styles.badge(u.is_active ? 'green' : 'red')}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td style={styles.td}>{u.last_login ? new Date(u.last_login).toLocaleString('th-TH') : 'ยังไม่เคย'}</td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{ ...styles.btn('default'), fontSize: 12, padding: '4px 10px' }} onClick={() => setEditUser(u)}>แก้ไข</button>
                      <button style={{ ...styles.btn('default'), fontSize: 12, padding: '4px 10px' }} onClick={() => setResetPwUser(u)}>รีเซ็ตรหัส</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'roles' && <RolesPermissionsTab roles={roles} />}
      </div>
      {showCreate && <CreateUserModal roles={roles} staffList={staffList} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
      {editUser && <EditUserModal user={editUser} roles={roles} staffList={staffList} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); load(); }} />}
      {resetPwUser && <ResetPasswordModal user={resetPwUser} onClose={() => setResetPwUser(null)} onDone={() => { setResetPwUser(null); }} />}
    </div>
  );
}

/* ========== ROLES & PERMISSIONS TAB ========== */
function RolesPermissionsTab({ roles }) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const loadPerms = async (roleId) => {
    setLoading(true); setMsg('');
    try {
      const res = await getRolePermissions(roleId);
      setPermissions(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSelectRole = (role) => {
    setSelectedRole(role);
    loadPerms(role.id);
  };

  const togglePerm = (permId) => {
    setPermissions(prev => prev.map(p => p.id === permId ? { ...p, granted: !p.granted } : p));
  };

  const toggleModule = (module) => {
    const modulePerms = permissions.filter(p => p.module === module);
    const allGranted = modulePerms.every(p => p.granted);
    setPermissions(prev => prev.map(p => p.module === module ? { ...p, granted: !allGranted } : p));
  };

  const handleSave = async () => {
    setSaving(true); setMsg('');
    try {
      const granted = permissions.filter(p => p.granted).map(p => p.id);
      await saveRolePermissions(selectedRole.id, granted);
      setMsg('บันทึกสิทธิ์สำเร็จ');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg('Error: ' + err.message); }
    finally { setSaving(false); }
  };

  // Group permissions by module
  const modules = [...new Set(permissions.map(p => p.module))];
  const actions = ['view', 'create', 'edit', 'delete', 'approve', 'export'];
  const actionLabels = { view: 'ดู', create: 'สร้าง', edit: 'แก้ไข', delete: 'ลบ', approve: 'อนุมัติ', export: 'ส่งออก' };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 24 }}>
        {/* Role List */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 12 }}>เลือก Role</div>
          {roles.map(r => (
            <div key={r.id} onClick={() => handleSelectRole(r)}
              style={{ padding: '10px 14px', borderRadius: 8, cursor: 'pointer', marginBottom: 4, fontSize: 14,
                background: selectedRole?.id === r.id ? '#1e3a5f' : '#f8fafc',
                color: selectedRole?.id === r.id ? '#fff' : '#333',
                fontWeight: selectedRole?.id === r.id ? 600 : 400,
                border: '1px solid ' + (selectedRole?.id === r.id ? '#1e3a5f' : '#e2e8f0') }}>
              {r.name}
            </div>
          ))}
        </div>

        {/* Permissions Grid */}
        <div style={{ flex: 1 }}>
          {!selectedRole ? (
            <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>เลือก Role จากด้านซ้ายเพื่อจัดการสิทธิ์</div>
          ) : loading ? (
            <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>กำลังโหลด...</div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f' }}>สิทธิ์ของ: {selectedRole.name}</span>
                <button style={{ ...styles.btn('success'), opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์'}</button>
              </div>
              {msg && <div style={msg.startsWith('Error') ? styles.error : styles.success}>{msg}</div>}
              <table style={{ ...styles.table, fontSize: 13 }}>
                <thead><tr>
                  <th style={{ ...styles.th, width: 150 }}>Module</th>
                  {actions.map(a => <th key={a} style={{ ...styles.th, textAlign: 'center', width: 70 }}>{actionLabels[a]}</th>)}
                  <th style={{ ...styles.th, textAlign: 'center', width: 70 }}>ทั้งหมด</th>
                </tr></thead>
                <tbody>
                  {modules.map(mod => {
                    const modulePerms = permissions.filter(p => p.module === mod);
                    const allGranted = modulePerms.every(p => p.granted);
                    return (
                      <tr key={mod}>
                        <td style={{ ...styles.td, fontWeight: 600 }}>{mod}</td>
                        {actions.map(act => {
                          const perm = permissions.find(p => p.module === mod && p.action === act);
                          return (
                            <td key={act} style={{ ...styles.td, textAlign: 'center' }}>
                              {perm ? (
                                <input type="checkbox" checked={perm.granted} onChange={() => togglePerm(perm.id)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                              ) : <span style={{ color: '#ddd' }}>-</span>}
                            </td>
                          );
                        })}
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <input type="checkbox" checked={allGranted} onChange={() => toggleModule(mod)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ========== CREATE USER MODAL ========== */
function CreateUserModal({ roles, staffList, onClose, onCreated }) {
  const [form, setForm] = useState({ username: '', email: '', password: '', role_id: '', staff_id: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const h = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handleSubmit = async () => {
    setError('');
    if (!form.username || !form.password || !form.role_id) return setError('กรุณากรอก Username, Password และเลือก Role');
    if (form.password.length < 6) return setError('Password ต้องมีอย่างน้อย 6 ตัวอักษร');
    setLoading(true);
    try { await createUser({ ...form, role_id: parseInt(form.role_id), staff_id: form.staff_id ? parseInt(form.staff_id) : null }); onCreated(); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  return (
    <div style={styles.overlay}><div style={styles.modal} onClick={e => e.stopPropagation()}>
      <div style={styles.modalHeader}><span style={styles.modalTitle}>เพิ่มผู้ใช้ใหม่</span><button onClick={onClose} style={{ background: 'none', fontSize: 20, color: '#888' }}>✕</button></div>
      <div style={styles.modalBody}>
        {error && <div style={styles.error}>{error}</div>}
        <div style={styles.formGrid}>
          <div><label style={styles.label}>Username *</label><input style={styles.input} value={form.username} onChange={e => h('username', e.target.value)} /></div>
          <div><label style={styles.label}>Email</label><input style={styles.input} type="email" value={form.email} onChange={e => h('email', e.target.value)} /></div>
          <div><label style={styles.label}>Password *</label><input style={styles.input} type="password" value={form.password} onChange={e => h('password', e.target.value)} placeholder="อย่างน้อย 6 ตัว" /></div>
          <div><label style={styles.label}>Role *</label>
            <select style={styles.input} value={form.role_id} onChange={e => h('role_id', e.target.value)}>
              <option value="">-- เลือก Role --</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}><label style={styles.label}>เชื่อมกับพนักงาน</label>
            <select style={styles.input} value={form.staff_id} onChange={e => h('staff_id', e.target.value)}>
              <option value="">-- ไม่เชื่อม --</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.employee_code} - {s.first_name_th} {s.last_name_th}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div style={styles.modalFooter}><button style={styles.btn('default')} onClick={onClose}>ยกเลิก</button><button style={{ ...styles.btn('primary'), opacity: loading ? 0.7 : 1 }} onClick={handleSubmit} disabled={loading}>{loading ? 'กำลังบันทึก...' : 'บันทึก'}</button></div>
    </div></div>
  );
}

/* ========== EDIT USER MODAL ========== */
function EditUserModal({ user, roles, staffList, onClose, onSaved }) {
  const [form, setForm] = useState({ email: user.email || '', role_id: String(user.role_id), is_active: user.is_active, staff_id: user.staff_id ? String(user.staff_id) : '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const h = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handleSubmit = async () => {
    setError('');
    if (!form.role_id) return setError('กรุณาเลือก Role');
    setLoading(true);
    try { await updateUser(user.id, { ...form, role_id: parseInt(form.role_id), staff_id: form.staff_id ? parseInt(form.staff_id) : null }); onSaved(); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  return (
    <div style={styles.overlay}><div style={styles.modal} onClick={e => e.stopPropagation()}>
      <div style={styles.modalHeader}><span style={styles.modalTitle}>แก้ไขผู้ใช้: {user.username}</span><button onClick={onClose} style={{ background: 'none', fontSize: 20, color: '#888' }}>✕</button></div>
      <div style={styles.modalBody}>
        {error && <div style={styles.error}>{error}</div>}
        <div style={styles.formGrid}>
          <div><label style={styles.label}>Username</label><div style={{ ...styles.input, background: '#f3f4f6', color: '#888' }}>{user.username}</div></div>
          <div><label style={styles.label}>Email</label><input style={styles.input} type="email" value={form.email} onChange={e => h('email', e.target.value)} /></div>
          <div><label style={styles.label}>Role *</label>
            <select style={styles.input} value={form.role_id} onChange={e => h('role_id', e.target.value)}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div><label style={styles.label}>สถานะ</label>
            <select style={styles.input} value={String(form.is_active)} onChange={e => h('is_active', e.target.value === 'true')}>
              <option value="true">Active</option><option value="false">Inactive</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}><label style={styles.label}>เชื่อมกับพนักงาน</label>
            <select style={styles.input} value={form.staff_id} onChange={e => h('staff_id', e.target.value)}>
              <option value="">-- ไม่เชื่อม --</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.employee_code} - {s.first_name_th} {s.last_name_th}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div style={styles.modalFooter}><button style={styles.btn('default')} onClick={onClose}>ยกเลิก</button><button style={{ ...styles.btn('success'), opacity: loading ? 0.7 : 1 }} onClick={handleSubmit} disabled={loading}>{loading ? 'กำลังบันทึก...' : 'บันทึก'}</button></div>
    </div></div>
  );
}

/* ========== RESET PASSWORD MODAL ========== */
function ResetPasswordModal({ user, onClose, onDone }) {
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    setError(''); setMsg('');
    if (!pw || pw.length < 6) return setError('Password ต้องมีอย่างน้อย 6 ตัวอักษร');
    setLoading(true);
    try { await resetUserPassword(user.id, pw); setMsg('รีเซ็ตรหัสผ่านสำเร็จ'); setPw(''); setTimeout(onDone, 1500); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  return (
    <div style={styles.overlay}><div style={{ ...styles.modal, width: 400 }} onClick={e => e.stopPropagation()}>
      <div style={styles.modalHeader}><span style={styles.modalTitle}>รีเซ็ตรหัสผ่าน: {user.username}</span><button onClick={onClose} style={{ background: 'none', fontSize: 20, color: '#888' }}>✕</button></div>
      <div style={styles.modalBody}>
        {error && <div style={styles.error}>{error}</div>}
        {msg && <div style={styles.success}>{msg}</div>}
        <div><label style={styles.label}>รหัสผ่านใหม่ *</label><input style={styles.input} type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="อย่างน้อย 6 ตัว" /></div>
      </div>
      <div style={styles.modalFooter}><button style={styles.btn('default')} onClick={onClose}>ยกเลิก</button><button style={{ ...styles.btn('danger'), opacity: loading ? 0.7 : 1 }} onClick={handleSubmit} disabled={loading}>{loading ? '...' : 'รีเซ็ตรหัสผ่าน'}</button></div>
    </div></div>
  );
}

/* ========== WHT DOMAIN CONSTANTS (shared between WHT Page and PO Form) ========== */
const PND_FORMS = ['ภ.ง.ด.1ก','ภ.ง.ด.1ก พิเศษ','ภ.ง.ด.2','ภ.ง.ด.3','ภ.ง.ด.2ก','ภ.ง.ด.3ก','ภ.ง.ด.53'];
const INCOME_TYPES = ['40(1)','40(2)','40(3)','40(4)ก','40(4)ข','ม.3 เตรส','อื่นๆ'];
const WHT_RATES = ['0','1','2','3','5','10','15'];

/* ========== WITHHOLDING TAX (50 ทวิ) ========== */
function WithholdingTaxPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterStatus, setFilterStatus] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(getEmptyWhtForm());

  const DEFAULT_PAYER = {
    payer_name: 'บริษัท ไอเดีย เฮ้าส์เซ็นเตอร์ จำกัด (สำนักงานใหญ่)',
    payer_tax_id: '0105556022070',
    payer_address: 'เลขที่ 80 อาคาร เค.เอ.เอ็น.เพลส ห้องเลขที่ 104 ชั้น 1 ซ.นราธิวาสราชนครินทร์ 8 แขวงทุ่งวัดดอน เขตสาทร กรุงเทพฯ 10120',
  };
  const ST_LABEL = { draft:'ร่าง', issued:'ออกแล้ว', cancelled:'ยกเลิก' };
  const ST_COLOR = { draft:'default', issued:'green', cancelled:'red' };

  function getEmptyWhtForm() {
    return { payer_name:'บริษัท ไอเดีย เฮ้าส์เซ็นเตอร์ จำกัด (สำนักงานใหญ่)', payer_tax_id:'0105556022070',
      payer_address:'เลขที่ 80 อาคาร เค.เอ.เอ็น.เพลส ห้องเลขที่ 104 ชั้น 1 ซ.นราธิวาสราชนครินทร์ 8 แขวงทุ่งวัดดอน เขตสาทร กรุงเทพฯ 10120',
      tax_year: new Date().getFullYear(), payee_name:'', payee_tax_id:'', payee_address:'',
      pnd_form:'ภ.ง.ด.3', pnd_seq:1, income_type:'ม.3 เตรส', income_desc:'',
      total_income:'', total_tax:'', fund_gpf:0, fund_sso:0, fund_pvf:0, withhold_method:1,
	items:[{ pay_date:'', description:'', income_amount:'', tax_rate:'', tax_amount:'', pnd_form:'ภ.ง.ด.3', income_type:'ม.3 เตรส' }] };
  }

  const whtApi = async (url, opts={}) => {
    const token = localStorage.getItem('token');
    const res = await fetch(url, { ...opts, headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token, ...opts.headers }});
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error || res.statusText); }
    return res.json();
  };

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/withholding?year='+filterYear;
      if (filterStatus) url += '&status='+filterStatus;
      setList(await whtApi(url));
    } catch(e){ setError(e.message); }
    setLoading(false);
  }, [filterYear, filterStatus]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleSubmit = async () => {
    try {
      setError('');
      // คำนวณยอดรวมจาก items อัตโนมัติ (ไม่ใช้ค่าที่กรอกเอง)
      const itemsClean = form.items.map(i => ({
        ...i,
        income_amount: parseFloat(i.income_amount) || 0,
        tax_amount: parseFloat(i.tax_amount) || 0,
      }));
      const sumIncome = itemsClean.reduce((s, i) => s + i.income_amount, 0);
      const sumTax = itemsClean.reduce((s, i) => s + i.tax_amount, 0);
      const p = { ...form, total_income: sumIncome, total_tax: sumTax, items: itemsClean };
      if (editId) await whtApi('/api/withholding/'+editId, { method:'PATCH', body:JSON.stringify(p) });
      else await whtApi('/api/withholding', { method:'POST', body:JSON.stringify(p) });
      setShowForm(false); setEditId(null); setForm(getEmptyWhtForm()); fetchList();
    } catch(e){ setError(e.message); }
  };

  const handleIssue = async (id) => { if (!confirm('ออกเอกสารจริง?')) return; try { await whtApi('/api/withholding/'+id+'/issue',{method:'POST'}); fetchList(); } catch(e){ setError(e.message); } };
  const handleDelete = async (id) => { if (!confirm('ลบเอกสาร?')) return; try { await whtApi('/api/withholding/'+id,{method:'DELETE'}); fetchList(); } catch(e){ setError(e.message); } };
  const handleEdit = async (id) => {
    try {
      const d = await whtApi('/api/withholding/'+id);
      const allowedRates = ['0','1','2','3','5','10','15'];
      const itemsWithRate = (d.items||[]).map(i => {
        const inc = parseFloat(i.income_amount)||0;
        const tax = parseFloat(i.tax_amount)||0;
        // reverse calc rate; ถ้าไม่ตรงกับ dropdown ปล่อย '' ให้ผู้ใช้เลือกใหม่
        let tax_rate = '';
        if (inc > 0 && tax > 0) {
          const r = +(tax/inc*100).toFixed(2);
          // exact match (ตัวเลข) หรือ near-match (±0.01) เผื่อ rounding
          const matched = allowedRates.find(ar => Math.abs(parseFloat(ar) - r) < 0.01);
          if (matched) tax_rate = matched;
        }
        return { ...i, tax_rate };
      });
      const finalItems = itemsWithRate.length
        ? itemsWithRate
        : [{pay_date:'',description:'',income_amount:'',tax_rate:'',tax_amount:'',pnd_form:'ภ.ง.ด.3',income_type:'ม.3 เตรส'}];
      setForm({...d, total_income:d.total_income||'', total_tax:d.total_tax||'', items:finalItems});
      setEditId(id);
      setShowForm(true);
    } catch(e){ setError(e.message); }
  };
  const openPdf = async (id) => { try { const token = localStorage.getItem('token'); const res = await fetch('/api/withholding/'+id+'/pdf', { headers: { Authorization: 'Bearer '+token }}); const blob = await res.blob(); const url = URL.createObjectURL(blob); window.open(url,'_blank'); } catch(e){ setError(e.message); } };

  const addItem = () => setForm(f=>({...f, items:[...f.items,{pay_date:'',description:'',income_amount:'',tax_rate:'',tax_amount:'',pnd_form:'ภ.ง.ด.3',income_type:'ม.3 เตรส'}]}));
  const removeItem = (idx) => setForm(f=>({...f, items:f.items.filter((_,i)=>i!==idx)}));
  const updateItem = (idx,k,v) => setForm(f=>({...f, items:f.items.map((it,i)=>{
    if (i!==idx) return it;
    const updated = {...it, [k]:v};
    // auto-calc tax_amount เมื่อเปลี่ยน rate หรือ income_amount
    if (k==='tax_rate' || k==='income_amount') {
      const inc = parseFloat(updated.income_amount)||0;
      const rate = parseFloat(updated.tax_rate)||0;
      updated.tax_amount = (inc>0 && rate>0) ? +(inc*rate/100).toFixed(2) : '';
    }
    return updated;
  })}));

  return (
    <div>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)</h1>
        <button style={styles.btn('primary')} onClick={()=>{setForm(getEmptyWhtForm());setEditId(null);setShowForm(true);}}>+ สร้างเอกสาร</button>
      </div>

      {error && <div style={styles.error}>{error} <span style={{cursor:'pointer',float:'right'}} onClick={()=>setError('')}>✕</span></div>}

      <div style={styles.searchBar}>
        <select style={styles.input} value={filterYear} onChange={e=>setFilterYear(e.target.value)}>
          {[...Array(5)].map((_,i)=>{ const y=new Date().getFullYear()-i; return <option key={y} value={y}>{y+543}</option>; })}
        </select>
        <select style={{...styles.input, width:150}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">ทั้งหมด</option><option value="draft">ร่าง</option><option value="issued">ออกแล้ว</option>
        </select>
      </div>

      <div style={styles.card}>
        {loading ? <div style={{padding:40,textAlign:'center',color:'#888'}}>กำลังโหลด...</div> : (
          <table style={styles.table}>
            <thead><tr>
              <th style={styles.th}>เลขที่</th><th style={styles.th}>ผู้ถูกหัก</th><th style={styles.th}>แบบ</th>
              <th style={styles.th}>เงินได้</th><th style={styles.th}>ภาษี</th><th style={styles.th}>สถานะ</th><th style={styles.th}>จัดการ</th>
            </tr></thead>
            <tbody>
              {list.length===0 ? <tr><td colSpan={7} style={{...styles.td,textAlign:'center',color:'#aaa'}}>ไม่มีข้อมูล</td></tr> :
              list.map(r=>(
                <tr key={r.id}>
                  <td style={styles.td}>{r.doc_no}</td>
                  <td style={styles.td}>{r.payee_name}</td>
                  <td style={styles.td}>{r.pnd_form}</td>
                  <td style={{...styles.td,textAlign:'right'}}>{parseFloat(r.total_income).toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
                  <td style={{...styles.td,textAlign:'right'}}>{parseFloat(r.total_tax).toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
                  <td style={styles.td}><span style={styles.badge(ST_COLOR[r.status])}>{ST_LABEL[r.status]}</span></td>
                  <td style={styles.td}>
                    <div style={{display:'flex',gap:6}}>
                      <button style={{...styles.btn('default'),fontSize:12,padding:'4px 10px'}} onClick={()=>openPdf(r.id)}>PDF</button>
                      {r.status==='draft' && <>
                        <button style={{...styles.btn('default'),fontSize:12,padding:'4px 10px'}} onClick={()=>handleEdit(r.id)}>แก้ไข</button>
                        <button style={{...styles.btn('success'),fontSize:12,padding:'4px 10px'}} onClick={()=>handleIssue(r.id)}>ออกเอกสาร</button>
                        <button style={{...styles.btn('danger'),fontSize:12,padding:'4px 10px'}} onClick={()=>handleDelete(r.id)}>ลบ</button>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div style={styles.overlay}>
          <div style={{...styles.modal,width:750}} onClick={e=>e.stopPropagation()}>
            <div style={styles.modalHeader}><span style={styles.modalTitle}>{editId?'แก้ไขเอกสาร':'สร้างเอกสารหัก ณ ที่จ่าย'}</span><button onClick={()=>{setShowForm(false);setEditId(null);}} style={{background:'none',fontSize:20,color:'#888'}}>✕</button></div>
            <div style={styles.modalBody}>
              <div style={{background:'#f8fafc',padding:14,borderRadius:8,marginBottom:16,border:'1px solid #e2e8f0'}}>
                <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>ผู้มีหน้าที่หักภาษี (บริษัท)</div>
                <div style={styles.formGrid}>
                  <div><label style={styles.label}>ชื่อ</label><input style={styles.input} value={form.payer_name} onChange={e=>setForm(f=>({...f,payer_name:e.target.value}))} /></div>
                  <div><label style={styles.label}>เลขผู้เสียภาษี</label><input style={styles.input} value={form.payer_tax_id} onChange={e=>setForm(f=>({...f,payer_tax_id:e.target.value}))} /></div>
                </div>
              </div>
              <div style={{background:'#f0f9ff',padding:14,borderRadius:8,marginBottom:16,border:'1px solid #bae6fd'}}>
                <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>ผู้ถูกหักภาษี</div>
                <div style={styles.formGrid}>
                  <div><label style={styles.label}>ชื่อ</label><input style={styles.input} value={form.payee_name} onChange={e=>setForm(f=>({...f,payee_name:e.target.value}))} /></div>
                  <div><label style={styles.label}>เลขบัตรประชาชน</label><input style={styles.input} value={form.payee_tax_id} onChange={e=>setForm(f=>({...f,payee_tax_id:e.target.value}))} /></div>
                  <div style={{gridColumn:'1/-1'}}><label style={styles.label}>ที่อยู่</label><input style={styles.input} value={form.payee_address} onChange={e=>setForm(f=>({...f,payee_address:e.target.value}))} /></div>
                </div>
              </div>

<div style={styles.formGrid}>
                <div><label style={styles.label}>ปีภาษี</label><input type="number" style={styles.input} value={form.tax_year} onChange={e=>setForm(f=>({...f,tax_year:parseInt(e.target.value)}))} /></div>
                <div><label style={styles.label}>วิธีหัก</label><select style={styles.input} value={form.withhold_method} onChange={e=>setForm(f=>({...f,withhold_method:parseInt(e.target.value)}))}><option value={1}>หัก ณ ที่จ่าย</option><option value={2}>ออกให้ตลอดไป</option><option value={3}>ออกให้ครั้งเดียว</option><option value={4}>อื่นๆ</option></select></div>
              </div>
              <div style={{marginTop:16}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><span style={{fontSize:14,fontWeight:700}}>รายการจ่ายเงิน</span><button style={{...styles.btn('default'),fontSize:12,padding:'4px 10px'}} onClick={addItem}>+ เพิ่มรายการ</button></div>
                {form.items.map((item,idx)=>(
                  <div key={idx} style={{border:'1px solid #e2e8f0',borderRadius:8,padding:10,marginBottom:10}}>
                    <div style={{display:'flex',gap:8,marginBottom:6}}>
                      <div style={{flex:1}}><label style={{...styles.label,fontSize:11}}>แบบ ภ.ง.ด.</label><select style={styles.input} value={item.pnd_form||'ภ.ง.ด.3'} onChange={e=>updateItem(idx,'pnd_form',e.target.value)}>{PND_FORMS.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
                      <div style={{flex:1}}><label style={{...styles.label,fontSize:11}}>ประเภทเงินได้</label><select style={styles.input} value={item.income_type||'ม.3 เตรส'} onChange={e=>updateItem(idx,'income_type',e.target.value)}>{INCOME_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
                      {form.items.length>1 && <button style={{...styles.btn('danger'),padding:'4px 8px',fontSize:12,alignSelf:'flex-end'}} onClick={()=>removeItem(idx)}>✕</button>}
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
                      <div style={{width:110}}><label style={{...styles.label,fontSize:11}}>วันที่จ่าย</label><input style={styles.input} value={item.pay_date} onChange={e=>updateItem(idx,'pay_date',e.target.value)} placeholder="เม.ย. 69" /></div>
                      <div style={{flex:1}}><label style={{...styles.label,fontSize:11}}>รายละเอียด</label><input style={styles.input} value={item.description} onChange={e=>updateItem(idx,'description',e.target.value)} /></div>
                      <div style={{width:120}}><label style={{...styles.label,fontSize:11}}>จำนวนเงิน</label><input type="number" style={styles.input} value={item.income_amount} onChange={e=>updateItem(idx,'income_amount',e.target.value)} /></div>
                      <div style={{width:90}}><label style={{...styles.label,fontSize:11}}>หัก %</label><select style={styles.input} value={item.tax_rate||''} onChange={e=>updateItem(idx,'tax_rate',e.target.value)}><option value="">-</option><option value="0">0%</option><option value="1">1%</option><option value="2">2%</option><option value="3">3%</option><option value="5">5%</option><option value="10">10%</option><option value="15">15%</option></select></div>
                      <div style={{width:120}}><label style={{...styles.label,fontSize:11}}>ภาษี</label><input type="number" style={{...styles.input, background:'#f3f4f6', cursor:'not-allowed'}} value={item.tax_amount} readOnly title="คำนวณอัตโนมัติจาก จำนวนเงิน × หัก%" /></div>
                    </div>
                  </div>
                ))}
              </div>


              <div style={{...styles.formGrid,marginTop:12}}>
                <div>
                  <label style={styles.label}>รวมเงินได้</label>
                  <input type="number"
                    style={{...styles.input, background:'#f3f4f6', cursor:'not-allowed'}}
                    value={(form.items||[]).reduce((s,i)=>s+(parseFloat(i.income_amount)||0),0).toFixed(2)}
                    readOnly
                    title="คำนวณอัตโนมัติจากรายการจ่ายเงิน" />
                </div>
                <div>
                  <label style={styles.label}>รวมภาษี</label>
                  <input type="number"
                    style={{...styles.input, background:'#f3f4f6', cursor:'not-allowed'}}
                    value={(form.items||[]).reduce((s,i)=>s+(parseFloat(i.tax_amount)||0),0).toFixed(2)}
                    readOnly
                    title="คำนวณอัตโนมัติจากรายการจ่ายเงิน" />
                </div>
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.btn('default')} onClick={()=>{setShowForm(false);setEditId(null);}}>ยกเลิก</button>
              <button style={styles.btn('primary')} onClick={handleSubmit}>{editId?'บันทึก':'สร้างเอกสาร'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   IDHC Sales System — Phase 2: Stock + PO with Serial on Receive
   ตรงกับ schema จริง: suppliers, po_date, grand_total, quantity,
                       product_code, default_unit, notes, status=draft
   วางต่อท้าย App.jsx แทน StockPage + PurchaseOrderPage เดิม
============================================================ */
/* ============================================================
   IDHC Sales System — Phase 2: Stock + PO with Serial on Receive
   ตรงกับ schema จริง: suppliers, po_date, grand_total, quantity,
                       product_code, default_unit, notes, status=draft
   วางต่อท้าย App.jsx แทน StockPage + PurchaseOrderPage เดิม
============================================================ */
/* ============================================================
   IDHC Sales System — Phase 2: Stock + PO (Serial on Receive)
   ใช้ styles object เดิมของ project
   วางต่อท้าย App.jsx แทน StockPage + PurchaseOrderPage เดิม
============================================================ */

/* ========== STOCK MANAGEMENT PAGE ========== */
function StockPage() {
  const [tab, setTab] = React.useState('products');
  const [products, setProducts] = React.useState([]);
  const [suppliers, setSuppliers] = React.useState([]);
  const [categories, setCategories] = React.useState([]);
  const [filterType, setFilterType] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [showProductForm, setShowProductForm] = React.useState(false);
  const [editProduct, setEditProduct] = React.useState(null);
  const [showSupplierForm, setShowSupplierForm] = React.useState(false);
  const [editSupplier, setEditSupplier] = React.useState(null);
  const [detailProduct, setDetailProduct] = React.useState(null);

  const loadProducts = () => {
    const qs = new URLSearchParams();
    if (filterType) qs.append('product_type', filterType);
    if (search) qs.append('search', search);
    fetch(`/api/products?${qs}`, { headers: authHeaders() })
      .then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : []));
  };
  const loadSuppliers = () => {
    fetch('/api/suppliers', { headers: authHeaders() })
      .then(r => r.json()).then(d => setSuppliers(Array.isArray(d) ? d : []));
  };
  const loadCategories = () => {
    fetch('/api/product-categories', { headers: authHeaders() })
      .then(r => r.json()).then(d => setCategories(Array.isArray(d) ? d : []));
  };

  React.useEffect(() => { loadProducts(); loadCategories(); }, []);
  React.useEffect(() => { if (tab === 'suppliers') loadSuppliers(); }, [tab]);
  React.useEffect(() => { loadProducts(); }, [filterType, search]);

  const productTypeBadge = (t) => {
    if (t === 'service') return <span style={styles.badge('blue')}>บริการ</span>;
    if (t === 'non_stock') return <span style={styles.badge()}>เหมา</span>;
    return <span style={styles.badge('green')}>นับสต็อก</span>;
  };

  return (
    <div>
      <div style={styles.pageHeader}>
        <div style={styles.pageTitle}>คลังสินค้า</div>
      </div>

      <div style={styles.card}>
        <div style={styles.tabs}>
          <button style={styles.tab(tab === 'products')} onClick={() => setTab('products')}>สินค้า</button>
          <button style={styles.tab(tab === 'suppliers')} onClick={() => setTab('suppliers')}>ผู้จำหน่าย</button>
          <button style={styles.tab(tab === 'categories')} onClick={() => setTab('categories')}>หมวดหมู่</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* PRODUCTS */}
          {tab === 'products' && (
            <>
              <div style={styles.searchBar}>
                <input style={styles.searchInput}
                  placeholder="ค้นหา รหัส / ชื่อ / model"
                  value={search} onChange={e => setSearch(e.target.value)} />
                <select style={{ ...styles.searchInput, flex: 'none', width: 180 }} value={filterType}
                  onChange={e => setFilterType(e.target.value)}>
                  <option value="">ทุกประเภท</option>
                  <option value="service">บริการ</option>
                  <option value="non_stock">สินค้าเหมา</option>
                  <option value="stock">นับสต็อก</option>
                </select>
                <button style={styles.btn('primary')} onClick={() => { setEditProduct(null); setShowProductForm(true); }}>
                  + เพิ่มสินค้า
                </button>
              </div>

              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>รหัส</th>
                    <th style={styles.th}>Model</th>
                    <th style={styles.th}>ชื่อสินค้า</th>
                    <th style={styles.th}>ประเภท</th>
                    <th style={styles.th}>หมวดหมู่</th>
                    <th style={styles.th}>หน่วย</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>ราคาต้นทุน</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>คงเหลือ</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} style={styles.trHover}>
                      <td style={styles.td}>
                        <a style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}
                           onClick={() => setDetailProduct(p)}>{p.product_code}</a>
                      </td>
                      <td style={styles.td}>{p.model || '-'}</td>
                      <td style={styles.td}>{p.name}</td>
                      <td style={styles.td}>{productTypeBadge(p.product_type)}</td>
                      <td style={styles.td}>{p.category_name || '-'}</td>
                      <td style={styles.td}>{p.default_unit}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{Number(p.avg_cost || p.cost_price || 0).toLocaleString("th-TH", {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        {p.product_type === 'service' ? '-' : Number(p.stock_qty || 0).toLocaleString()}
                      </td>
                      <td style={styles.td}>
                        <button style={{ ...styles.btn(), padding: '4px 10px', fontSize: 12 }}
                          onClick={() => { setEditProduct(p); setShowProductForm(true); }}>แก้ไข</button>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr><td style={{ ...styles.td, textAlign: 'center', color: '#888', padding: 30 }} colSpan="9">ไม่มีข้อมูล</td></tr>
                  )}
                </tbody>
              </table>
            </>
          )}

          {/* SUPPLIERS */}
          {tab === 'suppliers' && (
            <>
              <div style={{ marginBottom: 20 }}>
                <button style={styles.btn('primary')} onClick={() => { setEditSupplier(null); setShowSupplierForm(true); }}>
                  + เพิ่มผู้จำหน่าย
                </button>
              </div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>รหัส</th>
                    <th style={styles.th}>ชื่อ</th>
                    <th style={styles.th}>เลขผู้เสียภาษี</th>
                    <th style={styles.th}>เบอร์โทร</th>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map(v => (
                    <tr key={v.id} style={styles.trHover}>
                      <td style={styles.td}>{v.code || '-'}</td>
                      <td style={styles.td}>{v.name}</td>
                      <td style={styles.td}>{v.tax_id || '-'}</td>
                      <td style={styles.td}>{v.phone || '-'}</td>
                      <td style={styles.td}>{v.email || '-'}</td>
                      <td style={styles.td}>
                        <button style={{ ...styles.btn(), padding: '4px 10px', fontSize: 12 }}
                          onClick={() => { setEditSupplier(v); setShowSupplierForm(true); }}>แก้ไข</button>
                      </td>
                    </tr>
                  ))}
                  {suppliers.length === 0 && (
                    <tr><td style={{ ...styles.td, textAlign: 'center', color: '#888', padding: 30 }} colSpan="6">ไม่มีข้อมูล</td></tr>
                  )}
                </tbody>
              </table>
            </>
          )}

          {/* CATEGORIES */}
          {tab === 'categories' && (
            <CategoriesTab categories={categories} onReload={loadCategories} />
          )}
        </div>
      </div>

      {showProductForm && (
        <ProductFormModal product={editProduct} categories={categories}
          onClose={() => setShowProductForm(false)}
          onSaved={() => { setShowProductForm(false); loadProducts(); }} />
      )}
      {detailProduct && (
        <ProductDetailModal product={detailProduct}
          onClose={() => { setDetailProduct(null); loadProducts(); }} />
      )}
      {showSupplierForm && (
        <SupplierFormModal supplier={editSupplier}
          onClose={() => setShowSupplierForm(false)}
          onSaved={() => { setShowSupplierForm(false); loadSuppliers(); }} />
      )}
    </div>
  );
}

/* ========== PRODUCT FORM MODAL ========== */
function ProductFormModal({ product, categories, onClose, onSaved }) {
  const [form, setForm] = React.useState(product || {
    name: '', model: '', description: '',
    category_id: '', product_type: 'stock',
    default_unit: 'ชิ้น', cost_price: 0, sell_price: 0,
  });
  const [err, setErr] = React.useState('');

  const save = async () => {
    setErr('');
    if (!form.name) { setErr('กรุณากรอกชื่อสินค้า'); return; }
    const url = product ? `/api/products/${product.id}` : '/api/products';
    const method = product ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error || 'เกิดข้อผิดพลาด'); return; }
    onSaved();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>{product ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</div>
          <button style={{ ...styles.btn(), padding: '4px 10px' }} onClick={onClose}>✕</button>
        </div>
        <div style={styles.modalBody}>
          {err && <div style={styles.error}>{err}</div>}
          <div style={styles.formGrid}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={styles.label}>ประเภทสินค้า *</label>
              <select style={styles.input} value={form.product_type}
                onChange={e => setForm(f => ({ ...f, product_type: e.target.value }))}>
                <option value="service">บริการ</option>
                <option value="non_stock">สินค้าเหมา</option>
                <option value="stock">สินค้านับสต็อก (มี Serial)</option>
              </select>
            </div>
            <div>
              <label style={styles.label}>Model</label>
              <input style={styles.input} value={form.model || ''}
                onChange={e => setForm(f => ({ ...f, model: e.target.value }))} />
            </div>
            <div>
              <label style={styles.label}>หมวดหมู่</label>
              <select style={styles.input} value={form.category_id || ''}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">-- เลือก --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={styles.label}>ชื่อสินค้า *</label>
              <input style={styles.input} value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={styles.label}>รายละเอียด</label>
              <textarea style={{ ...styles.input, minHeight: 60, resize: 'vertical' }} value={form.description || ''}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label style={styles.label}>หน่วย</label>
              <input style={styles.input} value={form.default_unit || ''}
                onChange={e => setForm(f => ({ ...f, default_unit: e.target.value }))} />
            </div>
            <div>
              <label style={styles.label}>ราคาทุน</label>
              <input type="number" style={styles.input} value={form.cost_price || 0}
                onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={styles.label}>ราคาต้นทุน</label>
              <input type="number" style={styles.input} value={form.sell_price || 0}
                onChange={e => setForm(f => ({ ...f, sell_price: e.target.value }))} />
            </div>
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.btn()} onClick={onClose}>ยกเลิก</button>
          <button style={styles.btn('primary')} onClick={save}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}

/* ========== PRODUCT DETAIL MODAL ========== */
function ProductDetailModal({ product, onClose }) {
  const [serials, setSerials] = React.useState([]);
  const [showAddSerial, setShowAddSerial] = React.useState(false);

  const load = () => {
    fetch(`/api/products/${product.id}/serials`, { headers: authHeaders() })
      .then(r => r.json()).then(d => setSerials(Array.isArray(d) ? d : []));
  };
  React.useEffect(load, [product.id]);

  const statusBadge = (s) => {
    if (s === 'available') return <span style={styles.badge('green')}>พร้อมขาย</span>;
    if (s === 'sold') return <span style={styles.badge('red')}>ขายแล้ว</span>;
    if (s === 'reserved') return <span style={styles.badge('blue')}>จอง</span>;
    return <span style={styles.badge()}>{s}</span>;
  };

  const deleteSerial = async (sid) => {
    if (!confirm('ยืนยันลบ Serial นี้?')) return;
    const res = await fetch(`/api/products/${product.id}/serials/${sid}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    if (res.ok) load(); else alert('ลบไม่ได้');
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.modal, width: 900 }} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalTitle}>{product.product_code} — {product.name}</div>
            <div style={{ ...styles.detailSub, marginTop: 4 }}>
              Model: {product.model || '-'} · หมวด: {product.category_name || '-'} · คงเหลือ: {Number(product.stock_qty || 0).toLocaleString()}
            </div>
          </div>
          <button style={{ ...styles.btn(), padding: '4px 10px' }} onClick={onClose}>✕</button>
        </div>
        <div style={styles.modalBody}>
          {product.product_type === 'stock' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1e3a5f' }}>
                  Serial / MAC Address ({serials.length})
                </div>
                <button style={styles.btn('primary')} onClick={() => setShowAddSerial(true)}>
                  + เพิ่ม Serial (แยก)
                </button>
              </div>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                <table style={styles.table}>
                  <thead>
<tr>
                      <th style={styles.th}>Serial No.</th>
                      <th style={styles.th}>MAC Address</th>
                      <th style={styles.th}>สถานะ</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>ต้นทุน</th>
                      <th style={styles.th}>PO</th>
                      <th style={styles.th}>วันที่รับ</th>
                      <th style={styles.th}>ผู้จำหน่าย</th>
                      <th style={styles.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {serials.map(s => (
                      <tr key={s.id}>
                        <td style={styles.td}><code>{s.serial_no}</code></td>
                        <td style={styles.td}>{s.mac_address || '-'}</td>
<td style={styles.td}>{statusBadge(s.status)}</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          {Number(s.cost_price || 0).toLocaleString()}
                        </td>
                        <td style={styles.td}>
                          {s.po_number || <span style={{ color: '#9ca3af', fontSize: 12 }}>เพิ่มมือ</span>}
                        </td>
                        <td style={styles.td}>{s.po_received_at ? new Date(s.po_received_at).toLocaleDateString('th-TH') : '-'}</td>
                        <td style={styles.td}>{s.supplier_name || '-'}</td>
                        <td style={styles.td}>
                          {s.status === 'available' && (
                            <button style={{ ...styles.btn('danger'), padding: '4px 10px', fontSize: 12 }}
                              onClick={() => deleteSerial(s.id)}>ลบ</button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {serials.length === 0 && (
                      <tr><td style={{ ...styles.td, textAlign: 'center', color: '#888', padding: 30 }} colSpan="8">
                        ยังไม่มี Serial — สร้าง PO แล้วกด "รับสินค้า" เพื่อบันทึก Serial
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: '#888', background: '#fafbfc', borderRadius: 8 }}>
              สินค้าประเภทนี้ไม่มี Serial/MAC
            </div>
          )}
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.btn()} onClick={onClose}>ปิด</button>
        </div>

        {showAddSerial && (
          <AddSerialModal productId={product.id}
            onClose={() => setShowAddSerial(false)}
            onSaved={() => { setShowAddSerial(false); load(); }} />
        )}
      </div>
    </div>
  );
}

/* ========== ADD SERIAL MODAL ========== */
function AddSerialModal({ productId, onClose, onSaved }) {
  const [form, setForm] = React.useState({ serial_no: '', mac_address: '', notes: '' });
  const [err, setErr] = React.useState('');
  const save = async () => {
    setErr('');
    if (!form.serial_no) { setErr('กรุณากรอก Serial'); return; }
    const res = await fetch(`/api/products/${productId}/serials`, {
      method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error || 'error'); return; }
    onSaved();
  };
  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.modal, width: 460 }} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>เพิ่ม Serial (ไม่ผ่าน PO)</div>
          <button style={{ ...styles.btn(), padding: '4px 10px' }} onClick={onClose}>✕</button>
        </div>
        <div style={styles.modalBody}>
          <div style={{ background: '#fef3c7', color: '#92400e', padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            ⚠️ แนะนำให้บันทึก Serial ผ่านการ "รับสินค้า" ของ PO เพื่อให้ track ต้นทางได้
          </div>
          {err && <div style={styles.error}>{err}</div>}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Serial No. *</label>
            <input style={styles.input} value={form.serial_no}
              onChange={e => setForm(f => ({ ...f, serial_no: e.target.value }))} />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>MAC Address</label>
            <input style={styles.input} value={form.mac_address}
              onChange={e => setForm(f => ({ ...f, mac_address: e.target.value }))} />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>หมายเหตุ</label>
            <input style={styles.input} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.btn()} onClick={onClose}>ยกเลิก</button>
          <button style={styles.btn('primary')} onClick={save}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}

/* ========== SUPPLIER FORM ========== */
function SupplierFormModal({ supplier, onClose, onSaved }) {
  const [form, setForm] = React.useState(supplier || {
    name: '', tax_id: '', phone: '', email: '', address: '', contact_person: '',
  });
  const [err, setErr] = React.useState('');
  const save = async () => {
    setErr('');
    if (!form.name) { setErr('กรุณากรอกชื่อ'); return; }
    const url = supplier ? `/api/suppliers/${supplier.id}` : '/api/suppliers';
    const method = supplier ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error || 'error'); return; }
    onSaved();
  };
  return (
    <div style={styles.overlay}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>{supplier ? 'แก้ไขผู้จำหน่าย' : 'เพิ่มผู้จำหน่าย'}</div>
          <button style={{ ...styles.btn(), padding: '4px 10px' }} onClick={onClose}>✕</button>
        </div>
        <div style={styles.modalBody}>
          {err && <div style={styles.error}>{err}</div>}
          <div style={styles.formGrid}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={styles.label}>ชื่อ *</label>
              <input style={styles.input} value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={styles.label}>เลขผู้เสียภาษี</label>
              <input style={styles.input} value={form.tax_id || ''}
                onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} />
            </div>
            <div>
              <label style={styles.label}>เบอร์โทร</label>
              <input style={styles.input} value={form.phone || ''}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label style={styles.label}>ผู้ติดต่อ</label>
              <input style={styles.input} value={form.contact_person || ''}
                onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
            </div>
            <div>
              <label style={styles.label}>Email</label>
              <input style={styles.input} value={form.email || ''}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={styles.label}>ที่อยู่</label>
              <textarea style={{ ...styles.input, minHeight: 60, resize: 'vertical' }} value={form.address || ''}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.btn()} onClick={onClose}>ยกเลิก</button>
          <button style={styles.btn('primary')} onClick={save}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}

/* ========== CATEGORIES TAB ========== */
function CategoriesTab({ categories, onReload }) {
  const [newName, setNewName] = React.useState('');
  const add = async () => {
    if (!newName.trim()) return;
    await fetch('/api/product-categories', {
      method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setNewName(''); onReload();
  };
  const remove = async (id) => {
    if (!confirm('ลบหมวดนี้?')) return;
    await fetch(`/api/product-categories/${id}`, { method: 'DELETE', headers: authHeaders() });
    onReload();
  };
  return (
    <div style={{ maxWidth: 600 }}>
      <div style={styles.searchBar}>
        <input style={styles.searchInput} placeholder="ชื่อหมวดหมู่ใหม่"
          value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()} />
        <button style={styles.btn('primary')} onClick={add}>+ เพิ่ม</button>
      </div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>ชื่อ</th>
            <th style={styles.th}></th>
          </tr>
        </thead>
        <tbody>
          {categories.map(c => (
            <tr key={c.id}>
              <td style={styles.td}>{c.name}</td>
              <td style={styles.td}>
                <button style={{ ...styles.btn('danger'), padding: '4px 10px', fontSize: 12 }}
                  onClick={() => remove(c.id)}>ลบ</button>
              </td>
            </tr>
          ))}
          {categories.length === 0 && (
            <tr><td style={{ ...styles.td, textAlign: 'center', color: '#888', padding: 30 }} colSpan="2">ไม่มีข้อมูล</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
   PURCHASE ORDER PAGE
============================================================ */
function PurchaseOrderPage() {
  const [orders, setOrders] = React.useState([]);
  const [receivePO, setReceivePO] = React.useState(null);
  const navigate = useNavigate();

  const load = () => {
    fetch('/api/purchase-orders', { headers: authHeaders() })
      .then(r => r.json()).then(d => setOrders(Array.isArray(d) ? d : []));
  };
  React.useEffect(load, []);

  const statusBadge = (s) => {
    if (s === 'draft') return <span style={styles.badge()}>แบบร่าง</span>;
    if (s === 'approved') return <span style={styles.badge('blue')}>อนุมัติแล้ว</span>;
    if (s === 'received') return <span style={styles.badge('green')}>รับสินค้าแล้ว</span>;
    if (s === 'cancelled') return <span style={styles.badge('red')}>ยกเลิก</span>;
    return <span style={styles.badge()}>{s}</span>;
  };

  return (
    <div>
      <div style={styles.pageHeader}>
        <div style={styles.pageTitle}>ใบสั่งซื้อ (Purchase Order)</div>
        <button style={styles.btn('primary')} onClick={() => navigate('/purchase/new')}>+ สร้างใบสั่งซื้อ</button>
      </div>

      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>เลขที่</th>
              <th style={styles.th}>วันที่</th>
              <th style={styles.th}>ผู้จำหน่าย</th>
              <th style={styles.th}>จำนวนรายการ</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>ยอดรวม</th>
              <th style={styles.th}>สถานะ</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} style={styles.trHover}>
                <td style={styles.td}>
                  <a style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}
                     onClick={() => navigate(`/purchase/${o.id}`)}>{o.po_number}</a>
                </td>
                <td style={styles.td}>{new Date(o.po_date).toLocaleDateString('th-TH')}</td>
                <td style={styles.td}>{o.supplier_name}</td>
                <td style={styles.td}>{o.item_count}</td>
                <td style={{ ...styles.td, textAlign: 'right' }}>{Number(o.grand_total).toLocaleString()}</td>
                <td style={styles.td}>{statusBadge(o.status)}</td>
                <td style={styles.td}>
<div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button style={{ ...styles.btn(), padding: '6px 12px', fontSize: 12 }}
                    onClick={() => navigate(`/purchase/${o.id}`)}>ดู</button>
                  {o.status === 'draft' && (
                    <button style={{ ...styles.btn(), padding: '6px 12px', fontSize: 12 }}
                      onClick={() => navigate(`/purchase/${o.id}/edit`)}>แก้ไข</button>
                  )}
                  {o.status === 'draft' && (
                    <button style={{ ...styles.btn('primary'), padding: '6px 12px', fontSize: 12 }}
                      onClick={async () => {
                        if (!confirm(`อนุมัติ PO ${o.po_number}?`)) return;
                        const res = await fetch(`/api/purchase-orders/${o.id}/approve`, {
                          method: 'POST', headers: authHeaders(),
                        });
                        if (res.ok) load();
                        else { const d = await res.json(); alert(d.error || 'error'); }
                      }}>อนุมัติ</button>
                  )}
                  {o.status === 'approved' && (
                    <button style={{ ...styles.btn('success'), padding: '6px 12px', fontSize: 12 }}
                      onClick={() => setReceivePO(o)}>รับสินค้า</button>
                  )}
                </div>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td style={{ ...styles.td, textAlign: 'center', color: '#888', padding: 30 }} colSpan="7">ไม่มีข้อมูล</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {receivePO && (
        <ReceivePOModal poId={receivePO.id}
          onClose={() => setReceivePO(null)}
          onDone={() => { setReceivePO(null); load(); }} />
      )}
    </div>
  );
}

/* ========== PO FORM MODAL ========== */
/* ========== PO FORM PAGE (สร้าง/แก้ไข PO) ========== */
function POFormPage() {
  const navigate = useNavigate();
  const { id: editIdParam } = useParams();
  const editId = editIdParam ? parseInt(editIdParam) : null;
  const [editPO, setEditPO] = React.useState(null);
  const [loading, setLoading] = React.useState(!!editId);

  // โหลด PO เดิมถ้าเป็น edit mode
  React.useEffect(() => {
    if (!editId) return;
    fetch(`/api/purchase-orders/${editId}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => { setEditPO(data); setLoading(false); })
      .catch(err => { setLoading(false); alert('โหลด PO ไม่สำเร็จ: ' + err.message); navigate('/purchase'); });
  }, [editId]);

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: '#888' }}>กำลังโหลด...</div>;
  }
  if (editId && !editPO) return null;

  return <POFormInner editPO={editPO} onCancel={() => navigate(-1)} onSaved={(savedId) => navigate(`/purchase/${savedId}`)} />;
}

function POFormInner({ editPO, onCancel, onSaved }) {
  const [suppliers, setSuppliers] = React.useState([]);
  const [products, setProducts] = React.useState([]);
const [form, setForm] = React.useState(() => editPO ? {
    supplier_id: editPO.supplier_id || '',
    po_date: editPO.po_date ? new Date(editPO.po_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    notes: editPO.notes || '',
    vat_rate: editPO.vat_rate ?? 7,
    ordered_by_staff_id: editPO.ordered_by_staff_id || '',
    job_name: editPO.job_name || '',
    credit_days: editPO.credit_days ?? 30,
    wht_rate: editPO.wht_rate ?? 0,
  } : {
    supplier_id: '', po_date: new Date().toISOString().slice(0, 10),
    notes: '', vat_rate: 7,
    ordered_by_staff_id: '', job_name: '', credit_days: 30, wht_rate: 0,
  });
const [items, setItems] = React.useState(() => {
    if (editPO && Array.isArray(editPO.items) && editPO.items.length > 0) {
      return editPO.items.map(it => ({
        product_id: it.product_id || '',
        quantity: it.quantity ?? 1,
        unit_price: it.unit_price ?? 0,
        unit: it.unit || 'ชิ้น',
        description: it.description || '',
        wht_rate: it.wht_rate ?? 0,
        pnd_form: it.pnd_form || '',
        income_type: it.income_type || '',
      }));
    }
    return [{ product_id: '', quantity: 1, unit_price: 0, unit: 'ชิ้น', description: '', wht_rate: 0, pnd_form: '', income_type: '' }];
  });
  const [staffList, setStaffList] = React.useState([]);
  const [err, setErr] = React.useState('');
  React.useEffect(() => {
    fetch('/api/suppliers', { headers: authHeaders() }).then(r => r.json())
      .then(d => setSuppliers(Array.isArray(d) ? d : []));
    fetch('/api/products', { headers: authHeaders() }).then(r => r.json())
      .then(d => setProducts(Array.isArray(d) ? d : []));
    fetch('/api/staff?limit=500', { headers: authHeaders() }).then(r => r.json())
      .then(d => setStaffList(Array.isArray(d) ? d : (d.data || [])));
    // ถ้า edit mode + ยังไม่มี items → โหลด PO detail เต็ม
    if (editPO && (!editPO.items || editPO.items.length === 0)) {
      fetch(`/api/purchase-orders/${editPO.id}`, { headers: authHeaders() })
        .then(r => r.json())
        .then(full => {
          if (full && Array.isArray(full.items)) {
            setItems(full.items.map(it => ({
              product_id: it.product_id || '',
              quantity: it.quantity ?? 1,
              unit_price: it.unit_price ?? 0,
              unit: it.unit || 'ชิ้น',
              description: it.description || '',
              wht_rate: it.wht_rate ?? 0,
              pnd_form: it.pnd_form || '',
              income_type: it.income_type || '',
            })));
          }
        });
    }
  }, []);

  const addItem = () => setItems([...items, { product_id: '', quantity: 1, unit_price: 0, unit: 'ชิ้น', description: '', wht_rate: 0, pnd_form: '', income_type: '' }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const setItem = (i, field, val) => {
    const next = [...items]; next[i][field] = val;
    if (field === 'product_id') {
      const p = products.find(pp => String(pp.id) === String(val));
      if (p) {
        next[i].unit_price = p.cost_price || 0;
        next[i].unit = p.default_unit || 'ชิ้น';
      }
    }
    setItems(next);
  };

  const subtotal = items.reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.unit_price || 0)), 0);
  const vat = subtotal * (Number(form.vat_rate || 0) / 100);
  const total = subtotal + vat;
  const whtTotal = items.reduce((s, it) => {
    const line = Number(it.quantity || 0) * Number(it.unit_price || 0);
    return s + (line * Number(it.wht_rate || 0) / 100);
  }, 0);

  const save = async () => {
    setErr('');
    if (!form.supplier_id) { setErr('กรุณาเลือกผู้จำหน่าย'); return; }
    const validItems = items.filter(it => it.product_id && Number(it.quantity) > 0);
    if (validItems.length === 0) { setErr('ต้องมีรายการสินค้าอย่างน้อย 1'); return; }
    // ถ้ามีรายการที่มีหัก ณ ที่จ่าย ต้องเลือกแบบ ภ.ง.ด. + ประเภทเงินได้ ครบทุกตัว
    const whtItems = validItems.filter(it => Number(it.wht_rate) > 0);
    if (whtItems.some(it => !it.pnd_form)) {
      setErr('รายการที่มีหัก ณ ที่จ่ายต้องระบุแบบ ภ.ง.ด.ทุกตัว'); return;
    }
    if (whtItems.some(it => !it.income_type)) {
      setErr('รายการที่มีหัก ณ ที่จ่ายต้องระบุประเภทเงินได้ทุกตัว'); return;
    }

    const url = editPO ? `/api/purchase-orders/${editPO.id}` : '/api/purchase-orders';
    const method = editPO ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, items: validItems }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error || 'error'); return; }
    onSaved(data.id || (editPO && editPO.id));
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px 80px' }}>
      <div style={{ ...styles.pageHeader, marginBottom: 16 }}>
        <div>
          <button onClick={onCancel} style={{ ...styles.btn(), padding: '6px 12px', fontSize: 13, marginBottom: 8 }}>
            ← กลับ
          </button>
          <div style={styles.pageTitle}>{editPO ? `แก้ไขใบสั่งซื้อ: ${editPO.po_number}` : 'สร้างใบสั่งซื้อ'}</div>
        </div>
      </div>
      <div style={{ ...styles.card, padding: 24 }}>
        <div>
          {err && <div style={styles.error}>{err}</div>}

          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>ผู้จำหน่าย *</label>
              <select style={styles.input} value={form.supplier_id}
                onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                <option value="">-- เลือก --</option>
                {suppliers.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>วันที่</label>
              <input type="date" style={styles.input} value={form.po_date}
                onChange={e => setForm(f => ({ ...f, po_date: e.target.value }))} />
            </div>
<div>
              <label style={styles.label}>ผู้สั่งซื้อ</label>
              <select style={styles.input} value={form.ordered_by_staff_id || ''}
                onChange={e => setForm(f => ({ ...f, ordered_by_staff_id: e.target.value }))}>
                <option value="">-- เลือก --</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.first_name_th} {s.last_name_th}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.label}>ชื่องาน</label>
              <input style={styles.input} value={form.job_name || ''}
                onChange={e => setForm(f => ({ ...f, job_name: e.target.value }))}
                placeholder="เช่น Cer บำรุงราษฎร์" />
            </div>
            <div>
              <label style={styles.label}>เครดิต (วัน)</label>
              <input type="number" style={styles.input} value={form.credit_days || 0}
                onChange={e => setForm(f => ({ ...f, credit_days: e.target.value }))} />
            </div>
            <div>
              <label style={styles.label}>ครบกำหนด</label>
              <input style={{ ...styles.input, background: '#f9fafb', color: '#6b7280' }}
                value={(() => {
                  if (!form.po_date) return '';
                  const d = new Date(form.po_date);
                  d.setDate(d.getDate() + Number(form.credit_days || 0));
                  return d.toLocaleDateString('th-TH');
                })()} readOnly />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={styles.label}>หมายเหตุ</label>
              <input style={styles.input} value={form.notes || ''}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={styles.label}>VAT</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button"
                  style={{
                    ...styles.btn(), flex: 1,
                    background: Number(form.vat_rate) > 0 ? '#1e3a5f' : '#f3f4f6',
                    color: Number(form.vat_rate) > 0 ? '#fff' : '#555',
                  }}
                  onClick={() => setForm(f => ({ ...f, vat_rate: 7 }))}>
                  VAT 7%
                </button>
                <button type="button"
                  style={{
                    ...styles.btn(), flex: 1,
                    background: Number(form.vat_rate) === 0 ? '#1e3a5f' : '#f3f4f6',
                    color: Number(form.vat_rate) === 0 ? '#fff' : '#555',
                  }}
                  onClick={() => setForm(f => ({ ...f, vat_rate: 0 }))}>
                  ไม่มี VAT
                </button>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 15, fontWeight: 600, color: '#1e3a5f', marginTop: 24, marginBottom: 10 }}>
            รายการสินค้า
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>สินค้า</th>
                <th style={{ ...styles.th, width: 80 }}>จำนวน</th>
                <th style={{ ...styles.th, width: 110 }}>ราคา/หน่วย</th>
                <th style={{ ...styles.th, width: 110, textAlign: 'right' }}>รวม</th>
                <th style={{ ...styles.th, width: 110 }}>แบบ ภ.ง.ด.</th>
                <th style={{ ...styles.th, width: 110 }}>ประเภท</th>
                <th style={{ ...styles.th, width: 90 }}>หัก %</th>
                <th style={{ ...styles.th, width: 90, textAlign: 'right' }}>หักเงิน</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <React.Fragment key={i}>
                  <tr>
                    <td style={styles.td}>
                      <select style={styles.input} value={it.product_id}
                        onChange={e => setItem(i, 'product_id', e.target.value)}>
                        <option value="">-- เลือก --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.product_code} {p.model ? `· ${p.model}` : ''} · {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={styles.td}>
                      <input type="number" style={styles.input} value={it.quantity}
                        onChange={e => setItem(i, 'quantity', e.target.value)} />
                    </td>
                    <td style={styles.td}>
                      <input type="number" style={styles.input} value={it.unit_price}
                        onChange={e => setItem(i, 'unit_price', e.target.value)} />
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {(Number(it.quantity || 0) * Number(it.unit_price || 0)).toLocaleString()}
                    </td>
                    <td style={styles.td}>
                      <select style={{ ...styles.input, fontSize: 12 }}
                        value={it.pnd_form || ''}
                        disabled={!Number(it.wht_rate)}
                        onChange={e => setItem(i, 'pnd_form', e.target.value)}>
                        <option value="">— เลือก —</option>
                        {PND_FORMS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td style={styles.td}>
                      <select style={{ ...styles.input, fontSize: 12 }}
                        value={it.income_type || ''}
                        disabled={!Number(it.wht_rate)}
                        onChange={e => setItem(i, 'income_type', e.target.value)}>
                        <option value="">— เลือก —</option>
                        {INCOME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td style={styles.td}>
                      <select style={styles.input} value={it.wht_rate ?? 0}
                        onChange={e => {
                          const newRate = Number(e.target.value);
                          setItem(i, 'wht_rate', newRate);
                          // ถ้า rate กลายเป็น 0 → clear pnd_form + income_type
                          if (newRate === 0) {
                            setItem(i, 'pnd_form', '');
                            setItem(i, 'income_type', '');
                          }
                        }}>
                        <option value={0}>0%</option>
                        <option value={1}>1%</option>
                        <option value={2}>2%</option>
                        <option value={3}>3%</option>
                        <option value={5}>5%</option>
                        <option value={10}>10%</option>
                        <option value={15}>15%</option>
                      </select>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', color: '#c41556' }}>
                      {((Number(it.quantity || 0) * Number(it.unit_price || 0)) * Number(it.wht_rate || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={styles.td}>
                      <button style={{ ...styles.btn('danger'), padding: '4px 10px', fontSize: 12 }}
                        onClick={() => removeItem(i)}>ลบ</button>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={7} style={{ ...styles.td, paddingTop: 0, paddingBottom: 12 }}>
                      <textarea
                        style={{ ...styles.input, minHeight: 50, fontSize: 13, resize: 'vertical' }}
                        value={it.description || ''}
                        onChange={e => setItem(i, 'description', e.target.value)}
                        placeholder="↳ รายละเอียดเพิ่มเติม (ถ้ามี) เช่น สเปค ขนาด สถานที่ติดตั้ง"
                      />
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <button style={{ ...styles.btn(), marginTop: 8 }} onClick={addItem}>+ เพิ่มรายการ</button>

          <div style={{
            marginTop: 24, padding: 16, background: '#fafbfc', borderRadius: 8,
            textAlign: 'right', lineHeight: 1.8
          }}>
            <div style={{ fontSize: 14 }}>ยอดก่อน VAT: <b>{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
            <div style={{ fontSize: 14 }}>VAT {form.vat_rate}%: <b>{vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
            <div style={{ fontSize: 18, marginTop: 4 }}>ยอดสุทธิ: <b style={{ color: '#059669' }}>{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
            {whtTotal > 0 && (
              <>
                <div style={{ borderTop: '1px solid #e5e7eb', margin: '8px 0' }}></div>
                <div style={{ fontSize: 14 }}>รวมหัก ณ ที่จ่าย: <b style={{ color: '#c41556' }}>{whtTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
                <div style={{ fontSize: 16 }}>ยอดชำระสุทธิ: <b style={{ color: '#c41556' }}>{(total - whtTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
          <button style={styles.btn()} onClick={onCancel}>ยกเลิก</button>
          <button style={styles.btn('primary')} onClick={save}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}

/* ========== PO DETAIL MODAL ========== */


/* ========== SETTINGS PAGE ========== */
function SettingsPage() {
  const [activeTab, setActiveTab] = useState('banks');
  return (
    <div>
      <div style={styles.pageHeader}>
        <div style={styles.pageTitle}>⚙️ ตั้งค่าระบบ</div>
      </div>
      <div style={styles.card}>
        <div style={styles.tabs}>
          <button style={styles.tab(activeTab === 'banks')} onClick={() => setActiveTab('banks')}>
            🏦 บัญชีธนาคารบริษัท
          </button>
        </div>
        {activeTab === 'banks' && <BankAccountsTab />}
      </div>
    </div>
  );
}

/* ========== BANK ACCOUNTS TAB ========== */
function BankAccountsTab() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => {
    setLoading(true);
    fetch('/api/company-bank-accounts', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setAccounts(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const remove = async (acc) => {
    if (!confirm(`ลบบัญชี "${acc.bank_name} ${acc.account_number}"?`)) return;
    const res = await fetch(`/api/company-bank-accounts/${acc.id}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.soft) alert(d.message || 'บัญชีถูกใช้ใน PO แล้ว — ปิดการใช้งานแทน');
      load();
    } else {
      alert('ลบไม่สำเร็จ');
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>กำลังโหลด...</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ color: '#6b7280', fontSize: 13 }}>
          บัญชีธนาคารของบริษัทที่ใช้จ่ายเงินให้ supplier ({accounts.length} บัญชี)
        </div>
        <button style={styles.btn('primary')} onClick={() => { setEditing(null); setShowForm(true); }}>
          + เพิ่มบัญชี
        </button>
      </div>
      {accounts.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', background: '#fafbfc', borderRadius: 8 }}>
          ยังไม่มีบัญชี — กด "+ เพิ่มบัญชี" เพื่อเริ่มต้น
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ธนาคาร</th>
              <th style={styles.th}>สาขา</th>
              <th style={styles.th}>เลขบัญชี</th>
              <th style={styles.th}>ชื่อบัญชี</th>
              <th style={styles.th}>สถานะ</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id}>
                <td style={styles.td}>
                  {a.bank_name}
                  {a.is_default && <span style={{ ...styles.badge('blue'), marginLeft: 8 }}>default</span>}
                </td>
                <td style={styles.td}>{a.branch || '-'}</td>
                <td style={{ ...styles.td, fontFamily: 'monospace' }}>{a.account_number}</td>
                <td style={styles.td}>{a.account_name}</td>
                <td style={styles.td}>
                  {a.is_active
                    ? <span style={styles.badge('green')}>ใช้งาน</span>
                    : <span style={styles.badge()}>ปิดใช้งาน</span>}
                </td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  <button style={{ ...styles.btn(), padding: '4px 12px', fontSize: 12, marginRight: 6 }}
                    onClick={() => { setEditing(a); setShowForm(true); }}>แก้ไข</button>
                  <button style={{ ...styles.btn('danger'), padding: '4px 12px', fontSize: 12 }}
                    onClick={() => remove(a)}>ลบ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {showForm && (
        <BankAccountFormModal
          account={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

/* ========== BANK ACCOUNT FORM MODAL ========== */
function BankAccountFormModal({ account, onClose, onSaved }) {
  const editing = !!account;
  const [form, setForm] = useState({
    bank_name: account?.bank_name || '',
    branch: account?.branch || '',
    account_number: account?.account_number || '',
    account_name: account?.account_name || 'บริษัท ไอเดีย เฮ้าส์ เซ็นเตอร์ จำกัด',
    is_active: account ? !!account.is_active : true,
    is_default: account ? !!account.is_default : false,
    display_order: account?.display_order ?? 0,
    notes: account?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setError('');
    if (!form.bank_name.trim()) { setError('กรุณากรอกชื่อธนาคาร'); return; }
    if (!form.account_number.trim()) { setError('กรุณากรอกเลขบัญชี'); return; }
    if (!form.account_name.trim()) { setError('กรุณากรอกชื่อบัญชี'); return; }

    setSaving(true);
    try {
      const url = editing ? `/api/company-bank-accounts/${account.id}` : '/api/company-bank-accounts';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'บันทึกไม่สำเร็จ');
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>{editing ? 'แก้ไขบัญชีธนาคาร' : 'เพิ่มบัญชีธนาคาร'}</div>
          <button style={{ ...styles.btn(), padding: '4px 10px' }} onClick={onClose}>✕</button>
        </div>
        <div style={styles.modalBody}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.inputGroup}>
            <label style={styles.label}>ธนาคาร *</label>
            <input style={styles.input} value={form.bank_name}
              onChange={e => set('bank_name', e.target.value)}
              placeholder="เช่น ธนาคารกสิกรไทย, ธนาคารกรุงไทย" />
          </div>

          <div style={styles.formGrid}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>สาขา</label>
              <input style={styles.input} value={form.branch}
                onChange={e => set('branch', e.target.value)}
                placeholder="เช่น สาขาสาทร" />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>เลขบัญชี *</label>
              <input style={styles.input} value={form.account_number}
                onChange={e => set('account_number', e.target.value)}
                placeholder="เช่น 123-4-56789-0" />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>ชื่อบัญชี *</label>
            <input style={styles.input} value={form.account_name}
              onChange={e => set('account_name', e.target.value)} />
          </div>

          <div style={styles.formGrid}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>ลำดับการแสดง</label>
              <input style={styles.input} type="number" value={form.display_order}
                onChange={e => set('display_order', e.target.value)} />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>หมายเหตุ</label>
              <input style={styles.input} value={form.notes}
                onChange={e => set('notes', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)} />
              ใช้งาน
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={form.is_default}
                onChange={e => set('is_default', e.target.checked)} />
              ตั้งเป็นบัญชี default
            </label>
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.btn()} onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button style={styles.btn('primary')} onClick={submit} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : (editing ? 'บันทึก' : 'เพิ่ม')}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ========== SLIP LIST (เฉพาะใน PODetail ส่วนการชำระเงิน) ========== */
function SlipList({ poId }) {
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`/api/purchase-orders/${poId}/documents?type=slip`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setSlips(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [poId]);

  if (loading) return null;
  if (slips.length === 0) return null;

  const fmtSize = (n) => {
    if (!n) return '';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div style={{
      gridColumn: 'span 3',
      marginTop: 8, padding: '10px 14px',
      background: '#fff', border: '1px solid #d1fae5', borderRadius: 6,
    }}>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 8 }}>
        📎 สลิปโอนเงิน ({slips.length})
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {slips.map(s => (
          <a key={s.id}
            href={`/api/purchase-orders/${poId}/documents/${s.id}/download?t=${localStorage.getItem('token')}`}
            target="_blank" rel="noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', background: '#f0fdf4',
              border: '1px solid #bbf7d0', borderRadius: 6,
              fontSize: 12, color: '#059669', textDecoration: 'none',
            }}>
            🖼️ {s.file_name} <span style={{ color: '#9ca3af' }}>({fmtSize(s.file_size)})</span>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ========== PAY MODAL (Form Modal — overlay ไม่ปิด) ========== */
function PayModal({ po, onClose, onSuccess }) {
  const grandTotal = Number(po.grand_total || 0);
  const whtAmount = Number(po.wht_amount || 0);
  const netDefault = +(grandTotal - whtAmount).toFixed(2);
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    payment_date: today,
    payment_method: 'transfer',
    payment_reference: '',
    payment_amount: String(netDefault),
    payment_notes: '',
    payment_bank_account_id: '',
  });
  const [banks, setBanks] = useState([]);
  const [slipFiles, setSlipFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load active bank accounts + auto-select default
  useEffect(() => {
    fetch('/api/company-bank-accounts?active=1', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : [];
        setBanks(list);
        const def = list.find(b => b.is_default) || list[0];
        if (def) setForm(f => ({ ...f, payment_bank_account_id: String(def.id) }));
      })
      .catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setError('');
    if (!form.payment_date) { setError('กรุณาเลือกวันที่จ่าย'); return; }
    if (!form.payment_method) { setError('กรุณาเลือกวิธีจ่าย'); return; }
    if (!form.payment_bank_account_id) { setError('กรุณาเลือกบัญชีธนาคารบริษัท'); return; }
    const amt = Number(form.payment_amount);
    if (!amt || amt <= 0) { setError('กรุณากรอกยอดที่จ่าย'); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/payment`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_status: 'paid',
          payment_date: form.payment_date,
          payment_method: form.payment_method,
          payment_reference: form.payment_reference || null,
          payment_amount: amt,
          payment_notes: form.payment_notes || null,
          payment_bank_account_id: Number(form.payment_bank_account_id),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'จ่ายเงินไม่สำเร็จ');
      }
      const data = await res.json();

      // Upload slip files (if any) — non-blocking failure
      if (slipFiles.length > 0) {
        for (const f of slipFiles) {
          try {
            const fd = new FormData();
            fd.append('file', f);
            fd.append('doc_type', 'slip');
            await fetch(`/api/purchase-orders/${po.id}/documents`, {
              method: 'POST', headers: authHeaders(), body: fd,
            });
          } catch (e) {
            console.warn('upload slip failed:', e);
          }
        }
      }

      onSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>💳 จ่ายเงิน — PO: {po.po_number}</div>
          <button style={{ ...styles.btn(), padding: '4px 10px' }} onClick={onClose}>✕</button>
        </div>
        <div style={styles.modalBody}>
          {/* กล่องสรุปยอด */}
          <div style={{
            background: '#fafbfc', border: '1px solid #f0f2f5', borderRadius: 8,
            padding: '12px 16px', marginBottom: 16, fontSize: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#6b7280' }}>ยอดรวม</span>
              <span><b>{fmt(grandTotal)}</b> บาท</span>
            </div>
            {whtAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#6b7280' }}>หัก ณ ที่จ่าย</span>
                <span style={{ color: '#c41556' }}>−{fmt(whtAmount)} บาท</span>
              </div>
            )}
            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 8, paddingTop: 8,
                          display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
              <span style={{ fontWeight: 600 }}>ยอดสุทธิที่ต้องจ่าย</span>
              <span style={{ fontWeight: 700, color: '#1e3a5f' }}>{fmt(netDefault)} บาท</span>
            </div>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.formGrid}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>วันที่จ่าย *</label>
              <input style={styles.input} type="date" value={form.payment_date}
                onChange={e => set('payment_date', e.target.value)} />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>วิธีจ่าย *</label>
              <select style={styles.input} value={form.payment_method}
                onChange={e => set('payment_method', e.target.value)}>
                <option value="transfer">โอนเงิน</option>
                <option value="cash">เงินสด</option>
                <option value="cheque">เช็ค</option>
              </select>
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>จ่ายจากบัญชี *</label>
            {banks.length === 0 ? (
              <div style={{
                padding: '10px 14px', background: '#fef2f2',
                border: '1px solid #fecaca', borderRadius: 8,
                fontSize: 13, color: '#dc2626',
              }}>
                ⚠️ ยังไม่มีบัญชีธนาคารบริษัท — เพิ่มก่อนที่ <b>⚙️ ตั้งค่า → 🏦 บัญชีธนาคารบริษัท</b>
              </div>
            ) : (
              <select style={styles.input} value={form.payment_bank_account_id}
                onChange={e => set('payment_bank_account_id', e.target.value)}>
                <option value="">— เลือกบัญชี —</option>
                {banks.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name}{b.branch ? ` (${b.branch})` : ''} — {b.account_number} ({b.account_name})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>เลขอ้างอิง</label>
            <input style={styles.input} value={form.payment_reference}
              onChange={e => set('payment_reference', e.target.value)}
              placeholder="เลขเช็ค / เลขที่อ้างอิงโอน (ถ้ามี)" />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>ยอดที่จ่าย *</label>
            <input style={styles.input} type="number" step="0.01" value={form.payment_amount}
              onChange={e => set('payment_amount', e.target.value)} />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>หมายเหตุ</label>
            <textarea style={{ ...styles.input, minHeight: 60, resize: 'vertical' }}
              value={form.payment_notes}
              onChange={e => set('payment_notes', e.target.value)}
              placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>📎 แนบสลิปโอนเงิน (เลือกหลายไฟล์ได้)</label>
            <input type="file" multiple accept="image/*,.pdf"
              onChange={e => setSlipFiles(Array.from(e.target.files || []))}
              style={{
                width: '100%', padding: '8px 10px',
                border: '1px dashed #d1d5db', borderRadius: 8,
                fontSize: 13, background: '#fafbfc',
              }} />
            {slipFiles.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
                เลือกแล้ว {slipFiles.length} ไฟล์: {slipFiles.map(f => f.name).join(', ')}
              </div>
            )}
          </div>

          {whtAmount > 0 && (
            <div style={{
              background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
              padding: '10px 14px', fontSize: 13, color: '#2563eb',
            }}>
              ℹ️ ระบบจะสร้างใบหัก ณ ที่จ่ายอัตโนมัติเมื่อยืนยันการจ่ายเงิน
            </div>
          )}
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.btn()} onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button style={styles.btn('success')} onClick={submit} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : '✓ ยืนยันจ่ายเงิน'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========== PO DETAIL PAGE ========== */
function PODetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const poId = parseInt(id);
  const [receivePO, setReceivePO] = React.useState(null);

  if (!poId) return <Navigate to="/purchase" />;

  return <>
    <PODetailInner poId={poId}
      onClose={() => navigate('/purchase')}
      onReceive={(po) => setReceivePO(po)}
      onEdit={(po) => navigate(`/purchase/${po.id}/edit`)} />
    {receivePO && (
      <ReceivePOModal poId={receivePO.id}
        onClose={() => setReceivePO(null)}
        onDone={() => { setReceivePO(null); navigate(`/purchase/${poId}`); /* refresh */ }} />
    )}
  </>;
}

function PODetailInner({ poId, onClose, onReceive, onEdit }) {
  const [po, setPo] = React.useState(null);

  const load = () => {
    fetch(`/api/purchase-orders/${poId}`, { headers: authHeaders() })
      .then(r => r.json()).then(setPo);
  };
  const [docs, setDocs] = React.useState([]);
  const [uploading, setUploading] = React.useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [cancellingPayment, setCancellingPayment] = useState(false);
  const fileInputRef = React.useRef(null);
  const loadDocs = () => {
    fetch(`/api/purchase-orders/${poId}/documents?type=general`, { headers: authHeaders() })
      .then(r => r.json()).then(d => setDocs(Array.isArray(d) ? d : []));
  };
  React.useEffect(() => { load(); loadDocs(); }, [poId]);

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/documents`, {
        method: 'POST', headers: authHeaders(), body: fd
      });
      if (res.ok) loadDocs();
      else {
        const d = await res.json().catch(() => ({}));
        alert('อัปโหลดไม่สำเร็จ: ' + (d.error || res.statusText));
      }
    } catch (err) {
      alert('อัปโหลดไม่สำเร็จ: ' + err.message);
    }
    setUploading(false);
    e.target.value = '';
  };

  const deleteDoc = async (docId, fileName) => {
    if (!confirm(`ยืนยันลบไฟล์ "${fileName}"?`)) return;
    const res = await fetch(`/api/purchase-orders/${poId}/documents/${docId}`, {
      method: 'DELETE', headers: authHeaders()
    });
    if (res.ok) loadDocs();
    else alert('ลบไม่สำเร็จ');
  };

  const fmtSize = (n) => {
    if (!n) return '-';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  };

  if (!po) return null;

  const approve = async () => {
    if (!confirm('ยืนยันอนุมัติ PO?')) return;
    const res = await fetch(`/api/purchase-orders/${poId}/approve`, {
      method: 'POST', headers: authHeaders(),
    });
    if (res.ok) load(); else alert('error');
  };
  const cancel = async () => {
    if (!confirm('ยกเลิก PO?')) return;
    const res = await fetch(`/api/purchase-orders/${poId}/cancel`, {
      method: 'POST', headers: authHeaders(),
    });
    if (res.ok) load(); else alert('error');
  };
  const unapprove = async () => {
    if (!confirm('ยกเลิกอนุมัติ PO?\nสถานะจะเปลี่ยนกลับเป็น "ร่าง" และสามารถแก้ไขได้')) return;
    const res = await fetch(`/api/purchase-orders/${poId}/unapprove`, {
      method: 'POST', headers: authHeaders(),
    });
    if (res.ok) load();
    else { const d = await res.json().catch(() => ({})); alert(d.error || 'error'); }
  };

  return (<>
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px 80px' }}>
      <div style={{ marginBottom: 12 }}>
        <button onClick={onClose} style={{ ...styles.btn(), padding: '6px 12px', fontSize: 13 }}>
          ← กลับ
        </button>
      </div>
      <div style={{ ...styles.card, padding: 0 }}>
        <div style={{ padding: 24, borderBottom: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ ...styles.pageTitle, fontSize: 20 }}>PO: {po.po_number}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {po.payment_status === 'paid' ? (
                <>
                  <span style={{ ...styles.badge('green'), padding: '6px 10px' }}>
                    ✓ ชำระแล้ว {po.payment_date ? `(${new Date(po.payment_date).toLocaleDateString('th-TH')})` : ''}
                  </span>
                  <button style={{ ...styles.btn('danger'), padding: '6px 10px', fontSize: 12 }}
                    disabled={cancellingPayment}
                    onClick={async () => {
                      const msg = po.withholding_id
                        ? 'ยกเลิกการจ่ายเงิน?\nระบบจะยกเลิกใบหัก ณ ที่จ่ายที่ผูกกับ PO นี้ด้วย'
                        : 'ยกเลิกการจ่ายเงิน?';
                      if (!confirm(msg)) return;
                      setCancellingPayment(true);
                      try {
                        const res = await fetch(`/api/purchase-orders/${poId}/payment/cancel`, {
                          method: 'POST', headers: authHeaders(),
                        });
                        if (res.ok) { load(); }
                        else { const d = await res.json().catch(() => ({})); alert(d.error || 'ยกเลิกไม่สำเร็จ'); }
                      } finally { setCancellingPayment(false); }
                    }}>
                    {cancellingPayment ? '...' : '↶ ยกเลิก'}
                  </button>
                </>
              ) : (po.status === 'approved' || po.status === 'received') ? (
                <button style={{ ...styles.btn('success'), padding: '6px 12px', fontSize: 13 }}
                  onClick={() => setShowPayModal(true)}>
                  💳 จ่ายเงิน
                </button>
              ) : null}
              <button style={{ ...styles.btn('primary'), padding: '6px 12px', fontSize: 13 }}
                onClick={() => window.open(`/api/purchase-orders/${poId}/pdf?t=${localStorage.getItem('token')}`, '_blank')}>
                🖨️ พิมพ์ PDF
              </button>
              <button style={{ ...styles.btn(), padding: '4px 10px' }} onClick={onClose}>✕</button>
            </div>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px 24px',
            padding: '12px 14px',
            background: '#fafbfc',
            borderRadius: 8,
            border: '1px solid #f0f2f5'
          }}>
            <div>
              <div style={styles.fieldLabel}>วันที่</div>
              <div style={styles.fieldValue}>{po.po_date ? new Date(po.po_date).toLocaleDateString('th-TH') : '-'}</div>
            </div>
            <div>
              <div style={styles.fieldLabel}>เครดิต</div>
              <div style={styles.fieldValue}>{po.credit_days > 0 ? `${po.credit_days} วัน` : '-'}</div>
            </div>
            <div>
              <div style={styles.fieldLabel}>ครบกำหนด</div>
              <div style={styles.fieldValue}>{po.due_date ? new Date(po.due_date).toLocaleDateString('th-TH') : '-'}</div>
            </div>
            <div style={{ gridColumn: 'span 3', borderTop: '1px solid #f0f2f5', paddingTop: 12 }}>
              <div style={styles.fieldLabel}>ผู้จำหน่าย</div>
              <div style={styles.fieldValue}>{po.supplier_name || '-'}</div>
            </div>
            <div style={{ gridColumn: 'span 3' }}>
              <div style={styles.fieldLabel}>ชื่องาน</div>
              <div style={styles.fieldValue}>{po.job_name || '-'}</div>
            </div>
            <div style={{ gridColumn: 'span 3' }}>
              <div style={styles.fieldLabel}>ผู้สั่งซื้อ</div>
              <div style={styles.fieldValue}>{po.ordered_by_name || '-'}</div>
            </div>
          </div>
        </div>
        <div style={{ padding: 24 }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>รหัส</th>
                <th style={styles.th}>Model</th>
                <th style={styles.th}>สินค้า</th>
                <th style={styles.th}>ประเภท</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>จำนวน</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>ราคา/หน่วย</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>รวม</th>
                <th style={{ ...styles.th }}>แบบ ภ.ง.ด.</th>
                <th style={{ ...styles.th }}>ประเภท</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>หัก %</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>หักเงิน</th>
              </tr>
            </thead>
            <tbody>
              {(po.items || []).map(it => (
                <tr key={it.id}>
                  <td style={styles.td}>{it.product_code}</td>
                  <td style={styles.td}>{it.product_model || '-'}</td>
                  <td style={styles.td}>{it.product_name}</td>
                  <td style={styles.td}>
                    {it.product_type === 'stock' ? <span style={styles.badge('green')}>นับสต็อก</span> :
                     it.product_type === 'non_stock' ? <span style={styles.badge()}>เหมา</span> :
                     <span style={styles.badge('blue')}>บริการ</span>}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{Number(it.quantity)}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{Number(it.unit_price).toLocaleString()}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{Number(it.total_price).toLocaleString()}</td>
                  <td style={{ ...styles.td, fontSize: 12, color: it.pnd_form ? '#c41556' : '#9ca3af' }}>
                    {it.pnd_form || '-'}
                  </td>
                  <td style={{ ...styles.td, fontSize: 12, color: it.income_type ? '#c41556' : '#9ca3af' }}>
                    {it.income_type || '-'}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right', color: Number(it.wht_rate) > 0 ? '#c41556' : '#9ca3af' }}>
                    {Number(it.wht_rate) > 0 ? `${Number(it.wht_rate)}%` : '-'}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right', color: Number(it.wht_amount) > 0 ? '#c41556' : '#9ca3af' }}>
                    {Number(it.wht_amount) > 0 ? Number(it.wht_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
<div style={{
          marginTop: 20, padding: 16, background: '#fafbfc', borderRadius: 8,
          textAlign: 'right', lineHeight: 1.8
        }}>
          <div>ยอดก่อน VAT: <b>{Number(po.total_amount).toLocaleString()}</b></div>
          <div>VAT {po.vat_rate}%: <b>{Number(po.vat_amount).toLocaleString()}</b></div>
          <div style={{ fontSize: 18 }}>ยอดสุทธิ: <b style={{ color: '#059669' }}>{Number(po.grand_total).toLocaleString()}</b></div>
          {Number(po.wht_amount) > 0 && (
            <>
              <div style={{ borderTop: '1px solid #e5e7eb', margin: '8px 0' }}></div>
              <div>รวมหัก ณ ที่จ่าย: <b>{Number(po.wht_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
              <div style={{ fontSize: 18 }}>ยอดชำระ: <b style={{ color: '#c41556' }}>{(Number(po.grand_total) - Number(po.wht_amount)).toLocaleString()}</b></div>
            </>
          )}
        </div>

        {/* ═══ การชำระเงิน ═══ */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1e3a5f', marginBottom: 10 }}>
            💳 การชำระเงิน
          </div>
          {po.payment_status === 'paid' ? (
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
              padding: '14px 16px',
            }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                gap: '12px 24px', marginBottom: 10,
              }}>
                <div>
                  <div style={styles.fieldLabel}>วันที่จ่าย</div>
                  <div style={styles.fieldValue}>
                    {po.payment_date ? new Date(po.payment_date).toLocaleDateString('th-TH') : '-'}
                  </div>
                </div>
                <div>
                  <div style={styles.fieldLabel}>วิธีจ่าย</div>
                  <div style={styles.fieldValue}>
                    {po.payment_method === 'transfer' ? 'โอนเงิน'
                     : po.payment_method === 'cash' ? 'เงินสด'
                     : po.payment_method === 'cheque' ? 'เช็ค'
                     : (po.payment_method || '-')}
                  </div>
                </div>
                <div>
                  <div style={styles.fieldLabel}>ยอดที่จ่าย</div>
                  <div style={{ ...styles.fieldValue, fontWeight: 700, color: '#059669' }}>
                    {Number(po.payment_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
                  </div>
                </div>
                {po.payment_bank_name && (
                  <div style={{ gridColumn: 'span 3' }}>
                    <div style={styles.fieldLabel}>จ่ายจากบัญชี</div>
                    <div style={styles.fieldValue}>
                      🏦 {po.payment_bank_name}
                      {po.payment_bank_branch ? ` (${po.payment_bank_branch})` : ''}
                      {' — '}
                      <span style={{ fontFamily: 'monospace' }}>{po.payment_account_number}</span>
                      {' '}({po.payment_account_name})
                    </div>
                  </div>
                )}
                {po.payment_reference && (
                  <div style={{ gridColumn: 'span 3' }}>
                    <div style={styles.fieldLabel}>เลขอ้างอิง</div>
                    <div style={styles.fieldValue}>{po.payment_reference}</div>
                  </div>
                )}
                {po.payment_notes && (
                  <div style={{ gridColumn: 'span 3' }}>
                    <div style={styles.fieldLabel}>หมายเหตุ</div>
                    <div style={styles.fieldValue}>{po.payment_notes}</div>
                  </div>
                )}
              </div>

              <SlipList poId={po.id} />

              {Array.isArray(po.withholding_docs) && po.withholding_docs.length > 0 && (
                <div style={{ gridColumn: 'span 3', marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 6 }}>
                    ใบหัก ณ ที่จ่าย ({po.withholding_docs.length})
                  </div>
                  {po.withholding_docs.map(wht => (
                    <div key={wht.id} style={{
                      marginBottom: 6, padding: '10px 14px',
                      background: '#fff', border: '1px solid #fbcfe8', borderRadius: 6,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#c41556' }}>
                          📄 {wht.doc_no}
                          {wht.status === 'cancelled' && (
                            <span style={{ ...styles.badge('red'), marginLeft: 8, fontSize: 11 }}>ยกเลิก</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          {wht.income_type} · ยอดหัก {Number(wht.total_tax).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
                        </div>
                      </div>
                      <button style={{ ...styles.btn('primary'), padding: '6px 14px', fontSize: 13 }}
                        disabled={wht.status === 'cancelled'}
                        onClick={() => window.open(`/api/withholding/${wht.id}/pdf?t=${localStorage.getItem('token')}`, '_blank')}>
                        🖨️ ดู PDF
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (po.status === 'approved' || po.status === 'received') ? (
            <div style={{
              padding: 24, textAlign: 'center',
              background: '#fafbfc', borderRadius: 8, border: '1px dashed #d1d5db',
            }}>
              <div style={{ color: '#6b7280', fontSize: 14, marginBottom: 12 }}>
                ยังไม่ได้ชำระเงิน
              </div>
              <button style={styles.btn('success')}
                onClick={() => setShowPayModal(true)}>
                💳 จ่ายเงิน
              </button>
            </div>
          ) : (
            <div style={{
              padding: 16, textAlign: 'center',
              background: '#fafbfc', borderRadius: 8, color: '#9ca3af', fontSize: 14,
            }}>
              จะจ่ายเงินได้หลังจากอนุมัติ PO
            </div>
          )}
        </div>

        {/* ═══ เอกสารแนบ ═══ */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1e3a5f' }}>
              📎 เอกสารแนบ {docs.length > 0 && <span style={{ color: '#6b7280', fontWeight: 400, fontSize: 13 }}>({docs.length})</span>}
            </div>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }}
              onChange={uploadFile}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
            <button style={styles.btn('primary')} disabled={uploading}
              onClick={() => fileInputRef.current?.click()}>
              {uploading ? 'กำลังอัปโหลด...' : '+ แนบไฟล์'}
            </button>
          </div>
          {docs.length === 0 ? (
            <div style={{
              padding: 20, textAlign: 'center', color: '#9ca3af',
              background: '#fafbfc', borderRadius: 8, fontSize: 14
            }}>
              ยังไม่มีเอกสารแนบ · รองรับ PDF, รูปภาพ, Word, Excel (สูงสุด 20 MB)
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ชื่อไฟล์</th>
                  <th style={{ ...styles.th, width: 90, textAlign: 'right' }}>ขนาด</th>
                  <th style={{ ...styles.th, width: 130 }}>วันที่</th>
                  <th style={{ ...styles.th, width: 110 }}>โดย</th>
                  <th style={{ ...styles.th, width: 120 }}></th>
                </tr>
              </thead>
              <tbody>
                {docs.map(d => (
                  <tr key={d.id}>
                    <td style={styles.td}>
                      <a href={`/api/purchase-orders/${poId}/documents/${d.id}/download?t=${localStorage.getItem('token')}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ color: '#2563eb', textDecoration: 'none' }}>
                        📄 {d.file_name}
                      </a>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', color: '#6b7280' }}>
                      {fmtSize(d.file_size)}
                    </td>
                    <td style={{ ...styles.td, color: '#6b7280' }}>
                      {new Date(d.uploaded_at).toLocaleDateString('th-TH')}
                    </td>
                    <td style={{ ...styles.td, color: '#6b7280' }}>{d.uploaded_by_name || '-'}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <button style={{ ...styles.btn('danger'), padding: '4px 10px', fontSize: 12 }}
                        onClick={() => deleteDoc(d.id, d.file_name)}>
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 24px', borderTop: '1px solid #e5e7eb' }}>
          {po.status === 'draft' && (
            <button style={styles.btn('danger')} onClick={cancel}>ยกเลิก PO</button>
          )}
          <div style={{ flex: 1 }} />
          {po.status === 'draft' && onEdit && (
            <button style={styles.btn()} onClick={() => onEdit(po)}>แก้ไข</button>
          )}
          {po.status === 'approved' && (
            <button style={styles.btn('danger')} onClick={unapprove}>ยกเลิกอนุมัติ</button>
          )}
          {po.status === 'draft' && (
            <button style={styles.btn('primary')} onClick={approve}>อนุมัติ</button>
          )}
          {po.status === 'approved' && (
            <button style={styles.btn('success')} onClick={() => onReceive(po)}>รับสินค้า</button>
          )}
          <button style={styles.btn()} onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
    {showPayModal && <PayModal po={po} onClose={() => setShowPayModal(false)} onSuccess={() => { setShowPayModal(false); load(); }} />}
  </>);
}

/* ============================================================
   ⭐ RECEIVE PO MODAL — กรอก Serial/MAC ตอนรับสินค้า
============================================================ */
function ReceivePOModal({ poId, onClose, onDone }) {
  const [po, setPo] = React.useState(null);
  const [itemsInput, setItemsInput] = React.useState({});
  const [err, setErr] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/purchase-orders/${poId}`, { headers: authHeaders() })
      .then(r => r.json()).then(data => {
        setPo(data);
        const init = {};
        (data.items || []).forEach(it => {
          if (it.product_type === 'stock') {
            init[it.id] = {
              serials: Array.from({ length: Number(it.quantity) }, () => ({ serial_no: '', mac_address: '' })),
            };
          }
        });
        setItemsInput(init);
      });
  }, [poId]);

  if (!po) {
    return (
      <div style={styles.overlay} onClick={onClose}>
        <div style={{ ...styles.modal, width: 400 }} onClick={e => e.stopPropagation()}>
          <div style={styles.modalBody}>กำลังโหลด...</div>
        </div>
      </div>
    );
  }

  const setSerial = (itemId, idx, field, val) => {
    setItemsInput(prev => {
      const next = { ...prev };
      next[itemId] = { ...next[itemId], serials: [...next[itemId].serials] };
      next[itemId].serials[idx] = { ...next[itemId].serials[idx], [field]: val };
      return next;
    });
  };

  const submit = async () => {
    setErr('');
    for (const it of po.items) {
      if (it.product_type === 'stock') {
        const serials = itemsInput[it.id]?.serials || [];
        for (let i = 0; i < serials.length; i++) {
          if (!serials[i].serial_no || !serials[i].serial_no.trim()) {
            setErr(`กรุณากรอก Serial ของ ${it.product_code} ชิ้นที่ ${i + 1}`);
            return;
          }
        }
        const sns = serials.map(s => s.serial_no.trim());
        if (new Set(sns).size !== sns.length) {
          setErr(`Serial ของ ${it.product_code} มีค่าซ้ำ`);
          return;
        }
      }
    }

    const payload = {
      items: po.items.map(it => {
        if (it.product_type === 'stock') {
          return {
            po_item_id: it.id,
            product_id: it.product_id,
            product_type: 'stock',
            serials: itemsInput[it.id].serials.map(s => ({
              serial_no: s.serial_no.trim(),
              mac_address: s.mac_address ? s.mac_address.trim() : null,
            })),
          };
        }
        return {
          po_item_id: it.id,
          product_id: it.product_id,
          product_type: it.product_type,
          qty: Number(it.quantity),
        };
      }),
    };

    setSubmitting(true);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/receive`, {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'เกิดข้อผิดพลาด');
        setSubmitting(false);
        return;
      }
      onDone();
    } catch (e) {
      setErr(e.message);
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={submitting ? null : onClose}>
      <div style={{ ...styles.modal, width: 880 }} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalTitle}>รับสินค้า — {po.po_number}</div>
            <div style={{ ...styles.detailSub, marginTop: 4 }}>
              ผู้จำหน่าย: {po.supplier_name} · วันที่ PO: {new Date(po.po_date).toLocaleDateString('th-TH')}
            </div>
          </div>
          <button style={{ ...styles.btn(), padding: '4px 10px' }} onClick={onClose} disabled={submitting}>✕</button>
        </div>

        <div style={styles.modalBody}>
          {err && <div style={styles.error}>{err}</div>}

          <div style={{
            background: '#eff6ff', color: '#2563eb',
            padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 13
          }}>
            📌 กรอก Serial Number ให้ครบทุกชิ้นสำหรับสินค้าประเภท "นับสต็อก" (MAC Address ไม่บังคับ)
          </div>

          {(po.items || []).map(it => (
            <div key={it.id} style={{
              border: '1px solid #f0f2f5', borderRadius: 10, padding: 16, marginBottom: 14, background: '#fafbfc'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1e3a5f' }}>
                    {it.product_code} {it.product_model ? `· ${it.product_model}` : ''}
                  </div>
                  <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{it.product_name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {it.product_type === 'stock' ? <span style={styles.badge('green')}>นับสต็อก</span> :
                   it.product_type === 'non_stock' ? <span style={styles.badge()}>เหมา</span> :
                   <span style={styles.badge('blue')}>บริการ</span>}
                  <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
                    จำนวน: <b>{Number(it.quantity)}</b> {it.unit || it.product_unit}
                  </div>
                </div>
              </div>

              {it.product_type === 'stock' ? (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, width: 50 }}>#</th>
                      <th style={styles.th}>Serial No. *</th>
                      <th style={styles.th}>MAC Address (ถ้ามี)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(itemsInput[it.id]?.serials || []).map((s, idx) => (
                      <tr key={idx}>
                        <td style={styles.td}>{idx + 1}</td>
                        <td style={styles.td}>
                          <input style={styles.input}
                            placeholder={`Serial ชิ้นที่ ${idx + 1}`}
                            value={s.serial_no}
                            onChange={e => setSerial(it.id, idx, 'serial_no', e.target.value)} />
                        </td>
                        <td style={styles.td}>
                          <input style={styles.input}
                            placeholder="AA:BB:CC:DD:EE:FF"
                            value={s.mac_address}
                            onChange={e => setSerial(it.id, idx, 'mac_address', e.target.value)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: '#888', fontSize: 13, padding: '8px 0' }}>
                  {it.product_type === 'service'
                    ? '✓ บริการ — ไม่ต้องกรอก Serial'
                    : '✓ สินค้าเหมา — เพิ่มจำนวนอัตโนมัติ'}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={styles.modalFooter}>
          <button style={styles.btn()} onClick={onClose} disabled={submitting}>ยกเลิก</button>
          <button style={styles.btn('success')} onClick={submit} disabled={submitting}>
            {submitting ? 'กำลังบันทึก...' : 'ยืนยันรับสินค้า'}
          </button>
        </div>
      </div>
    </div>
  );
}
