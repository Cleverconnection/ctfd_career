(function () {
  const translations = window.CTFDCareerTranslations || {};
  const t = (key, fallback) => translations[key] || fallback || key;

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.innerText = str;
    return div.innerHTML;
  }

  window.carregarDesafio = async function (challengeId, stepName) {
    document
      .querySelectorAll("div[id^='challenge-area-']")
      .forEach((div) => div.classList.add("d-none"));

    const area = document.getElementById(`challenge-area-${challengeId}`);
    const msg = document.getElementById("mensagem-inicial");
    if (msg) msg.classList.add("d-none");

    if (!area) return;

    const safeStepName = escapeHtml(stepName || "");
    area.classList.remove("d-none");
    area.innerHTML = `<div class="alert alert-info">${t(
      "Carregando desafio",
      "Carregando desafio"
    )} "<b>${safeStepName}</b>"...</div>`;

    try {
      const res = await fetch(`/api/v1/challenges/${challengeId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar desafio");
      const payload = await res.json();
      const ch = payload.data;
      if (!ch) throw new Error("Desafio não encontrado");

      const description = ch.description || "";
      area.innerHTML = `
        <div class="card shadow-sm">
          <div class="card-body">
            <h5 class="card-title text-primary">${ch.name}</h5>
            <div class="mb-3">${description}</div>
            <div class="input-group">
              <input id="flag-${ch.id}" class="form-control" placeholder="${t(
                "Digite a flag aqui",
                "Digite a flag aqui"
              )}">
              <button class="btn btn-success" onclick="enviarFlag(${ch.id})">${t(
                "Enviar flag",
                "Enviar flag"
              )}</button>
            </div>
            <div id="feedback-${ch.id}" class="mt-2"></div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error(err);
      area.innerHTML = `<div class='alert alert-danger'>${t(
        "Erro ao carregar o desafio",
        "Erro ao carregar o desafio"
      )}.</div>`;
    }
  };

  window.enviarFlag = async function (challengeId) {
    const flagInput = document.getElementById(`flag-${challengeId}`);
    const feedback = document.getElementById(`feedback-${challengeId}`);
    const flag = flagInput ? flagInput.value.trim() : "";

    if (!feedback) {
      return;
    }

    if (!flag) {
      feedback.innerHTML = `<div class='text-warning'>⚠️ ${t(
        "Por favor, insira uma flag antes de enviar.",
        "Por favor, insira uma flag antes de enviar."
      )}</div>`;
      return;
    }

    feedback.innerHTML = `<div class='text-info'>${t(
      "Enviando flag...",
      "Enviando flag..."
    )}</div>`;

    try {
      const res = await fetch("/api/v1/challenges/attempt", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge_id: challengeId,
          submission: flag,
        }),
      });

      const result = await res.json();

      if (result.success && result.data && result.data.status === "correct") {
        feedback.innerHTML = `<div class='alert alert-success mt-2'>✅ ${t(
          "Flag correta",
          "Flag correta"
        )}! ${t("Parabéns!", "Parabéns!")}</div>`;
      } else {
        feedback.innerHTML = `<div class='alert alert-danger mt-2'>❌ ${t(
          "Flag incorreta",
          "Flag incorreta"
        )}. ${t("Tente novamente.", "Tente novamente.")}</div>`;
      }
    } catch (err) {
      console.error(err);
      feedback.innerHTML = `<div class='alert alert-danger mt-2'>${t(
        "Erro ao enviar flag.",
        "Erro ao enviar flag."
      )}</div>`;
    }
  };
})();
