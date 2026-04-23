import { useState, useEffect, useCallback } from 'react';

// ─── API helpers ───
const API = '/api/withholding';
const getToken = () => localStorage.getItem('token');
const apiFetch = async (url, opts = {}) => {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...opts.headers },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.statusText); }
  return res.json();
};

// ─── Default payer (company) data ───
const DEFAULT_PAYER = {
  payer_name: 'บริษัท ไอเดีย เฮ้าส์เซ็นเตอร์ จำกัด (สำนักงานใหญ่)',
  payer_tax_id: '0105556022070',
  payer_address: 'เลขที่ 80 อาคาร เค.เอ.เอ็น.เพลส ห้องเลขที่ 104 ชั้น 1 ซ.นราธิวาสราชนครินทร์ 8 แขวงทุ่งวัดดอน เขตสาทร กรุงเทพฯ 10120',
};

const PND_FORMS = ['ภ.ง.ด.1ก', 'ภ.ง.ด.1ก พิเศษ', 'ภ.ง.ด.2', 'ภ.ง.ด.3', 'ภ.ง.ด.2ก', 'ภ.ง.ด.3ก', 'ภ.ง.ด.53'];
const INCOME_TYPES = ['40(1)', '40(2)', '40(3)', '40(4)ก', '40(4)ข', 'ม.3 เตรส', 'อื่นๆ'];
const STATUS_LABELS = { draft: 'ร่าง', issued: 'ออกแล้ว', cancelled: 'ยกเลิก' };
const STATUS_COLORS = { draft: '#f59e0b', issued: '#10b981', cancelled: '#ef4444' };

