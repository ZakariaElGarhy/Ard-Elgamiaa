const express = require('express');
const { google } = require('googleapis');

const app = express();
app.use(express.json({ limit: '10mb' }));

const EXCEL_HEADER_ROW = [
  'رقم الطلب', 'الاسم رباعي', 'الرقم القومي', 'تاريخ الميلاد', 'محافظة الميلاد',
  'الوظيفة', 'الدرجة', 'حالة العضوية', 'رقم المحمول', 'واتساب', 'أرضي', 'الإيميل',
  'المحافظة', 'المدينة', 'الحي/المركز', 'العنوان التفصيلي', 'رقم العضوية', 'تاريخ الانضمام',
  'رقم القطعة', 'المساحة (م²)', 'موقف البناء', 'موقف السكن', 'اسم المفوض', 'صلة القرابة',
  'هاتف المفوض', 'بطاقة العضو (Base64)', 'بطاقة المفوض (Base64)', 'التوقيع (Base64)', 'تاريخ التسجيل'
];

function sanitizeCell(val) {
  if (!val) return 'لا يوجد';
  const str = String(val);
  if (str.length > 49000) {
    return str.substring(0, 49000) + '... [تم تقليص النص لتجاوز الحجم المسموح]';
  }
  return str;
}

function getSheetsClient() {
  let base64Creds = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!base64Creds) {
    throw new Error('MISSING_ENV_VAR: GOOGLE_CREDENTIALS_BASE64 is not set in Vercel');
  }

  base64Creds = base64Creds.replace(/^["']|["']$/g, '').replace(/\s+/g, '').trim();

  let credentials;
  try {
    const jsonString = Buffer.from(base64Creds, 'base64').toString('utf8');
    credentials = JSON.parse(jsonString);

    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
  } catch (err) {
    throw new Error('INVALID_BASE64: Failed to parse GOOGLE_CREDENTIALS_BASE64 string');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

// Handler for Admin Requests
async function handleAdminAuth(req, res) {
  const { password } = req.body;
  const ADMIN_PASS = process.env.ADMIN_PASSWORD || '12345678';

  if (String(password || '').trim() !== ADMIN_PASS) {
    return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
  }

  try {
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) throw new Error('MISSING_ENV_VAR: GOOGLE_SHEET_ID is not set');

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A:Z',
    });

    const rows = response.data.values || [];
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('ADMIN_ERROR:', err);
    res.status(500).json({ error: err.message });
  }
}

// Support multiple endpoint URLs used by admin.html
app.post('/api/admin/login', handleAdminAuth);
app.post('/api/admin/get-data', handleAdminAuth);
app.post('/api/admin/data', handleAdminAuth);

// User Register Endpoint
app.post('/api/auth/register', async (req, res) => {
  const { phone, full_name, password } = req.body;
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) throw new Error('MISSING_ENV_VAR: GOOGLE_SHEET_ID is not set in Vercel');

    let check;
    try {
      check = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Users!A:C' });
    } catch (e) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: 'Users' } } }] }
      });
      check = { data: { values: [] } };
    }

    const rows = check.data.values || [];
    if (rows.some(r => r[0] === phone)) {
      return res.status(400).json({ error: 'رقم الهاتف مستخدم بالفعل' });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Users!A:C',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[phone, full_name, password]] }
    });

    res.json({ success: true, userId: Date.now(), name: full_name, phone });
  } catch (err) {
    console.error('REGISTER_ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// User Login Endpoint (Handles both standard user login and single-password admin requests)
app.post('/api/auth/login', async (req, res) => {
  const { phone, password } = req.body;

  // If request comes from admin.html with only a password
  if (!phone && password) {
    return handleAdminAuth(req, res);
  }

  try {
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) throw new Error('MISSING_ENV_VAR: GOOGLE_SHEET_ID is not set in Vercel');

    let response;
    try {
      response = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Users!A:C' });
    } catch (e) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const rows = response.data.values || [];
    const normalize = (val) => String(val || '').trim().replace(/^0+/, '');
    const targetPhone = normalize(phone);
    const targetPass = String(password || '').trim();

    const user = rows.find(r => normalize(r[0]) === targetPhone && String(r[2] || '').trim() === targetPass);

    if (!user) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    res.json({ success: true, userId: Date.now(), name: user[1], phone: user[0] });
  } catch (err) {
    console.error('LOGIN_ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Submit Form Endpoint
app.post('/api/submit-form', async (req, res) => {
  const data = req.body;
  try {
    const sheets = getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) throw new Error('MISSING_ENV_VAR: GOOGLE_SHEET_ID is not set in Vercel');

    const check = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Sheet1!A1:Z1' });
    if (!check.data.values || check.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: 'Sheet1!A1', valueInputOption: 'USER_ENTERED', requestBody: { values: [EXCEL_HEADER_ROW] }
      });
    }

    const row = [
      Date.now(),
      sanitizeCell(data.full_name), sanitizeCell(data.national_id), sanitizeCell(data.dob), sanitizeCell(data.birth_governorate),
      sanitizeCell(data.job_title), sanitizeCell(data.job_grade), sanitizeCell(data.membership_status), sanitizeCell(data.phone), sanitizeCell(data.whatsapp_no),
      sanitizeCell(data.landline_no), sanitizeCell(data.email), sanitizeCell(data.governorate), sanitizeCell(data.city), sanitizeCell(data.district), sanitizeCell(data.detailed_address),
      sanitizeCell(data.membership_no), sanitizeCell(data.join_date), sanitizeCell(data.plot_no), sanitizeCell(data.plot_area), sanitizeCell(data.construction_status),
      sanitizeCell(data.residency_status), sanitizeCell(data.emergency_name), sanitizeCell(data.emergency_kinship), sanitizeCell(data.emergency_phone),
      sanitizeCell(data.doc_id_file), sanitizeCell(data.doc_auth_file), sanitizeCell(data.signature),
      new Date().toLocaleString('ar-EG')
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId, range: 'Sheet1!A:Z', valueInputOption: 'USER_ENTERED', requestBody: { values: [row] }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('SUBMIT_ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;