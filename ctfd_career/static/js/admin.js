(function () {
  // =======================
  // Configurações iniciais
  // =======================
  const translations = window.CTFDCareerTranslations || {};
  const careerList = document.getElementById("career-admin-list");
  const careerForm = document.getElementById("career-form");
  const stepForm = document.getElementById("step-form");
  const careerSelect = document.getElementById("step-career-id");
  const syncButton = document.getElementById("career-sync-button");
  const summaryContainer = document.getElementById("career-summary");

  // =======================
  // Funções utilitárias
  // =======================

  // Localiza e retorna o token CSRF do CTFd
  function csrfHeader() {
    if (window.init && window.init.csrfNonce) return window.init.csrfNonce;
    if (typeof window.csrfNonce !== "undefined") return window.csrfNonce;
    if (typeof csrfNonce !== "undefined") return csrfNonce;
    console.warn("⚠️ CSRF nonce não encontrado!");
    return null;
  }

  // Wrapper padrão de fetch com headers corretos e CSRF
  async function apiFetch(path, opts = {}) {
    const headers = Object.assign({}, opts.headers || {}, {
      "Content-Type": "application/json",
      "CSRF-Token": csrfHeader(),
    });

    const response = await fetch(path, { ...opts, headers, credentials: "include" });

    if (!response.ok) {
      let msg;
      try {
        const err = await response.json();
        msg = err.message || JSON.stringify(err);
      } catch {
        msg = await response.text();
      }
      throw new Error(msg || `HTTP ${response.status}`);
    }

    const ct = response.headers.get("content-type") || "";
    return ct.includes("application/json") ? response.json() : null;
  }

  // Notificação rápida (alerta)
  function notify(message, variant = "success") {
    const alert = document.createElement("div");
    alert.className = `alert alert-${variant}`;
    alert.textContent = message;
    if (summaryContainer) summaryContainer.prepend(alert);
    else document.body.prepend(alert);
    setTimeout(() => alert.remove(), 4000);
  }

  // Tradução simples
  function t(key) {
    return translations[key] || key;
  }

  // =======================
  // Renderização das carreiras
  // =======================
  function renderCareers(careers) {
    careerList.innerHTML = "";
    careerSelect.innerHTML = "";

    if (!careers.length) {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = t("No careers available yet");
      placeholder.disabled = true;
      placeholder.selected = true;
      careerSelect.appendChild(placeholder);

      const empty = document.createElement("div");
      empty.className = "alert alert-info";
      empty.textContent = t("No careers available yet");
      careerList.appendChild(empty);
      return;
    }

    careers.forEach((career) => {
      const option = document.createElement("option");
      option.value = career.id;
      option.textContent = career.name;
      careerSelect.appendChild(option);

      const item = document.createElement("div");
      item.className = "card mb-3";

      const header = document.createElement("div");
      header.className =
        "card-header d-flex justify-content-between align-items-center";
      header.innerHTML = `<span class="fw-semibold">${career.name}</span>`;

      const buttons = document.createElement("div");
      buttons.innerHTML = `
        <button class="btn btn-sm btn-primary me-2" data-action="edit" data-id="${career.id}">${t("Edit")}</button>
        <button class="btn btn-sm btn-danger" data-action="delete" data-id="${career.id}">${t("Delete")}</button>
      `;
      header.appendChild(buttons);

      const body = document.createElement("div");
      body.className = "card-body";
      body.innerHTML = `
        <p class="mb-1"><strong>${t("Description")}:</strong> ${career.description || "-"}</p>
        <p class="mb-0"><strong>${t("Steps")}:</strong> ${career.total_steps || 0}</p>
      `;

      item.appendChild(header);
      item.appendChild(body);
      careerList.appendChild(item);
    });
  }

  // =======================
  // Carregamento de dados
  // =======================
  async function loadCareers() {
    try {
      const payload = await apiFetch("/plugins/career/api/v1/career");
      if (!payload.success) throw new Error(payload.message);
      renderCareers(payload.data.careers || []);
    } catch (err) {
      notify(err.message, "danger");
    }
  }

  async function loadSummary() {
    try {
      const payload = await apiFetch("/plugins/career/api/v1/career/summary");
      if (!payload.success) throw new Error(payload.message);
      const data = payload.data || {};
      const tableBody = summaryContainer.querySelector("tbody");
      tableBody.innerHTML = "";
      Object.values(data).forEach((entry) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${entry.career}</td>
          <td>${entry.completed}</td>
          <td>${entry.total}</td>
        `;
        tableBody.appendChild(row);
      });
    } catch (err) {
      notify(err.message, "danger");
    }
  }

  // =======================
  // Criação e edição de carreiras
  // =======================
  if (careerForm) {
    careerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(careerForm);
      const payload = Object.fromEntries(formData.entries());
      const id = payload.id || null;

      try {
        if (id) {
          // Atualização (PUT)
          await apiFetch(`/plugins/career/api/v1/career/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          notify(t("Career updated"));
        } else {
          // Criação (POST)
          await apiFetch("/plugins/career/api/v1/career", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          notify(t("Career created"));
        }

        careerForm.reset();
        await loadCareers();
        await loadSummary();
      } catch (err) {
        notify(err.message, "danger");
      }
    });
  }

  // =======================
  // Adição de steps
  // =======================
  if (stepForm) {
    stepForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(stepForm);
      const payload = Object.fromEntries(formData.entries());
      payload.required_solves = Number(payload.required_solves || 1);

      try {
        await apiFetch("/plugins/career/api/v1/career/steps", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        stepForm.reset();
        await loadCareers();
        await loadSummary();
        notify(t("Step created"));
      } catch (err) {
        notify(err.message, "danger");
      }
    });
  }

  // =======================
  // Sincronização manual
  // =======================
  if (syncButton) {
    syncButton.addEventListener("click", async () => {
      syncButton.disabled = true;
      try {
        await apiFetch("/plugins/career/api/v1/career/sync", { method: "PUT" });
        await loadSummary();
        notify(t("Progress recalculated"));
      } catch (err) {
        notify(err.message, "danger");
      } finally {
        syncButton.disabled = false;
      }
    });
  }

  // =======================
  // Ações de editar e deletar
  // =======================
  if (careerList) {
    careerList.addEventListener("click", async (event) => {
      const action = event.target.dataset.action;
      const id = event.target.dataset.id;
      if (!action || !id) return;

      if (action === "edit") {
        // Preenche formulário com dados existentes
        try {
          const payload = await apiFetch(`/plugins/career/api/v1/career`);
          const career = payload.data.careers.find((c) => c.id == id);
          if (!career) return;
          Object.entries(career).forEach(([key, value]) => {
            const field = careerForm.querySelector(`[name="${key}"]`);
            if (field) field.value = value || "";
          });
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
          notify(err.message, "danger");
        }
      }

      if (action === "delete") {
        if (!confirm(t("Are you sure you want to delete this career?"))) return;
        try {
          await apiFetch(`/plugins/career/api/v1/career/${id}`, {
            method: "DELETE",
          });
          notify(t("Career deleted"));
          await loadCareers();
          await loadSummary();
        } catch (err) {
          notify(err.message, "danger");
        }
      }
    });
  }

  // =======================
  // Inicialização
  // =======================
  document.addEventListener("DOMContentLoaded", () => {
    loadCareers();
    loadSummary();
  });
})();
