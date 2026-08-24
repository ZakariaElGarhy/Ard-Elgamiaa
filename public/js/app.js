let currentUser = null;

// Governorate Mapping for Egyptian National IDs
const GOVERNORATES = {
  "01": "القاهرة", "02": "الإسكندرية", "03": "بورسعيد", "04": "السويس",
  "11": "دمياط", "12": "الدقهلية", "13": "الشرقية", "14": "القليوبية",
  "15": "كفر الشيخ", "16": "الغربية", "17": "المنوفية", "18": "البحيرة",
  "19": "الإسماعيلية", "21": "الجيزة", "22": "بني سويف", "23": "الفيوم",
  "24": "المنيا", "25": "أسيوط", "26": "سوهاج", "27": "قنا",
  "28": "أسوان", "29": "الأقصر", "31": "البحر الأحمر", "32": "الوادي الجديد",
  "33": "مطروح", "34": "شمال سيناء", "35": "جنوب سيناء", "88": "خارج الجمهورية"
};

// Strict Numeric Filter Input Listener
document.addEventListener('input', (e) => {
  if (e.target.classList.contains('num-only')) {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  }
});

// National ID Parser Function
function parseNationalID(id) {
  const msgEl = document.getElementById('idValidationMsg');
  const dobInput = document.getElementById('dob');
  const govInput = document.getElementById('birth_governorate');

  if (id.length !== 14) {
    msgEl.textContent = "يجب أن يتكون الرقم القومي من 14 رقم بالضبط";
    msgEl.className = "hint-msg invalid";
    dobInput.value = "";
    govInput.value = "";
    return;
  }

  const centuryDigit = id[0];
  const yearDigit = id.substring(1, 3);
  const monthDigit = id.substring(3, 5);
  const dayDigit = id.substring(5, 7);
  const govCode = id.substring(7, 9);

  let century = "";
  if (centuryDigit === "2") century = "19";
  else if (centuryDigit === "3") century = "20";
  else {
    msgEl.textContent = "رقم قومي غير صالحة خانة القرن";
    msgEl.className = "hint-msg invalid";
    return;
  }

  const fullYear = century + yearDigit;
  const formattedDate = `${fullYear}-${monthDigit}-${dayDigit}`;
  
  dobInput.value = formattedDate;
  govInput.value = GOVERNORATES[govCode] || "غير معروف";

  msgEl.textContent = "✓ رقم قومي صحيح وتم استخراج البيانات تلقائياً";
  msgEl.className = "hint-msg valid";
}

function syncDeclarationName(val) {
  document.getElementById('declaration_name').value = val;
}

// Auth Logic
function toggleAuth(type) {
  document.getElementById('loginBox').classList.toggle('hidden', type === 'register');
  document.getElementById('registerBox').classList.toggle('hidden', type === 'login');
}

async function register() {
  const full_name = document.getElementById('regName').value;
  const phone = document.getElementById('regPhone').value;
  const password = document.getElementById('regPass').value;

  if (!full_name || phone.length !== 11 || !password) {
    alert("يرجى ملء جميع الحقول واستخدام رقم هاتف مكون من 11 رقم");
    return;
  }

  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name, phone, password })
  });
  const data = await res.json();
  if (data.success) {
    currentUser = data;
    loadForm();
  } else {
    alert(data.error);
  }
}

async function login() {
  const phone = document.getElementById('loginPhone').value;
  const password = document.getElementById('loginPass').value;

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password })
  });
  const data = await res.json();
  if (data.success) {
    currentUser = data;
    loadForm();
  } else {
    alert(data.error);
  }
}

function loadForm() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('formScreen').classList.remove('hidden');
  document.getElementById('full_name').value = currentUser.name;
  document.getElementById('declaration_name').value = currentUser.name;
  document.getElementById('phone').value = currentUser.phone;
  initCanvas();
}

// Canvas Signature
let canvas, ctx, isDrawing = false;

function initCanvas() {
  canvas = document.getElementById('signatureCanvas');
  ctx = canvas.getContext('2d');
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#000000";

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e) => { isDrawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); };
  const move = (e) => { if (isDrawing) { const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); } };
  const stop = () => isDrawing = false;

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', stop);

  canvas.addEventListener('touchstart', (e) => { start(e); e.preventDefault(); });
  canvas.addEventListener('touchmove', (e) => { move(e); e.preventDefault(); });
  canvas.addEventListener('touchend', stop);
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// File Helper: File to Base64
const fileToBase64 = file => new Promise((resolve, reject) => {
  if (!file) return resolve("");
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

// Form Submission
async function submitForm() {
  const nationalId = document.getElementById('national_id').value;
  if (nationalId.length !== 14) {
    alert("يرجى إدخال رقم قومي صحيح مكون من 14 رقم");
    return;
  }

  const docIdFile = document.getElementById('doc_id_file').files[0];
  const docAuthFile = document.getElementById('doc_auth_file').files[0];

  const payload = {
    userId: currentUser.userId,
    full_name: document.getElementById('full_name').value,
    national_id: nationalId,
    dob: document.getElementById('dob').value,
    birth_governorate: document.getElementById('birth_governorate').value,
    job_title: document.getElementById('job_title').value,
    job_grade: document.getElementById('job_grade').value,
    membership_status: document.querySelector('input[name="membership_status"]:checked').value,
    phone: document.getElementById('phone').value,
    whatsapp_no: document.getElementById('whatsapp_no').value,
    landline_no: document.getElementById('landline_no').value,
    email: document.getElementById('email').value,
    governorate: document.getElementById('governorate').value,
    city: document.getElementById('city').value,
    district: document.getElementById('district').value,
    detailed_address: document.getElementById('detailed_address').value,
    membership_no: document.getElementById('membership_no').value,
    join_date: document.getElementById('join_date').value,
    plot_no: document.getElementById('plot_no').value,
    plot_area: document.getElementById('plot_area').value,
    construction_status: document.querySelector('input[name="construction_status"]:checked').value,
    residency_status: document.querySelector('input[name="residency_status"]:checked').value,
    emergency_name: document.getElementById('emergency_name').value,
    emergency_kinship: document.getElementById('emergency_kinship').value,
    emergency_phone: document.getElementById('emergency_phone').value,
    declaration_name: document.getElementById('declaration_name').value,
    doc_id_file: await fileToBase64(docIdFile),
    doc_auth_file: await fileToBase64(docAuthFile),
    signature: canvas.toDataURL('image/png')
  };

  const res = await fetch('/api/submit-form', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const resData = await res.json();
  if (resData.success) {
    alert('تم إرسال الاستمارة بنجاح وحفظ البيانات بجدول السجلات.');
    location.reload();
  } else {
    alert('حدث خطأ أثناء الحفظ: ' + resData.error);
  }
}