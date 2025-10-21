// === Utilitários ===
function csrfToken() {
  return (window.init && window.init.csrfNonce) || window.csrfNonce || "";
}

function isProbablyHTML(str) {
  if (typeof str !== "string") return false;
  const t = str.trim();
  return t.startsWith("<") || t.includes("<div") || t.includes("<template");
}

function isURLish(str) {
  return typeof str === "string" && !isProbablyHTML(str) && (/^\/|^https?:\/\//.test(str));
}

async function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (!src || !isURLish(src)) return resolve();
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Erro ao carregar script: ${src}`));
    document.body.appendChild(s);
  });
}

function rerunInlineScripts(rootEl) {
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

function resolveViewTemplate(ch) {
  if (isURLish(ch.view)) return ch.view;
  if (isURLish(ch?.type_data?.templates?.view)) return ch.type_data.templates.view;
  switch (ch.type) {
    case "choice":
      return "/plugins/ctfd-plugin-choice-challenge/assets/view.html";
    case "dynamic_iac":
      return "/plugins/ctfd-chall-manager/assets/view.html";
    case "container":
      return "/plugins/containers/assets/view.html";
    default:
      return null;
  }
}

function resolveViewScript(ch) {
  if (isURLish(ch?.type_data?.scripts?.view)) return ch.type_data.scripts.view;
  if (isURLish(ch?.scripts?.view)) return ch.scripts.view;
  if (isURLish(ch.view) && ch.view.endsWith(".html")) return ch.view.replace(/\.html$/, ".js");
  switch (ch.type) {
    case "choice":
      return "/plugins/ctfd-plugin-choice-challenge/assets/view.js";
    case "dynamic_iac":
      return "/plugins/ctfd-chall-manager/assets/view.js";
    case "container":
      return "/plugins/containers/assets/view.js";
    default:
      return null;
  }
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
  area.setAttribute("x-ignore", "");
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

    let html = "";
    if (isProbablyHTML(ch.view)) {
      html = ch.view;
    } else {
      const viewURL = resolveViewTemplate(ch);
      if (!viewURL) {
        throw new Error("View do desafio não encontrada");
      }
      const viewResp = await fetch(viewURL, { credentials: "include" });
      if (!viewResp.ok) throw new Error(`Erro ao carregar template: ${viewURL}`);
      html = await viewResp.text();
    }

    area.innerHTML = html;
    rerunInlineScripts(area);

    const scriptURL = resolveViewScript(ch);
    await loadScript(scriptURL);

    try {
      if (window.CTFd?._internal?.challenge?.postRender) {
        CTFd._internal.challenge.postRender();
      } else if (window.challenge?.postRender) {
        window.challenge.postRender();
      }
      area.removeAttribute("x-ignore");
      if (window.Alpine?.initTree) {
        window.Alpine.initTree(area);
      }
    } catch (e) {
      console.warn("Aviso: pós-render falhou ou não existe:", e);
      area.removeAttribute("x-ignore");
      if (window.Alpine?.initTree) window.Alpine.initTree(area);
    }

    if (localStorage.getItem("debugCareer") === "1") {
      console.log("DEBUG career embed:", {
        type: ch.type,
        view_is_inline: isProbablyHTML(ch.view),
        view_url: isProbablyHTML(ch.view) ? null : resolveViewTemplate(ch),
        script_url: scriptURL,
      });
    }
  } catch (err) {
    console.error("Erro ao carregar desafio:", err);
    area.innerHTML = `<div class="alert alert-danger">❌ Falha ao carregar o desafio. Verifique o console.</div>`;
    area.removeAttribute("x-ignore");
    const globalError = document.getElementById("mensagem-erro-global");
    if (globalError) globalError.classList.remove("d-none");
  }
}

// === Submissão de flag (fallback texto) ===
async function enviarFlag(challengeId) {
  const flagInput = document.getElementById(`flag-${challengeId}`);
  const feedback = document.getElementById(`feedback-${challengeId}`);
  const flag = flagInput?.value?.trim();

  if (!flag) {
    if (feedback) feedback.innerHTML = "<div class='text-warning'>⚠️ Por favor, insira uma flag antes de enviar.</div>";
    return;
  }

  if (feedback) feedback.innerHTML = "<div class='text-info'>Enviando flag...</div>";

  try {
    const res = await fetch("/api/v1/challenges/attempt", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "CSRF-Token": csrfToken(),
      },
      body: JSON.stringify({ challenge_id: challengeId, submission: flag }),
    });

    const result = await res.json();

    if (result.success && result.data?.status === "correct") {
      if (feedback) feedback.innerHTML = `<div class='alert alert-success mt-2'>✅ Flag correta! Parabéns!</div>`;
    } else {
      if (feedback) feedback.innerHTML = `<div class='alert alert-danger mt-2'>❌ Flag incorreta. Tente novamente.</div>`;
    }
  } catch (err) {
    console.error(err);
    if (feedback) feedback.innerHTML = `<div class='alert alert-danger mt-2'>Erro ao enviar flag.</div>`;
  }
}

window.carregarDesafio = carregarDesafio;
window.enviarFlag = enviarFlag;
