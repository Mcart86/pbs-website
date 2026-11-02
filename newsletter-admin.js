(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var MAX = 4000000;
  var form = $('nl-form'), pw = $('nl-pw'), msg = $('nl-msg'), submit = $('nl-submit');
  var pdfBox = $('nl-pdf-box'), linkBox = $('nl-link-box'), source = $('nl-source');

  try { pw.value = sessionStorage.getItem('nlpw') || ''; } catch (e) {}
  var today = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; };
  $('nl-date').value = today.getFullYear() + '-' + z(today.getMonth() + 1) + '-' + z(today.getDate());

  function kind() { return form.querySelector('input[name="kind"]:checked').value; }
  function syncKind() {
    var link = kind() === 'link';
    pdfBox.hidden = link; linkBox.hidden = !link;
    source.value = link ? 'NABIP' : 'PBS';
  }
  Array.prototype.forEach.call(form.querySelectorAll('input[name="kind"]'), function (r) { r.addEventListener('change', syncKind); });

  function say(text, ok) { msg.hidden = false; msg.textContent = text; msg.className = 'nl-msg ' + (ok ? 'is-ok' : 'is-error'); }
  function password() { return pw.value; }
  function api(method, qs, body, headers) {
    var h = Object.assign({ 'x-admin-password': password() }, headers || {});
    return fetch('/api/newsletters' + (qs || ''), { method: method, headers: h, body: body }).then(function (r) {
      return r.text().then(function (t) {
        var data = {}; try { data = JSON.parse(t); } catch (e) {}
        if (!r.ok) { var err = new Error(friendly(r.status, data)); err.status = r.status; throw err; }
        return data;
      });
    });
  }
  function friendly(status, data) {
    if (data && data.code === 'not_configured') {
      if (data.missing === 'password') return "The upload password hasn't reached the website yet. Please ask Mike to check the password setting and redeploy.";
      if (data.missing === 'storage') return "The file storage isn't connected to the website yet. Please ask Mike to check the storage connection and redeploy.";
      return "This page isn't fully set up yet. Please ask Mike to finish the setup.";
    }
    if (status === 401) return "That password isn't right. Please try again.";
    if (status === 413) return data && data.error ? data.error : 'That file is too large (4 MB maximum). Please compress the PDF and try again.';
    if (data && data.error) return data.error;
    return 'Something went wrong. Please try again in a moment.';
  }

  /* ---- list of published newsletters ---- */
  function fmt(d) { var p = d.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  function loadList() {
    var ul = $('nl-admin-list'), st = $('nl-admin-status');
    fetch('/api/newsletters', { cache: 'no-store' }).then(function (r) {
      return r.json().then(function (d) { if (!r.ok) throw new Error(friendly(r.status, d)); return d; });
    }).then(function (d) {
      ul.textContent = '';
      st.hidden = d.items.length > 0; st.textContent = 'Nothing has been published yet.';
      d.items.forEach(function (i) {
        var li = document.createElement('li');
        var info = document.createElement('div');
        var a = document.createElement('a'); a.href = i.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = i.title;
        var meta = document.createElement('span'); meta.textContent = fmt(i.date) + (i.source ? ' \u00b7 ' + i.source : '') + ' \u00b7 ' + (i.kind === 'pdf' ? 'PDF' : 'Link');
        info.appendChild(a); info.appendChild(meta);
        var del = document.createElement('button'); del.type = 'button'; del.className = 'nl-remove'; del.textContent = 'Remove';
        del.setAttribute('aria-label', 'Remove ' + i.title);
        del.addEventListener('click', function () { remove(i); });
        li.appendChild(info); li.appendChild(del); ul.appendChild(li);
      });
    }).catch(function (e) { st.hidden = false; st.textContent = e.message; });
  }
  function remove(i) {
    if (!password()) { say('Enter the password above first, then click Remove again.', false); pw.focus(); return; }
    if (!window.confirm('Remove "' + i.title + '" from the website?')) return;
    api('DELETE', '?id=' + encodeURIComponent(i.id)).then(function () { say('Removed.', true); loadList(); })
      .catch(function (e) { say(e.message, false); });
  }

  /* ---- publish ---- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var title = $('nl-title').value.trim(), date = $('nl-date').value, k = kind();
    if (!password()) { say('Please enter the password.', false); pw.focus(); return; }
    if (title.length < 3) { say('Please enter a title.', false); $('nl-title').focus(); return; }
    if (!date) { say('Please choose a date.', false); $('nl-date').focus(); return; }
    var qs = '?kind=' + k + '&title=' + encodeURIComponent(title) + '&date=' + encodeURIComponent(date) + '&source=' + encodeURIComponent(source.value), req;
    if (k === 'pdf') {
      var f = $('nl-file').files[0];
      if (!f) { say('Please choose a PDF file.', false); $('nl-file').focus(); return; }
      if (f.size > MAX) { say('That PDF is over 4 MB. Please compress it (for example at ilovepdf.com) and try again.', false); return; }
      req = api('POST', qs, f, { 'Content-Type': 'application/octet-stream' });
    } else {
      var u = $('nl-url').value.trim();
      if (!/^https?:\/\//i.test(u)) { say('Please paste the full link, starting with https://', false); $('nl-url').focus(); return; }
      req = api('POST', qs + '&url=' + encodeURIComponent(u));
    }
    submit.disabled = true; submit.textContent = 'Publishing\u2026'; say('Publishing\u2026', true);
    req.then(function () {
      try { sessionStorage.setItem('nlpw', password()); } catch (er) {}
      say('Published! It is now on the website.', true);
      $('nl-title').value = ''; $('nl-file').value = ''; $('nl-url').value = '';
      loadList();
    }).catch(function (er) { say(er.message, false); })
      .then(function () { submit.disabled = false; submit.textContent = 'Publish'; });
  });

  syncKind(); loadList();
})();
