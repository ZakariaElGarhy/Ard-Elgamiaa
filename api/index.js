const express = require('express');
const { google } = require('googleapis');

const app = express();
app.use(express.json({ limit: '10mb' })); // Allows direct Base64 document uploads

const EXCEL_HEADER_ROW = [
  'رقم الطلب', 'الاسم رباعي', 'الرقم القومي', 'تاريخ الميلاد', 'محافظة الميلاد',
  'الوظيفة', 'الدرجة', 'حالة العضوية', 'رقم المحمول', 'واتساب', 'أرضي', 'الإيميل',
  'المحافظة', 'المدينة', 'الحي/المركز', 'العنوان التفصيلي', 'رقم العضوية', 'تاريخ الانضمام',
  'رقم القطعة', 'المساحة (م²)', 'موقف البناء', 'موقف السكن', 'اسم المفوض', 'صلة القرابة',
  'هاتف المفوض', 'بطاقة العضو (Base64)', 'بطاقة المفوض (Base64)', 'التوقيع (Base64)', 'تاريخ التسجيل'
];

app.post('/api/submit-form', async (req, res) => {
  const data = req.body;
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: 'credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Check & Insert Headers
    const check = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Sheet1!A1:Z1' });
    if (!check.data.values || check.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: 'Sheet1!A1', valueInputOption: 'USER_ENTERED', requestBody: { values: [EXCEL_HEADER_ROW] }
      });
    }

    const row = [
      Date.now(), data.full_name, data.national_id, data.dob, data.birth_governorate,
      data.job_title, data.job_grade, data.membership_status, data.phone, data.whatsapp_no,
      data.landline_no, data.email, data.governorate, data.city, data.district, data.detailed_address,
      data.membership_no, data.join_date, data.plot_no, data.plot_area, data.construction_status,
      data.residency_status, data.emergency_name, data.emergency_kinship, data.emergency_phone,
      data.doc_id_file || 'لا يوجد', data.doc_auth_file || 'لا يوجد',
      data.signature || 'لا يوجد', new Date().toLocaleString('ar-EG')
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId, range: 'Sheet1!A:Z', valueInputOption: 'USER_ENTERED', requestBody: { values: [row] }
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;