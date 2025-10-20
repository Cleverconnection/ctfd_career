(function () {
  const translations = window.CTFDCareerTranslations || {};
  const container = document.querySelector('[data-career-id]');
  const modalEl = document.getElementById('challengeModal');

  if (!container || !modalEl) {
    return;
  }

  const careerId = Number(container.getAttribute('data-career-id'));
  const modal = typeof bootstrap !== 'undefined' ? new bootstrap.Modal(modalEl) : null;
  const modalBody = modalEl.querySelector('.modal-body');
  const modalMeta = modalEl.querySelector('[data-role="challenge-meta"]');
  const modalFeedback = modalEl.querySelector('[data-role="challenge-feedback"]');
  const submitButton = modalEl.querySelector('[data-action="submit-flag"]');
  const loadingTemplate = modalEl.querySelector('[data-role="challenge-loading"]');

  let flagInput = null;
  let currentChallengeId = null;

  function t(key, fallback) {
    return translations[key] || fallback || key;
  }

  function setFeedback(level, message) {
    if (!modalFeedback) {
      return;
    }

    if (!message) {
      modalFeedback.classList.add('d-none');
      modalFeedback.textContent = '';
      modalFeedback.classList.remove('alert-success', 'alert-danger', 'alert-info');
      return;
    }

    modalFeedback.classList.remove('alert-success', 'alert-danger', 'alert-info');
    modalFeedback.classList.add(`alert-${level}`);
    modalFeedback.textContent = message;
    modalFeedback.classList.remove('d-none');
  }

  function renderChallengeMeta(data) {
    if (!modalMeta) {
      return;
    }

    const segments = [];
    if (typeof data.value !== 'undefined') {
      segments.push(`${t('Value', 'Value')}: ${data.value}`);
    }
    if (data.category) {
      segments.push(`${t('Category', 'Category')}: ${data.category}`);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'max_attempts')) {
      if (data.max_attempts !== null && data.max_attempts !== 0) {
        segments.push(`${t('Attempts Remaining', 'Attempts Remaining')}: ${data.max_attempts}`);
      } else {
        segments.push(`${t('Attempts Remaining', 'Attempts Remaining')}: ${t('Unlimited', 'Unlimited')}`);
      }
    }

    modalMeta.textContent = segments.join(' • ');
  }

  function renderChallengeBody(data) {
    modalBody.innerHTML = '';
    flagInput = null;

    if (data.html) {
      const wrapper = document.createElement('div');
      wrapper.className = 'mb-3 challenge-html';
      wrapper.innerHTML = data.html;
      modalBody.appendChild(wrapper);
    } else if (data.description) {
      const description = document.createElement('div');
      description.className = 'mb-3';
      description.innerHTML = data.description;
      modalBody.appendChild(description);
    } else {
      const empty = document.createElement('p');
      empty.className = 'text-muted';
      empty.textContent = t('No description provided', 'No description provided');
      modalBody.appendChild(empty);
    }

    const inputGroup = document.createElement('div');
    inputGroup.className = 'mb-3';

    const label = document.createElement('label');
    label.className = 'form-label';
    label.setAttribute('for', 'career-challenge-flag');
    label.textContent = t('Flag', 'Flag');

    flagInput = document.createElement('input');
    flagInput.type = 'text';
    flagInput.className = 'form-control';
    flagInput.id = 'career-challenge-flag';
    flagInput.placeholder = t('Enter flag', 'Enter flag');
    flagInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitFlag();
      }
    });

    inputGroup.appendChild(label);
    inputGroup.appendChild(flagInput);

    modalBody.appendChild(inputGroup);
  }

  function showLoading() {
    modalBody.innerHTML = '';
    if (loadingTemplate) {
      modalBody.appendChild(loadingTemplate.cloneNode(true));
    } else {
      const loader = document.createElement('div');
      loader.className = 'text-center py-5';
      loader.textContent = `${t('Loading Challenge', 'Loading Challenge')}...`;
      modalBody.appendChild(loader);
    }
  }

  async function openChallenge(challengeId) {
    currentChallengeId = challengeId;
    setFeedback(null, '');
    renderChallengeMeta({});
    showLoading();

    try {
      const response = await fetch(`/plugins/career/api/v1/career/challenges/${challengeId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || 'Failed to load challenge');
      }

      const data = payload.data || {};
      renderChallengeMeta(data);
      renderChallengeBody(data);

      if (data.solved) {
        setFeedback('success', t('Challenge already solved', 'Challenge already solved'));
      } else {
        setFeedback(null, '');
      }

      if (modal) {
        modal.show();
      }

      setTimeout(() => {
        if (flagInput) {
          flagInput.focus();
        }
      }, 100);
    } catch (error) {
      console.error(error);
      setFeedback('danger', error.message || t('Unexpected error', 'Unexpected error'));
      if (modal) {
        modal.show();
      }
    }
  }

  async function refreshCareerProgress() {
    try {
      const response = await fetch('/plugins/career/api/v1/career', { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || 'Failed to refresh progress');
      }

      const careers = (payload.data && payload.data.careers) || [];
      const career = careers.find((entry) => entry.id === careerId);
      if (!career) {
        return;
      }

      const totalSteps = career.total_steps || career.steps.length || 0;
      const completedSteps = career.completed_steps || 0;
      const percent = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0;

      const progressBar = document.getElementById('career-progress-bar');
      if (progressBar) {
        progressBar.style.width = `${percent}%`;
        progressBar.setAttribute('aria-valuenow', String(percent));
        progressBar.textContent = `${percent}%`;
      }

      const progressCount = container.querySelector('[data-role="career-progress-count"]');
      if (progressCount) {
        progressCount.textContent = completedSteps;
      }

      career.steps.forEach((step) => {
        const card = container.querySelector(`[data-step-id="${step.id}"]`);
        if (!card) {
          return;
        }
        card.setAttribute('data-step-completed', step.completed ? 'true' : 'false');
        const badge = card.querySelector('[data-step-badge]');
        if (badge) {
          badge.textContent = step.completed ? t('Completed', 'Completed') : t('In Progress', 'In Progress');
          badge.classList.toggle('bg-success', Boolean(step.completed));
          badge.classList.toggle('bg-secondary', !step.completed);
        }
      });
    } catch (error) {
      console.error(error);
    }
  }

  async function submitFlag() {
    if (!currentChallengeId || !flagInput) {
      return;
    }

    const submission = flagInput.value.trim();
    if (!submission) {
      setFeedback('info', t('Enter flag', 'Enter flag'));
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
    }
    setFeedback('info', t('Submitting...', 'Submitting...'));

    try {
      if (!window.CTFd || !window.CTFd.api || !window.CTFd.api.post_challenge_attempt) {
        throw new Error('Challenge submission API unavailable');
      }

      const result = await window.CTFd.api.post_challenge_attempt({}, {
        challenge_id: currentChallengeId,
        submission,
      });

      if (result.success === false) {
        throw new Error(
          (result.data && result.data.message) || result.message || t('Unexpected error', 'Unexpected error')
        );
      }

      const data = result.data || {};
      const status = data.status;
      const message = data.message || '';

      if (status === 'correct') {
        setFeedback('success', message || t('Challenge solved!', 'Challenge solved!'));
        flagInput.value = '';
        await refreshCareerProgress();
      } else {
        setFeedback('danger', message || t('Incorrect flag', 'Incorrect flag'));
      }
    } catch (error) {
      console.error(error);
      setFeedback('danger', error.message || t('Unexpected error', 'Unexpected error'));
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  }

  container.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action="open-challenge"]');
    if (!target) {
      return;
    }

    const challengeId = Number(target.getAttribute('data-challenge-id'));
    if (!challengeId) {
      return;
    }

    openChallenge(challengeId);
  });

  if (submitButton) {
    submitButton.addEventListener('click', submitFlag);
  }

  modalEl.addEventListener('shown.bs.modal', () => {
    if (flagInput) {
      flagInput.focus();
    }
  });
})();
