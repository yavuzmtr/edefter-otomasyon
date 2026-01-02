document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('uninstall-form');
  const status = document.getElementById('status');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = 'Kaldırılıyor...';
    status.style.color = '#333';
    const full = document.getElementById('full-uninstall').checked;
    const result = await window.uninstallerAPI.uninstall(full);
    if (result.success) {
      status.textContent = 'Kaldırma işlemi tamamlandı!';
      status.style.color = 'green';
    } else {
      status.textContent = 'Kaldırma sırasında hata oluştu!';
      status.style.color = 'red';
    }
  });
});