export default function WithholdingTaxPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterStatus, setFilterStatus] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(getEmptyForm());

  function getEmptyForm() {
    return {
      ...DEFAULT_PAYER,
      tax_year: new Date().getFullYear(),
      payee_name: '', payee_tax_id: '', payee_address: '',
      pnd_form: 'ภ.ง.ด.3', pnd_seq: 1,
      income_type: 'ม.3 เตรส', income_desc: '',
      total_income: '', total_tax: '',
      fund_gpf: 0, fund_sso: 0, fund_pvf: 0,
      withhold_method: 1,
      items: [{ pay_date: '', description: '', income_amount: '', tax_amount: '' }],
    };
  }

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API}?year=${filterYear}`;
      if (filterStatus) url += `&status=${filterStatus}`;
      const data = await apiFetch(url);
      setList(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [filterYear, filterStatus]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleSubmit = async () => {
    try {
      setError('');
      const payload = { ...form, total_income: parseFloat(form.total_income) || 0, total_tax: parseFloat(form.total_tax) || 0 };
      payload.items = form.items.map(i => ({ ...i, income_amount: parseFloat(i.income_amount) || 0, tax_amount: parseFloat(i.tax_amount) || 0 }));
      
      if (editId) {
        await apiFetch(`${API}/${editId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await apiFetch(API, { method: 'POST', body: JSON.stringify(payload) });
      }
      setShowForm(false);
      setEditId(null);
      setForm(getEmptyForm());
      fetchList();
    } catch (e) { setError(e.message); }
  };

  const handleIssue = async (id) => {
    if (!window.confirm('ต้องการออกเอกสารจริงหรือไม่?')) return;
    try {
      await apiFetch(`${API}/${id}/issue`, { method: 'POST' });
      fetchList();
    } catch (e) { setError(e.message); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('ต้องการลบเอกสารนี้หรือไม่?')) return;
    try {
      await apiFetch(`${API}/${id}`, { method: 'DELETE' });
      fetchList();
    } catch (e) { setError(e.message); }
  };

  const handleEdit = async (id) => {
    try {
      const data = await apiFetch(`${API}/${id}`);
      setForm({
        ...data,
        total_income: data.total_income || '',
        total_tax: data.total_tax || '',
        items: data.items.length ? data.items : [{ pay_date: '', description: '', income_amount: '', tax_amount: '' }],
      });
      setEditId(id);
      setShowForm(true);
    } catch (e) { setError(e.message); }
  };

  const openPdf = (id) => {
    window.open(`${API}/${id}/pdf`, '_blank');
  };

  const addItem = () => {
    setForm(f => ({ ...f, items: [...f.items, { pay_date: '', description: '', income_amount: '', tax_amount: '' }] }));
  };
  const removeItem = (idx) => {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };
  const updateItem = (idx, field, val) => {
    setForm(f => ({ ...f, items: f.items.map((item, i) => i === idx ? { ...item, [field]: val } : item) }));
  };

  // ─── Styles ───
  const S = {
    page: { padding: 24, maxWidth: 1200, margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 22, fontWeight: 700, color: '#1e293b' },
    btn: { padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
    btnPrimary: { background: '#1a56db', color: '#fff' },
    btnSuccess: { background: '#10b981', color: '#fff' },
    btnDanger: { background: '#ef4444', color: '#fff' },
    btnOutline: { background: '#fff', color: '#374151', border: '1px solid #d1d5db' },
    filters: { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
    select: { padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
    th: { textAlign: 'left', padding: '10px 12px', background: '#f1f5f9', borderBottom: '2px solid #e2e8f0', fontWeight: 600, color: '#475569' },
    td: { padding: '10px 12px', borderBottom: '1px solid #e2e8f0' },
    badge: (color) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: color + '20', color }),
    modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 40, zIndex: 1000, overflow: 'auto' },
    modalContent: { background: '#fff', borderRadius: 12, padding: 28, width: '90%', maxWidth: 800, maxHeight: '90vh', overflow: 'auto' },
    formGroup: { marginBottom: 14 },
    label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 },
    input: { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' },
    row: { display: 'flex', gap: 12 },
    col: { flex: 1 },
    error: { background: '#fef2f2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13 },
  };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)</h1>
        <button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => { setForm(getEmptyForm()); setEditId(null); setShowForm(true); }}>
          + สร้างเอกสาร
        </button>
      </div>

      {error && <div style={S.error}>{error} <span style={{ cursor: 'pointer', float: 'right' }} onClick={() => setError('')}>✕</span></div>}

      <div style={S.filters}>
        <label style={{ fontSize: 14, fontWeight: 600 }}>ปี:</label>
        <select style={S.select} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          {[...Array(5)].map((_, i) => { const y = new Date().getFullYear() - i; return <option key={y} value={y}>{y + 543}</option>; })}
        </select>
        <label style={{ fontSize: 14, fontWeight: 600 }}>สถานะ:</label>
        <select style={S.select} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">ทั้งหมด</option>
          <option value="draft">ร่าง</option>
          <option value="issued">ออกแล้ว</option>
        </select>
      </div>

      {loading ? <p>กำลังโหลด...</p> : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>เลขที่</th>
              <th style={S.th}>ผู้ถูกหัก</th>
              <th style={S.th}>แบบ</th>
              <th style={S.th}>เงินได้</th>
              <th style={S.th}>ภาษี</th>
              <th style={S.th}>สถานะ</th>
              <th style={S.th}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#94a3b8' }}>ไม่มีข้อมูล</td></tr>
            ) : list.map(row => (
              <tr key={row.id}>
                <td style={S.td}>{row.doc_no}</td>
                <td style={S.td}>{row.payee_name}</td>
                <td style={S.td}>{row.pnd_form}</td>
                <td style={{ ...S.td, textAlign: 'right' }}>{parseFloat(row.total_income).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                <td style={{ ...S.td, textAlign: 'right' }}>{parseFloat(row.total_tax).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                <td style={S.td}><span style={S.badge(STATUS_COLORS[row.status])}>{STATUS_LABELS[row.status]}</span></td>
                <td style={S.td}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ ...S.btn, ...S.btnOutline, padding: '4px 10px', fontSize: 12 }} onClick={() => openPdf(row.id)}>PDF</button>
                    {row.status === 'draft' && (
                      <>
                        <button style={{ ...S.btn, ...S.btnOutline, padding: '4px 10px', fontSize: 12 }} onClick={() => handleEdit(row.id)}>แก้ไข</button>
                        <button style={{ ...S.btn, ...S.btnSuccess, padding: '4px 10px', fontSize: 12 }} onClick={() => handleIssue(row.id)}>ออกเอกสาร</button>
                        <button style={{ ...S.btn, ...S.btnDanger, padding: '4px 10px', fontSize: 12 }} onClick={() => handleDelete(row.id)}>ลบ</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ─── CREATE/EDIT MODAL ─── */}
      {showForm && (
        <div style={S.modal} onClick={() => setShowForm(false)}>
          <div style={S.modalContent} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{editId ? 'แก้ไขเอกสาร' : 'สร้างเอกสารหัก ณ ที่จ่าย'}</h2>

            {/* ผู้จ่าย */}
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, marginBottom: 16, border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>ผู้มีหน้าที่หักภาษี (บริษัท)</h3>
              <div style={S.formGroup}><label style={S.label}>ชื่อ</label><input style={S.input} value={form.payer_name} onChange={e => setForm(f => ({ ...f, payer_name: e.target.value }))} /></div>
              <div style={S.row}>
                <div style={S.col}><label style={S.label}>เลขผู้เสียภาษี</label><input style={S.input} value={form.payer_tax_id} onChange={e => setForm(f => ({ ...f, payer_tax_id: e.target.value }))} /></div>
                <div style={S.col}><label style={S.label}>ปีภาษี</label><input type="number" style={S.input} value={form.tax_year} onChange={e => setForm(f => ({ ...f, tax_year: parseInt(e.target.value) }))} /></div>
              </div>
            </div>

            {/* ผู้ถูกหัก */}
            <div style={{ background: '#f0f9ff', padding: 14, borderRadius: 8, marginBottom: 16, border: '1px solid #bae6fd' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>ผู้ถูกหักภาษี</h3>
              <div style={S.formGroup}><label style={S.label}>ชื่อ</label><input style={S.input} value={form.payee_name} onChange={e => setForm(f => ({ ...f, payee_name: e.target.value }))} /></div>
              <div style={S.row}>
                <div style={S.col}><label style={S.label}>เลขบัตรประชาชน</label><input style={S.input} value={form.payee_tax_id} onChange={e => setForm(f => ({ ...f, payee_tax_id: e.target.value }))} /></div>
              </div>
              <div style={S.formGroup}><label style={S.label}>ที่อยู่</label><input style={S.input} value={form.payee_address} onChange={e => setForm(f => ({ ...f, payee_address: e.target.value }))} /></div>
            </div>

            {/* แบบ ภ.ง.ด. + ประเภทเงินได้ */}
            <div style={S.row}>
              <div style={S.col}>
                <label style={S.label}>แบบ ภ.ง.ด.</label>
                <select style={S.input} value={form.pnd_form} onChange={e => setForm(f => ({ ...f, pnd_form: e.target.value }))}>
                  {PND_FORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={S.col}>
                <label style={S.label}>ประเภทเงินได้</label>
                <select style={S.input} value={form.income_type} onChange={e => setForm(f => ({ ...f, income_type: e.target.value }))}>
                  {INCOME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ width: 100 }}>
                <label style={S.label}>วิธีหัก</label>
                <select style={S.input} value={form.withhold_method} onChange={e => setForm(f => ({ ...f, withhold_method: parseInt(e.target.value) }))}>
                  <option value={1}>หัก ณ ที่จ่าย</option>
                  <option value={2}>ออกให้ตลอดไป</option>
                  <option value={3}>ออกให้ครั้งเดียว</option>
                  <option value={4}>อื่นๆ</option>
                </select>
              </div>
            </div>

            {/* รายการจ่าย */}
            <div style={{ marginTop: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>รายการจ่ายเงิน</h3>
                <button style={{ ...S.btn, ...S.btnOutline, padding: '4px 10px', fontSize: 12 }} onClick={addItem}>+ เพิ่มรายการ</button>
              </div>
              {form.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
                  <div style={{ width: 120 }}><label style={{ ...S.label, fontSize: 11 }}>วันที่จ่าย</label><input style={S.input} value={item.pay_date} onChange={e => updateItem(idx, 'pay_date', e.target.value)} placeholder="เม.ย. 69" /></div>
                  <div style={{ flex: 1 }}><label style={{ ...S.label, fontSize: 11 }}>รายละเอียด</label><input style={S.input} value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} /></div>
                  <div style={{ width: 130 }}><label style={{ ...S.label, fontSize: 11 }}>จำนวนเงิน</label><input type="number" style={S.input} value={item.income_amount} onChange={e => updateItem(idx, 'income_amount', e.target.value)} /></div>
                  <div style={{ width: 130 }}><label style={{ ...S.label, fontSize: 11 }}>ภาษี</label><input type="number" style={S.input} value={item.tax_amount} onChange={e => updateItem(idx, 'tax_amount', e.target.value)} /></div>
                  {form.items.length > 1 && <button style={{ ...S.btn, ...S.btnDanger, padding: '4px 8px', fontSize: 12 }} onClick={() => removeItem(idx)}>✕</button>}
                </div>
              ))}
            </div>

            {/* ยอดรวม */}
            <div style={S.row}>
              <div style={S.col}><label style={S.label}>รวมเงินได้</label><input type="number" style={S.input} value={form.total_income} onChange={e => setForm(f => ({ ...f, total_income: e.target.value }))} /></div>
              <div style={S.col}><label style={S.label}>รวมภาษี</label><input type="number" style={S.input} value={form.total_tax} onChange={e => setForm(f => ({ ...f, total_tax: e.target.value }))} /></div>
            </div>

            {/* ปุ่ม */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button style={{ ...S.btn, ...S.btnOutline }} onClick={() => { setShowForm(false); setEditId(null); }}>ยกเลิก</button>
              <button style={{ ...S.btn, ...S.btnPrimary }} onClick={handleSubmit}>{editId ? 'บันทึก' : 'สร้างเอกสาร'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
