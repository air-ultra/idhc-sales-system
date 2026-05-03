const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const staffRoutes = require('./routes/staff');
const userRoutes = require('./routes/users');
const staffDetailRoutes = require('./routes/staffDetail');
const payrollRoutes = require('./routes/payroll');
const payrollExportRoutes = require('./routes/payroll-export');
const payrollDocumentsRoutes = require('./routes/payroll-documents');
const withholdingRoutes = require('./routes/withholdingTax');
const productRoutes = require('./routes/products');
const supplierRoutes = require('./routes/suppliers');
const poRoutes = require('./routes/purchaseOrders');
const categoryRoutes = require('./routes/product-categories');
const companyBankRoutes = require('./routes/companyBankAccounts');
const departmentRoutes = require('./routes/departments');
const customerRoutes = require('./routes/customers');
const quotationRoutes = require('./routes/quotations');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/staff', staffDetailRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/payroll-export', payrollExportRoutes);
app.use('/api/payroll-documents', payrollDocumentsRoutes);
app.use('/api/withholding', withholdingRoutes);
app.use('/api/products', productRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', poRoutes);
app.use('/api/product-categories', categoryRoutes);
app.use('/api/company-bank-accounts', companyBankRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/users', userRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sales API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
