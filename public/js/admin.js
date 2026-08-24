async function fetchAdminData() {
  const adminKey = document.getElementById('adminKey').value;

  const res = await fetch('/api/admin/submissions', {
    headers: { 'x-admin-key': adminKey }
  });

  if (!res.ok) {
    alert('مفتاح المرور غير صحيح');
    return;
  }

  const records = await res.json();
  
  document.getElementById('adminAuth').classList.add('hidden');
  document.getElementById('adminDashboard').classList.remove('hidden');

  const tbody = document.querySelector('#recordsTable tbody');
  tbody.innerHTML = '';

  records.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.id}</td>
      <td>${row.full_name}</td>
      <td>${row.national_id}</td>
      <td>${row.phone}</td>
      <td>${row.plot_no}</td>
      <td>${row.plot_area} م²</td>
      <td>${row.construction_status}</td>
      <td><img src="${row.signature}" width="80" height="30"/></td>
      <td>${new Date(row.created_at).toLocaleDateString('ar-EG')}</td>
    `;
    tbody.appendChild(tr);
  });
}