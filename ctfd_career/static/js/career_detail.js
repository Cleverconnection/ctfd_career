(function () {
  const translations = window.CTFDCareerTranslations || {};
  const t = (key, fallback) => translations[key] || fallback || key;

  const challengeArea = document.getElementById("area-desafio");
  if (!challengeArea) {
    return;
  }

  async function carregarDesafio(challengeId) {
    if (!challengeId) {
      return;
    }

    challengeArea.innerHTML = `<div class="alert alert-info">${t(
      "Carregando desafio...",
      "Carregando desafio..."
    )}</div>`;

    try {
      const response = await fetch(
        `/plugins/career/api/v1/career/challenges/${challengeId}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      challengeArea.innerHTML = html;

      const scripts = Array.from(challengeArea.querySelectorAll("script"));
      scripts.forEach((script) => {
        const novo = document.createElement("script");
        if (script.src) {
          novo.src = script.src;
        } else {
          novo.textContent = script.textContent;
        }
        document.body.appendChild(novo);
        script.remove();
      });

      const submitButton = challengeArea.querySelector("button[type='submit']");
      if (submitButton) {
        submitButton.textContent = t("Enviar flag", "Enviar flag");
      }
    } catch (error) {
      console.error("Erro ao carregar desafio:", error);
      challengeArea.innerHTML = `<div class="alert alert-danger">${t(
        "Não foi possível carregar o desafio.",
        "Não foi possível carregar o desafio."
      )}</div>`;
    }
  }

  window.carregarDesafio = carregarDesafio;
})();
