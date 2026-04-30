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

  /* ── URL params — user data from the signup form ── */
  var urlParams = new URLSearchParams(window.location.search);

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
      /* user data from URL */
      nome:     urlParams.get('nome')     || '',
      email:    urlParams.get('email')    || '',
      whatsapp: urlParams.get('whatsapp') || '',
      cargo:    urlParams.get('cargo')    || '',
      segmento: urlParams.get('segmento') || '',
      receita:  urlParams.get('receita')  || '',
      /* quiz answers */
      q1: (document.querySelector('input[name="q1"]:checked') || {}).value || '',
      q2: Array.from(document.querySelectorAll('input[name="q2"]:checked')).map(function (c) { return c.value; }),
      q3: (document.querySelector('input[name="q3"]:checked') || {}).value || '',
      q4: (document.querySelector('input[name="q4"]:checked') || {}).value || '',
      q5: (document.querySelector('input[name="q5"]:checked') || {}).value || ''
    };
  }

  /* ── Submit ── */
  function submitQuiz() {
    fetch('https://responsefss.fullsalessystem.com.br/webhook/DESENVRESPS', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectAnswers())
    }).finally(function () {
      window.location.href = 'https://fap01-calendly.fullsalessystem.com';
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
