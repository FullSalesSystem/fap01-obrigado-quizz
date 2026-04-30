(function () {
  var TOTAL = 5;
  var current = 1;

  var progressBar   = document.getElementById('progress-bar');
  var stepLabel     = document.getElementById('step-label');
  var stepNum       = document.getElementById('step-num');
  var btnBack       = document.getElementById('btn-back');
  var btnConfirm    = document.getElementById('btn-confirm');
  var btnSubmit     = document.getElementById('btn-submit');
  var quizNav       = document.getElementById('quiz-nav');
  var successScreen = document.getElementById('success-screen');

  /* ── Lead data from previous page ──
     Preferred channel: sessionStorage key 'lead_data' (set by signup
     page on the same origin). Fallback: querystring, kept only for
     backwards compatibility while the previous page is migrated.
     Either way, after reading we strip the data from URL and storage
     to avoid PII lingering in history, Referer headers, and shared
     storage. */
  var LEAD_FIELDS = ['nome', 'email', 'whatsapp', 'cargo', 'segmento', 'receita'];

  function readLeadData() {
    var data = {};
    var i;

    /* 1. sessionStorage */
    try {
      var raw = sessionStorage.getItem('lead_data');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          for (i = 0; i < LEAD_FIELDS.length; i++) {
            var k = LEAD_FIELDS[i];
            if (typeof parsed[k] === 'string') data[k] = parsed[k];
          }
          sessionStorage.removeItem('lead_data');
          return data;
        }
      }
    } catch (e) { /* storage unavailable or malformed JSON, fall through */ }

    /* 2. fallback: querystring */
    var p = new URLSearchParams(window.location.search);
    for (i = 0; i < LEAD_FIELDS.length; i++) {
      data[LEAD_FIELDS[i]] = p.get(LEAD_FIELDS[i]) || '';
    }

    /* Strip the querystring so PII does not leak via Referer headers
       to fonts.googleapis.com / GTM / Meta resources loaded later. */
    if (window.history && typeof window.history.replaceState === 'function') {
      try {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      } catch (e) { /* non-fatal */ }
    }

    return data;
  }

  var leadData = readLeadData();

  /* ── Show step ── */
  function showStep(num, back) {
    for (var i = 1; i <= TOTAL; i++) {
      var wrapper = document.getElementById('wrapper-' + i) || (i === 1 ? document.querySelector('.steps-wrapper') : null);
      var step    = document.getElementById('step-' + i);
      if (!wrapper || !step) continue;
      if (i === num) {
        wrapper.style.display = '';
        step.classList.add('active');
        step.classList.toggle('anim-back', !!back);
        void step.offsetWidth;
      } else {
        wrapper.style.display = 'none';
        step.classList.remove('active');
      }
    }
  }

  /* ── Update UI ── */
  function updateUI() {
    stepLabel.textContent       = 'Pergunta ' + current + ' de ' + TOTAL;
    stepNum.textContent         = current;
    progressBar.style.width     = ((current / TOTAL) * 100) + '%';
    btnBack.classList.toggle('btn--hidden', current === 1);
    btnConfirm.classList.toggle('btn--hidden', current !== 2);
    btnSubmit.classList.toggle('btn--hidden', current !== TOTAL);
  }

  /* ── Advance ── */
  function advance() {
    current++;
    showStep(current, false);
    updateUI();
  }

  /* ── Collect answers ── */
  function collectAnswers() {
    return {
      nome:     leadData.nome     || '',
      email:    leadData.email    || '',
      whatsapp: leadData.whatsapp || '',
      cargo:    leadData.cargo    || '',
      segmento: leadData.segmento || '',
      receita:  leadData.receita  || '',
      q1: (document.querySelector('input[name="q1"]:checked') || {}).value || '',
      q2: Array.from(document.querySelectorAll('input[name="q2"]:checked')).map(function (c) { return c.value; }),
      q3: (document.querySelector('input[name="q3"]:checked') || {}).value || '',
      q4: (document.querySelector('input[name="q4"]:checked') || {}).value || '',
      q5: (document.querySelector('input[name="q5"]:checked') || {}).value || ''
    };
  }

  /* ── Submit with timeout + retry ── */
  var WEBHOOK_URL = 'https://responsefss.fullsalessystem.com.br/webhook/DESENVRESPS';
  var REDIRECT_URL = 'https://fap01-calendly.fullsalessystem.com';
  var REQUEST_TIMEOUT_MS = 8000;
  var MAX_ATTEMPTS = 2;

  function postOnce(url, payload) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, REQUEST_TIMEOUT_MS) : null;
    var opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    };
    if (ctrl) opts.signal = ctrl.signal;
    return fetch(url, opts).then(function (res) {
      if (timer) clearTimeout(timer);
      if (!res.ok) throw new Error('http_' + res.status);
      return true;
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  function postWithRetry(url, payload, attempts) {
    function tryOnce(n) {
      return postOnce(url, payload).catch(function () {
        if (n + 1 < attempts) return tryOnce(n + 1);
        return false;
      });
    }
    return tryOnce(0);
  }

  function submitQuiz() {
    var payload = collectAnswers();
    postWithRetry(WEBHOOK_URL, payload, MAX_ATTEMPTS).then(function (ok) {
      if (!ok) {
        /* Persist locally so the lead is not silently lost; a future
           page or session can attempt re-send. Errors here are non-fatal. */
        try { localStorage.setItem('quiz_pending_submission', JSON.stringify({
          payload: payload,
          ts: Date.now()
        })); } catch (e) { /* storage may be unavailable / full */ }
      } else {
        try { localStorage.removeItem('quiz_pending_submission'); } catch (e) {}
      }
      window.location.href = REDIRECT_URL;
    });
  }

  /* ── Submit button (step 5) ── */
  btnSubmit.addEventListener('click', function () {
    if (!document.querySelector('input[name="q5"]:checked')) {
      var card = document.getElementById('quiz-card');
      card.style.animation = 'none';
      void card.offsetWidth;
      card.style.animation = 'shake 0.4s ease';
      return;
    }
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Enviando...';
    submitQuiz();
  });

  /* ── Radio: auto-advance after short delay (not on last step) ── */
  document.querySelectorAll('input[type="radio"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      document.querySelectorAll('input[name="' + radio.name + '"]').forEach(function (r) {
        r.closest('.option, .scale-option').classList.remove('selected');
      });
      radio.closest('.option, .scale-option').classList.add('selected');
      if (current < TOTAL) {
        setTimeout(advance, 380);
      }
    });
  });

  /* ── Checkboxes: highlight + mutual exclusion ── */
  document.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      if (cb.value === 'todos' && cb.checked) {
        document.querySelectorAll('input[name="q2"]').forEach(function (other) {
          if (other.value !== 'todos') {
            other.checked = false;
            other.closest('.option').classList.remove('selected');
          }
        });
      } else if (cb.value !== 'todos' && cb.checked) {
        var todos = document.getElementById('todos-acima');
        todos.checked = false;
        todos.closest('.option').classList.remove('selected');
      }
      cb.closest('.option').classList.toggle('selected', cb.checked);
    });
  });

  /* ── Confirm button (step 2) ── */
  btnConfirm.addEventListener('click', function () {
    if (!document.querySelector('input[name="q2"]:checked')) {
      var card = document.getElementById('quiz-card');
      card.style.animation = 'none';
      void card.offsetWidth;
      card.style.animation = 'shake 0.4s ease';
      return;
    }
    advance();
  });

  /* ── Back ── */
  btnBack.addEventListener('click', function () {
    if (current > 1) {
      current--;
      showStep(current, true);
      updateUI();
    }
  });

  /* ── Logo fallback (replaces inline onerror=) ── */
  var navLogo = document.getElementById('navbar-logo');
  var navLogoFallback = document.getElementById('navbar-logo-fallback');
  if (navLogo && navLogoFallback) {
    navLogo.addEventListener('error', function () {
      navLogo.classList.add('is-hidden');
      navLogoFallback.classList.remove('is-hidden');
    });
  }

  updateUI();
})();
