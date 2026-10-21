// Event Liaison consultation request form.
(function () {
    var form = document.getElementById('elForm');
    if (!form) return;
    var status = document.getElementById('elStatus');
    var btn = document.getElementById('elSubmit');
    var want = new URLSearchParams(location.search).get('service');
    var sel = document.getElementById('eService');
    if (want && sel.querySelector('option[value="' + want + '"]')) sel.value = want;
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var data = {};
        new FormData(form).forEach(function (v, k) { data[k] = v; });
        if (!data.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim())) {
            status.className = 'form-status form-status-error';
            status.textContent = 'Please add your name and a valid email address.';
            return;
        }
        btn.disabled = true; btn.textContent = 'Sending...';
        fetch('/.netlify/functions/liaison-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (res) {
                if (!res.ok) throw new Error(res.j.error || 'Something went wrong.');
                form.reset();
                status.className = 'form-status form-status-ok';
                status.textContent = 'Thank you! Your request is in. We will email you within 1 to 2 business days to arrange your consultation.';
            })
            .catch(function (err) { status.className = 'form-status form-status-error'; status.textContent = err.message; })
            .then(function () { btn.disabled = false; btn.textContent = 'Request a consultation'; });
    });
})();
