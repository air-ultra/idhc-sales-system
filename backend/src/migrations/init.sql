-- =============================================================================
-- IDHC Sales System — Complete Schema (Phase 1)
-- =============================================================================
-- Generated from production VM via pg_dump + cleaned for Docker initdb use.
-- Safe to re-run: all statements use IF NOT EXISTS or are wrapped in DO blocks
-- that ignore duplicate-object errors.
--
-- Usage:
--   Replace backend/src/migrations/init.sql with this file.
--   On a fresh volume, docker-compose will apply it automatically.
--
-- Contains 28 tables + 32 sequences covering:
--   - Auth & RBAC: roles, permissions, role_permissions, users, login_logs
--   - Org: departments
--   - Staff: staff + 7 detail tables (contact/address/employment/salary/
--           history/notes/documents) + salary_adjustments
--   - Payroll: payroll
--   - Products & Stock: product_categories, products, product_units,
--           product_serials, stock_movements
--   - Procurement: suppliers, purchase_orders, po_items, po_approvals
--   - Tax: withholding_tax, withholding_tax_items, withholding_tax_cert
-- =============================================================================



CREATE TABLE IF NOT EXISTS public.departments (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;

CREATE TABLE IF NOT EXISTS public.login_logs (
    id integer NOT NULL,
    user_id integer,
    ip_address character varying(50),
    user_agent text,
    status character varying(20) DEFAULT 'success'::character varying,
    created_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.login_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.login_logs_id_seq OWNED BY public.login_logs.id;

CREATE TABLE IF NOT EXISTS public.payroll (
    id integer NOT NULL,
    staff_id integer,
    year integer NOT NULL,
    month integer NOT NULL,
    salary numeric(12,2) DEFAULT 0,
    social_security numeric(10,2) DEFAULT 0,
    withholding_tax numeric(10,2) DEFAULT 0,
    bonus numeric(12,2) DEFAULT 0,
    overtime numeric(12,2) DEFAULT 0,
    other_income numeric(12,2) DEFAULT 0,
    other_deduction numeric(12,2) DEFAULT 0,
    net_pay numeric(12,2) DEFAULT 0,
    status character varying(20) DEFAULT 'draft'::character varying,
    created_by integer,
    approved_by integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.payroll_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.payroll_id_seq OWNED BY public.payroll.id;

CREATE TABLE IF NOT EXISTS public.permissions (
    id integer NOT NULL,
    module character varying(50) NOT NULL,
    action character varying(50) NOT NULL,
    description text
);

CREATE SEQUENCE IF NOT EXISTS public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;

CREATE TABLE IF NOT EXISTS public.po_approvals (
    id integer NOT NULL,
    po_id integer NOT NULL,
    approved_by integer NOT NULL,
    action character varying(20) NOT NULL,
    comment text,
    created_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.po_approvals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.po_approvals_id_seq OWNED BY public.po_approvals.id;

CREATE TABLE IF NOT EXISTS public.po_items (
    id integer NOT NULL,
    po_id integer NOT NULL,
    product_id integer NOT NULL,
    unit character varying(30) DEFAULT 'ชิ้น'::character varying,
    quantity numeric(15,2) NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    total_price numeric(15,2) NOT NULL,
    received_qty numeric(15,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.po_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.po_items_id_seq OWNED BY public.po_items.id;

CREATE SEQUENCE IF NOT EXISTS public.po_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE IF NOT EXISTS public.product_categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20),
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.product_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.product_categories_id_seq OWNED BY public.product_categories.id;

CREATE SEQUENCE IF NOT EXISTS public.product_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE IF NOT EXISTS public.product_serials (
    id integer NOT NULL,
    product_id integer NOT NULL,
    serial_no character varying(100),
    mac_address character varying(50),
    status character varying(20) DEFAULT 'available'::character varying,
    po_id integer,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.product_serials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.product_serials_id_seq OWNED BY public.product_serials.id;

CREATE TABLE IF NOT EXISTS public.product_units (
    id integer NOT NULL,
    product_id integer NOT NULL,
    unit_name character varying(30) NOT NULL,
    conversion_rate numeric(15,4) DEFAULT 1,
    created_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.product_units_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.product_units_id_seq OWNED BY public.product_units.id;

CREATE TABLE IF NOT EXISTS public.products (
    id integer NOT NULL,
    product_code character varying(30) NOT NULL,
    name character varying(200) NOT NULL,
    category_id integer,
    default_unit character varying(30) DEFAULT 'ชิ้น'::character varying,
    cost_price numeric(15,2) DEFAULT 0,
    sell_price numeric(15,2) DEFAULT 0,
    stock_qty numeric(15,2) DEFAULT 0,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    model character varying(100),
    product_type character varying(20) DEFAULT 'stock'::character varying
);

CREATE SEQUENCE IF NOT EXISTS public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;

CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id integer NOT NULL,
    po_number character varying(20) NOT NULL,
    supplier_id integer NOT NULL,
    po_date date DEFAULT CURRENT_DATE,
    expected_date date,
    total_amount numeric(15,2) DEFAULT 0,
    vat_rate numeric(5,2) DEFAULT 7,
    vat_amount numeric(15,2) DEFAULT 0,
    grand_total numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'draft'::character varying,
    notes text,
    created_by integer,
    approved_by integer,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.purchase_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.purchase_orders_id_seq OWNED BY public.purchase_orders.id;

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id integer NOT NULL,
    role_id integer NOT NULL,
    permission_id integer NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS public.role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;

CREATE TABLE IF NOT EXISTS public.roles (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;

CREATE TABLE IF NOT EXISTS public.salary_adjustments (
    id integer NOT NULL,
    staff_id integer,
    type character varying(20) NOT NULL,
    category character varying(50),
    name character varying(100),
    amount numeric(12,2) DEFAULT 0,
    is_recurring boolean DEFAULT false,
    effective_from date,
    effective_until date,
    created_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.salary_adjustments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.salary_adjustments_id_seq OWNED BY public.salary_adjustments.id;

CREATE TABLE IF NOT EXISTS public.staff (
    id integer NOT NULL,
    employee_code character varying(20) NOT NULL,
    title_th character varying(30),
    first_name_th character varying(100) NOT NULL,
    last_name_th character varying(100) NOT NULL,
    nickname_th character varying(50),
    first_name_en character varying(100),
    last_name_en character varying(100),
    nickname_en character varying(50),
    id_card_number character varying(20),
    passport_number character varying(20),
    date_of_birth date,
    profile_image character varying(500),
    department_id integer,
    "position" character varying(100),
    hire_date date,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_address (
    id integer NOT NULL,
    staff_id integer,
    house_no character varying(20),
    moo character varying(10),
    soi character varying(50),
    intersection character varying(50),
    road character varying(50),
    sub_district character varying(50),
    district character varying(50),
    province character varying(50),
    postal_code character varying(10),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.staff_address_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.staff_address_id_seq OWNED BY public.staff_address.id;

CREATE TABLE IF NOT EXISTS public.staff_contact (
    id integer NOT NULL,
    staff_id integer,
    mobile_phone character varying(20),
    email character varying(100),
    line_id character varying(50),
    address text,
    emergency_contact_name character varying(100),
    emergency_contact_phone character varying(20),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.staff_contact_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.staff_contact_id_seq OWNED BY public.staff_contact.id;

CREATE TABLE IF NOT EXISTS public.staff_documents (
    id integer NOT NULL,
    staff_id integer,
    document_type character varying(50),
    file_name character varying(255),
    file_path character varying(500),
    mime_type character varying(100),
    file_size integer,
    uploaded_at timestamp without time zone DEFAULT now(),
    uploaded_by integer
);

CREATE SEQUENCE IF NOT EXISTS public.staff_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.staff_documents_id_seq OWNED BY public.staff_documents.id;

CREATE TABLE IF NOT EXISTS public.staff_employment (
    id integer NOT NULL,
    staff_id integer,
    hire_date date,
    department character varying(50),
    "position" character varying(100),
    payment_channel character varying(50),
    bank_name character varying(50),
    bank_account_no character varying(30),
    bank_account_type character varying(30),
    bank_branch character varying(50),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.staff_employment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.staff_employment_id_seq OWNED BY public.staff_employment.id;

CREATE TABLE IF NOT EXISTS public.staff_history (
    id integer NOT NULL,
    staff_id integer,
    change_type character varying(50),
    field_changed character varying(100),
    old_value text,
    new_value text,
    remarks text,
    changed_by integer,
    changed_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.staff_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.staff_history_id_seq OWNED BY public.staff_history.id;

CREATE SEQUENCE IF NOT EXISTS public.staff_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.staff_id_seq OWNED BY public.staff.id;

CREATE TABLE IF NOT EXISTS public.staff_notes (
    id integer NOT NULL,
    staff_id integer,
    content text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.staff_notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.staff_notes_id_seq OWNED BY public.staff_notes.id;

CREATE TABLE IF NOT EXISTS public.staff_salary (
    id integer NOT NULL,
    staff_id integer,
    employee_type character varying(20) DEFAULT 'monthly'::character varying,
    salary numeric(12,2) DEFAULT 0,
    social_security_eligible boolean DEFAULT false,
    social_security numeric(10,2) DEFAULT 0,
    withholding_tax numeric(10,2) DEFAULT 0,
    auto_calc_tax boolean DEFAULT false,
    tax_condition character varying(50),
    remarks text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    ss_rate numeric(5,2) DEFAULT 5,
    ss_max_salary numeric(12,2) DEFAULT 17500
);

CREATE SEQUENCE IF NOT EXISTS public.staff_salary_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.staff_salary_id_seq OWNED BY public.staff_salary.id;

CREATE TABLE IF NOT EXISTS public.stock_movements (
    id integer NOT NULL,
    product_id integer NOT NULL,
    movement_type character varying(20) NOT NULL,
    quantity numeric(15,2) NOT NULL,
    before_qty numeric(15,2) DEFAULT 0,
    after_qty numeric(15,2) DEFAULT 0,
    reference_type character varying(30),
    reference_id integer,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.stock_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.stock_movements_id_seq OWNED BY public.stock_movements.id;

CREATE SEQUENCE IF NOT EXISTS public.supplier_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE IF NOT EXISTS public.suppliers (
    id integer NOT NULL,
    code character varying(20),
    name character varying(200) NOT NULL,
    contact_person character varying(100),
    phone character varying(30),
    email character varying(100),
    address text,
    tax_id character varying(20),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;

CREATE TABLE IF NOT EXISTS public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(200),
    password_hash character varying(200) NOT NULL,
    staff_id integer,
    role_id integer NOT NULL,
    is_active boolean DEFAULT true,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

CREATE SEQUENCE IF NOT EXISTS public.wht_doc_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE IF NOT EXISTS public.withholding_tax (
    id integer NOT NULL,
    doc_no character varying(20) NOT NULL,
    book_no character varying(10) DEFAULT ''::character varying,
    tax_year integer NOT NULL,
    copy_no smallint DEFAULT 1,
    issue_date date,
    payer_name character varying(200) NOT NULL,
    payer_tax_id character varying(20) NOT NULL,
    payer_address text,
    staff_id integer,
    payee_name character varying(200) NOT NULL,
    payee_tax_id character varying(20) NOT NULL,
    payee_address text,
    pnd_form character varying(20),
    pnd_seq integer DEFAULT 1,
    income_type character varying(20),
    income_desc character varying(200),
    total_income numeric(15,2) DEFAULT 0 NOT NULL,
    total_tax numeric(15,2) DEFAULT 0 NOT NULL,
    fund_gpf numeric(15,2) DEFAULT 0,
    fund_sso numeric(15,2) DEFAULT 0,
    fund_pvf numeric(15,2) DEFAULT 0,
    withhold_method smallint DEFAULT 1 NOT NULL,
    tax_words character varying(200),
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.withholding_tax_cert (
    id integer NOT NULL,
    staff_id integer,
    year integer NOT NULL,
    cert_no character varying(50),
    total_income numeric(14,2) DEFAULT 0,
    total_tax numeric(12,2) DEFAULT 0,
    total_social_security numeric(12,2) DEFAULT 0,
    issued_date date,
    created_by integer,
    created_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.withholding_tax_cert_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.withholding_tax_cert_id_seq OWNED BY public.withholding_tax_cert.id;

CREATE SEQUENCE IF NOT EXISTS public.withholding_tax_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.withholding_tax_id_seq OWNED BY public.withholding_tax.id;

CREATE TABLE IF NOT EXISTS public.withholding_tax_items (
    id integer NOT NULL,
    wht_id integer NOT NULL,
    pay_date character varying(30),
    income_amount numeric(15,2) NOT NULL,
    tax_amount numeric(15,2) NOT NULL,
    description character varying(200),
    created_at timestamp without time zone DEFAULT now(),
    pnd_form character varying(20),
    income_type character varying(20)
);

CREATE SEQUENCE IF NOT EXISTS public.withholding_tax_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.withholding_tax_items_id_seq OWNED BY public.withholding_tax_items.id;

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);

ALTER TABLE ONLY public.login_logs ALTER COLUMN id SET DEFAULT nextval('public.login_logs_id_seq'::regclass);

ALTER TABLE ONLY public.payroll ALTER COLUMN id SET DEFAULT nextval('public.payroll_id_seq'::regclass);

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);

ALTER TABLE ONLY public.po_approvals ALTER COLUMN id SET DEFAULT nextval('public.po_approvals_id_seq'::regclass);

ALTER TABLE ONLY public.po_items ALTER COLUMN id SET DEFAULT nextval('public.po_items_id_seq'::regclass);

ALTER TABLE ONLY public.product_categories ALTER COLUMN id SET DEFAULT nextval('public.product_categories_id_seq'::regclass);

ALTER TABLE ONLY public.product_serials ALTER COLUMN id SET DEFAULT nextval('public.product_serials_id_seq'::regclass);

ALTER TABLE ONLY public.product_units ALTER COLUMN id SET DEFAULT nextval('public.product_units_id_seq'::regclass);

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);

ALTER TABLE ONLY public.purchase_orders ALTER COLUMN id SET DEFAULT nextval('public.purchase_orders_id_seq'::regclass);

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);

ALTER TABLE ONLY public.salary_adjustments ALTER COLUMN id SET DEFAULT nextval('public.salary_adjustments_id_seq'::regclass);

ALTER TABLE ONLY public.staff ALTER COLUMN id SET DEFAULT nextval('public.staff_id_seq'::regclass);

ALTER TABLE ONLY public.staff_address ALTER COLUMN id SET DEFAULT nextval('public.staff_address_id_seq'::regclass);

ALTER TABLE ONLY public.staff_contact ALTER COLUMN id SET DEFAULT nextval('public.staff_contact_id_seq'::regclass);

ALTER TABLE ONLY public.staff_documents ALTER COLUMN id SET DEFAULT nextval('public.staff_documents_id_seq'::regclass);

ALTER TABLE ONLY public.staff_employment ALTER COLUMN id SET DEFAULT nextval('public.staff_employment_id_seq'::regclass);

ALTER TABLE ONLY public.staff_history ALTER COLUMN id SET DEFAULT nextval('public.staff_history_id_seq'::regclass);

ALTER TABLE ONLY public.staff_notes ALTER COLUMN id SET DEFAULT nextval('public.staff_notes_id_seq'::regclass);

ALTER TABLE ONLY public.staff_salary ALTER COLUMN id SET DEFAULT nextval('public.staff_salary_id_seq'::regclass);

ALTER TABLE ONLY public.stock_movements ALTER COLUMN id SET DEFAULT nextval('public.stock_movements_id_seq'::regclass);

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

ALTER TABLE ONLY public.withholding_tax ALTER COLUMN id SET DEFAULT nextval('public.withholding_tax_id_seq'::regclass);

ALTER TABLE ONLY public.withholding_tax_cert ALTER COLUMN id SET DEFAULT nextval('public.withholding_tax_cert_id_seq'::regclass);

ALTER TABLE ONLY public.withholding_tax_items ALTER COLUMN id SET DEFAULT nextval('public.withholding_tax_items_id_seq'::regclass);

DO $phase2$ BEGIN
  ALTER TABLE public.departments ADD CONSTRAINT departments_code_key UNIQUE (code);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.departments ADD CONSTRAINT departments_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.login_logs ADD CONSTRAINT login_logs_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.payroll ADD CONSTRAINT payroll_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.payroll ADD CONSTRAINT payroll_staff_id_year_month_key UNIQUE (staff_id, year, month);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.permissions ADD CONSTRAINT permissions_module_action_key UNIQUE (module, action);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.permissions ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.po_approvals ADD CONSTRAINT po_approvals_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.po_items ADD CONSTRAINT po_items_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.product_categories ADD CONSTRAINT product_categories_code_key UNIQUE (code);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.product_categories ADD CONSTRAINT product_categories_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.product_serials ADD CONSTRAINT product_serials_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.product_units ADD CONSTRAINT product_units_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_product_code_key UNIQUE (product_code);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_role_id_permission_id_key UNIQUE (role_id, permission_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.roles ADD CONSTRAINT roles_code_key UNIQUE (code);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.roles ADD CONSTRAINT roles_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.salary_adjustments ADD CONSTRAINT salary_adjustments_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_address ADD CONSTRAINT staff_address_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_address ADD CONSTRAINT staff_address_staff_id_key UNIQUE (staff_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_contact ADD CONSTRAINT staff_contact_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_contact ADD CONSTRAINT staff_contact_staff_id_key UNIQUE (staff_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_documents ADD CONSTRAINT staff_documents_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff ADD CONSTRAINT staff_employee_code_key UNIQUE (employee_code);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_employment ADD CONSTRAINT staff_employment_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_employment ADD CONSTRAINT staff_employment_staff_id_key UNIQUE (staff_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_history ADD CONSTRAINT staff_history_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_notes ADD CONSTRAINT staff_notes_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff ADD CONSTRAINT staff_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_salary ADD CONSTRAINT staff_salary_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_salary ADD CONSTRAINT staff_salary_staff_id_key UNIQUE (staff_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_code_key UNIQUE (code);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_username_key UNIQUE (username);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.withholding_tax_cert ADD CONSTRAINT withholding_tax_cert_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.withholding_tax_cert ADD CONSTRAINT withholding_tax_cert_staff_id_year_key UNIQUE (staff_id, year);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.withholding_tax ADD CONSTRAINT withholding_tax_doc_no_key UNIQUE (doc_no);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.withholding_tax_items ADD CONSTRAINT withholding_tax_items_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.withholding_tax ADD CONSTRAINT withholding_tax_pkey PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

CREATE INDEX IF NOT EXISTS idx_serial_product ON public.product_serials USING btree (product_id);

CREATE INDEX IF NOT EXISTS idx_serial_status ON public.product_serials USING btree (status);

CREATE INDEX IF NOT EXISTS idx_staff_department ON public.staff USING btree (department_id);

CREATE INDEX IF NOT EXISTS idx_staff_employee_code ON public.staff USING btree (employee_code);

CREATE INDEX IF NOT EXISTS idx_staff_status ON public.staff USING btree (status);

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users USING btree (username);

CREATE INDEX IF NOT EXISTS idx_wht_staff_id ON public.withholding_tax USING btree (staff_id);

CREATE INDEX IF NOT EXISTS idx_wht_status ON public.withholding_tax USING btree (status);

CREATE INDEX IF NOT EXISTS idx_wht_tax_year ON public.withholding_tax USING btree (tax_year);

DO $phase2$ BEGIN
  ALTER TABLE public.login_logs ADD CONSTRAINT login_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.payroll ADD CONSTRAINT payroll_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.payroll ADD CONSTRAINT payroll_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.payroll ADD CONSTRAINT payroll_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.po_approvals ADD CONSTRAINT po_approvals_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.po_approvals ADD CONSTRAINT po_approvals_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.po_items ADD CONSTRAINT po_items_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.po_items ADD CONSTRAINT po_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.product_serials ADD CONSTRAINT product_serials_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.product_serials ADD CONSTRAINT product_serials_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.product_units ADD CONSTRAINT product_units_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.salary_adjustments ADD CONSTRAINT salary_adjustments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_address ADD CONSTRAINT staff_address_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_contact ADD CONSTRAINT staff_contact_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff ADD CONSTRAINT staff_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_documents ADD CONSTRAINT staff_documents_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_documents ADD CONSTRAINT staff_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_employment ADD CONSTRAINT staff_employment_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_history ADD CONSTRAINT staff_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_history ADD CONSTRAINT staff_history_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_notes ADD CONSTRAINT staff_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_notes ADD CONSTRAINT staff_notes_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.staff_salary ADD CONSTRAINT staff_salary_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.users ADD CONSTRAINT users_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.withholding_tax_cert ADD CONSTRAINT withholding_tax_cert_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.withholding_tax_cert ADD CONSTRAINT withholding_tax_cert_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.withholding_tax ADD CONSTRAINT withholding_tax_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.withholding_tax_items ADD CONSTRAINT withholding_tax_items_wht_id_fkey FOREIGN KEY (wht_id) REFERENCES public.withholding_tax(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

DO $phase2$ BEGIN
  ALTER TABLE public.withholding_tax ADD CONSTRAINT withholding_tax_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);
EXCEPTION WHEN OTHERS THEN NULL;
END $phase2$;

