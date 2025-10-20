// === Utilitários ===
function csrfToken() {
  return (window.init && window.init.csrfNonce) || window.csrfNonce || "";
}

async function carregarScript(src) {
  return new Promise((resolve, reject) => {
    if (!src) return resolve();
    if (document.querySelector(`script[src='${src}']`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Erro ao carregar script: ${src}`));
    document.body.appendChild(s);
  });
}

function reexecutarScripts(rootEl) {
  if (!rootEl) return;
  const scripts = rootEl.querySelectorAll("script");
  scripts.forEach((old) => {
    const s = document.createElement("script");
    if (old.src) s.src = old.src;
    else s.textContent = old.textContent;
    document.body.appendChild(s);
    old.remove();
  });
}

function isProvavelmenteHTML(str) {
  if (typeof str !== "string") return false;
  const t = str.trim();
  return t.startsWith("<") || t.includes("<div") || t.includes("<template");
}

// === Função principal ===
async function carregarDesafio(challengeId, stepName) {
  document
    .querySelectorAll("div[id^='challenge-area-']")
    .forEach((div) => div.classList.add("d-none"));

  const area = document.getElementById(`challenge-area-${challengeId}`);
  const msg = document.getElementById("mensagem-inicial");
  const globalError = document.getElementById("mensagem-erro-global");
  if (msg) msg.classList.add("d-none");
  if (globalError) globalError.classList.add("d-none");

  if (!area) return;

  area.classList.remove("d-none");
  area.innerHTML = `<div class="alert alert-info">Carregando desafio "<b>${stepName || ""}</b>"...</div>`;

  try {
    const res = await fetch(`/api/v1/challenges/${challengeId}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Erro ao buscar desafio");
    const payload = await res.json();
    const ch = payload.data;
    if (!ch) throw new Error("Desafio não encontrado");

    if (window.CTFd && CTFd._internal && CTFd._internal.challenge) {
      CTFd._internal.challenge.data = ch;
    }

    if (ch.view) {
      let html;
      if (isProvavelmenteHTML(ch.view)) {
        html = ch.view;
      } else {
        const viewResp = await fetch(ch.view, { credentials: "include" });
        if (!viewResp.ok) throw new Error("Erro ao carregar template do desafio");
        html = await viewResp.text();
      }

      area.innerHTML = html;
      reexecutarScripts(area);

      let scriptPath = ch.scripts?.view ? ch.scripts.view : typeof ch.view === "string" ? ch.view.replace(/\.html$/, ".js") : null;
      await carregarScript(scriptPath);

      try {
        if (window.CTFd?._internal?.challenge?.postRender) {
          CTFd._internal.challenge.postRender();
        } else if (window.challenge?.postRender) {
          window.challenge.postRender();
        }
        if (window.Alpine?.initTree) {
          window.Alpine.initTree(area);
        }
      } catch (e) {
        console.warn("Aviso: pós-render falhou ou não existe:", e);
      }
      return;
    }

    area.innerHTML = `
      <div class="card shadow-sm">
        <div class="card-body">
          <h5 class="card-title text-primary">${ch.name}</h5>
          <div class="mb-3">${ch.description || ""}</div>
          <div class="input-group">
            <input id="flag-${ch.id}" class="form-control" placeholder="Digite a flag aqui">
            <button class="btn btn-success" onclick="enviarFlag(${ch.id})">Enviar flag</button>
          </div>
          <div id="feedback-${ch.id}" class="mt-2"></div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("Erro ao carregar desafio:", err);
    area.innerHTML = `<div class="alert alert-danger">❌ Falha ao carregar o desafio. Verifique o console.</div>`;
    if (globalError) {
      globalError.classList.remove("d-none");
    }
  }
}

// === Submissão de flag ===
async function enviarFlag(challengeId) {
  const flagInput = document.getElementById(`flag-${challengeId}`);
  const feedback = document.getElementById(`feedback-${challengeId}`);
  const flag = flagInput ? flagInput.value.trim() : "";

  if (!feedback) {
    return;
  }

  if (!flag) {
    feedback.innerHTML = "<div class='text-warning'>⚠️ Por favor, insira uma flag antes de enviar.</div>";
    return;
  }

  feedback.innerHTML = "<div class='text-info'>Enviando flag...</div>";

  try {
    const res = await fetch("/api/v1/challenges/attempt", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "CSRF-Token": csrfToken(),
      },
      body: JSON.stringify({
        challenge_id: challengeId,
        submission: flag,
      }),
    });

    const result = await res.json();

    if (result.success && result.data?.status === "correct") {
      feedback.innerHTML = "<div class='alert alert-success mt-2'>✅ Flag correta! Parabéns!</div>";
    } else {
      feedback.innerHTML = "<div class='alert alert-danger mt-2'>❌ Flag incorreta. Tente novamente.</div>";
    }
  } catch (err) {
    console.error(err);
    feedback.innerHTML = "<div class='alert alert-danger mt-2'>Erro ao enviar flag.</div>";
  }
}

window.carregarDesafio = carregarDesafio;
window.enviarFlag = enviarFlag;
