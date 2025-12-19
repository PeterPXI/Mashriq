(function () {

  // لو المستخدم مسجل → نوديه services
  if (localStorage.getItem('token')) {
    window.location.href = '/app/services.html';
    return;
  }

  const form = document.getElementById('registerForm');
  const submitBtn = document.getElementById('submitBtn');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const fullName = document.getElementById('fullName').value.trim();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
      alert('كلمتا المرور غير متطابقتين');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'جاري إنشاء الحساب...';

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName,
          username,
          email,
          password
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'فشل إنشاء الحساب');
      }

      // حفظ التوكن
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // تحويل
      window.location.href = '/app/services.html';

    } catch (err) {
      alert(err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'إنشاء حساب';
    }
  });

})();
