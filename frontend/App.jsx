import React, { useState, useEffect, useCallback } from 'react';
import { login as apiLogin, getMe, getStaffList, getStaff, createStaff, updateStaff, deleteStaff, getDepartments, changePassword, getStaffContact, saveStaffContact, getStaffAddress, saveStaffAddress, getStaffEmployment, saveStaffEmployment, getStaffSalary, saveStaffSalary, getStaffHistory, getStaffNotes, createStaffNote } from './api';

/* ========== STYLES ========== */
const styles = {
  global: `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; color: #333; }
    button { cursor: pointer; border: none; outline: none; }
    input, select, textarea { outline: none; font-family: inherit; }
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
  { key: 'users', icon: '🔐', label: 'User Management' },
];
function Sidebar({ active, onNavigate, user, onLogout }) {
  return (
    <div style={styles.sidebar}>
      <div style={styles.sidebarLogo}><div style={styles.sidebarLogoText}>Sales System</div><div style={styles.sidebarLogoSub}>Management Platform</div></div>
      <nav style={styles.sidebarNav}>
        {menuItems.map(item => (
          <button key={item.key} onClick={() => onNavigate(item.key)} style={{ ...styles.sidebarItem, ...(active === item.key ? styles.sidebarItemActive : {}) }}>
            <span>{item.icon}</span><span>{item.label}</span>
          </button>
        ))}
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
    <div style={styles.overlay} onClick={onClose}><div style={styles.modal} onClick={e => e.stopPropagation()}>
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
              <div style={styles.fieldValue}>{data?.[f.key] || '-'}</div>
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
function SalaryTab({ staffId }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

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
    const base = Math.min(s, m);
    return Math.round(base * r / 100);
  };

  const handleSave = async () => {
    setSaving(true); setMsg('');
    try {
      const isEligible = form.social_security_eligible === true || form.social_security_eligible === 'true';
      const ssAmount = isEligible ? calcSS(form.salary, form.ss_rate, form.ss_max_salary) : 0;
      const payload = { ...form, social_security_eligible: isEligible, social_security: ssAmount };
      const res = await saveStaffSalary(staffId, payload);
      setData(res.data); setForm(res.data); setEditing(false);
      setMsg('บันทึกข้อมูลเงินเดือนสำเร็จ');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg('Error: ' + err.message); }
    finally { setSaving(false); }
  };

  const h = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const isEligible = form.social_security_eligible === true || form.social_security_eligible === 'true';

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>กำลังโหลด...</div>;

  const fmtNum = (v) => v ? parseFloat(v).toLocaleString('th-TH') : '0';

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
            <div><div style={styles.fieldLabel}>หัก ณ ที่จ่าย</div><div style={styles.fieldValue}>{fmtNum(data?.withholding_tax)} บาท</div></div>
            <div><div style={styles.fieldLabel}>เงื่อนไขภาษี</div><div style={styles.fieldValue}>{data?.tax_condition || '-'}</div></div>
          </div>
          {data?.remarks && <div style={{ padding: '0 24px 24px' }}><div style={styles.fieldLabel}>หมายเหตุ</div><div style={styles.fieldValue}>{data.remarks}</div></div>}
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
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>= min(เงินเดือน, {fmtNum(form.ss_max_salary || 17500)}) x {form.ss_rate || 5}%</div>
                </div>
              </>
            )}
            <div><label style={styles.label}>หัก ณ ที่จ่าย (บาท)</label><input style={styles.input} type="number" value={form.withholding_tax || ''} onChange={e => h('withholding_tax', e.target.value)} /></div>
            <div><label style={styles.label}>เงื่อนไขภาษี</label><input style={styles.input} value={form.tax_condition || ''} onChange={e => h('tax_condition', e.target.value)} /></div>
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
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getStaffHistory(staffId).then(r => setHistory(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, [staffId]);
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>กำลังโหลด...</div>;
  return (
    <div style={{ padding: 24 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>ประวัติการเปลี่ยนแปลง</h3>
      {history.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>ยังไม่มีประวัติ</div>
      ) : (
        <table style={styles.table}>
          <thead><tr><th style={styles.th}>วันที่</th><th style={styles.th}>ประเภท</th><th style={styles.th}>ฟิลด์</th><th style={styles.th}>ค่าเดิม</th><th style={styles.th}>ค่าใหม่</th><th style={styles.th}>โดย</th></tr></thead>
          <tbody>{history.map(h => (
            <tr key={h.id}>
              <td style={styles.td}>{new Date(h.changed_at).toLocaleDateString('th-TH')}</td>
              <td style={styles.td}>{h.change_type}</td>
              <td style={styles.td}>{h.field_changed}</td>
              <td style={styles.td}>{h.old_value || '-'}</td>
              <td style={styles.td}>{h.new_value || '-'}</td>
              <td style={styles.td}>{h.changed_by_name || '-'}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}

/* ========== NOTES TAB ========== */
function NotesTab({ staffId }) {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [staffId]);
  const load = () => {
    setLoading(true);
    getStaffNotes(staffId).then(r => setNotes(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };
  const handleAdd = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    try { await createStaffNote(staffId, newNote); setNewNote(''); load(); }
    catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>กำลังโหลด...</div>;
  return (
    <div style={{ padding: 24 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f', marginBottom: 16 }}>หมายเหตุ</h3>
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
    { key: 'history', label: 'ประวัติ' },
    { key: 'notes', label: 'หมายเหตุ' },
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
        {activeTab === 'notes' && <NotesTab staffId={staffId} />}
      </div>
    </div>
  );
}

/* ========== MAIN APP ========== */
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

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

  const handleLogout = () => { localStorage.removeItem('token'); setUser(null); setPage('dashboard'); setSelectedStaffId(null); };

  if (!authChecked) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: '#888' }}>กำลังโหลด...</div>;
  if (!user) return <LoginPage onLogin={setUser} />;

  return (
    <div style={styles.layout}>
      <Sidebar active={page} onNavigate={(p) => { setPage(p); setSelectedStaffId(null); }} user={user} onLogout={handleLogout} />
      <main style={styles.main}>
        {page === 'dashboard' && <DashboardPage staffList={staffList} />}
        {page === 'staff' && !selectedStaffId && <StaffListPage staffList={staffList} onSelect={setSelectedStaffId} onRefresh={loadStaff} />}
        {page === 'staff' && selectedStaffId && <StaffDetailPage staffId={selectedStaffId} onBack={() => setSelectedStaffId(null)} onRefresh={loadStaff} />}
        {page === 'users' && (
          <div>
            <div style={styles.pageHeader}><h1 style={styles.pageTitle}>User Management</h1></div>
            <div style={{ ...styles.card, padding: 40, textAlign: 'center', color: '#888' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
              <div>จัดการผู้ใช้งานระบบ — จะเพิ่มใน Phase ถัดไป</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
