document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form') || document.getElementById('adminLoginForm');
  const passInput = document.querySelector('input[type="password"]');

  if (!form || !passInput) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = passInput.value.trim();

    if (!password) {
      alert('برجاء أدخل كلمة المرور');
      return;
    }

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        alert(result.error || 'كلمة المرور غير صحيحة');
        return;
      }

      alert('تم تسجيل الدخول بنجاح!');
      console.log('بيانات المسجلين:', result.data || result.rows);
      
      // If your admin.html has a data container, render the results
      const dataContainer = document.getElementById('dataContainer') || document.getElementById('results');
      if (dataContainer && (result.data || result.rows)) {
        const rows = result.data || result.rows;
        dataContainer.innerHTML = `<pre>${JSON.stringify(rows, null, 2)}</pre>`;
      }
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الاتصال بالخادم');
    }
  });
});