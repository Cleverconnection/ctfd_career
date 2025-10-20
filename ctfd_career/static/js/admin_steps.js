(function () {
  const translations = window.CTFDCareerTranslations || {};
  const t = (key, fallback) => translations[key] || fallback;

  const tableBody = document.querySelector("#career-steps-table tbody");
  const statusElement = document.getElementById("career-steps-status");
  let currentEditRow = null;
  let challengeOptions = [];
  const challengeMap = new Map();

  const apiBase = "/plugins/career/api/v1";

  function csrfHeader() {
    if (window.init && window.init.csrfNonce) return window.init.csrfNonce;
    if (typeof window.csrfNonce !== "undefined") return window.csrfNonce;
    if (typeof csrfNonce !== "undefined") return csrfNonce;
    console.warn("CSRF nonce not found for career steps admin operations.");
    return null;
  }

  function displayMessage(level, message) {
    if (!statusElement) {
      return;
    }
    statusElement.innerHTML = "";
    if (!message) {
      return;
    }
    const alert = document.createElement("div");
    alert.className = `alert alert-${level}`;
    alert.textContent = message;
    statusElement.appendChild(alert);
  }

  function escapeHtml(value) {
    return (value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function apiRequest(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    const token = csrfHeader();
    if (token) {
      headers["CSRF-Token"] = token;
    }

    const response = await fetch(`${apiBase}${path}`, {
      credentials: "include",
      headers,
      ...options,
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch (error) {
      // Ignore JSON parse errors, handled below.
    }

    if (!response.ok || payload.success === false) {
      const message =
        (payload && (payload.message || (payload.data && payload.data.message))) ||
        `${response.status} ${response.statusText}`;
      throw new Error(message);
    }

    return payload.data;
  }

  async function loadChallenges(force = false) {
    if (!force && challengeOptions.length) {
      return challengeOptions;
    }

    try {
      const data = await apiRequest(`/career/challenges`);
      challengeOptions = Array.isArray(data) ? data : [];
      challengeMap.clear();
      challengeOptions.forEach((challenge) => {
        challengeMap.set(challenge.id, challenge);
      });
      const inlineSelect = document.getElementById("challenge-select");
      if (inlineSelect) {
        const current = inlineSelect.value ? Number(inlineSelect.value) : null;
        inlineSelect.innerHTML = buildChallengeOptions(current);
      }
      return challengeOptions;
    } catch (error) {
      displayMessage("danger", error.message || t("Unexpected error", "Unexpected error"));
      throw error;
    }
  }

  function closeEditForm() {
    if (currentEditRow && currentEditRow.parentNode) {
      currentEditRow.parentNode.removeChild(currentEditRow);
    }
    currentEditRow = null;
  }

  function buildChallengeOptions(selectedId) {
    const options = [
      `<option value="">${escapeHtml(
        t("Selecione um desafio...", "Selecione um desafio...")
      )}</option>`,
    ];
    challengeOptions.forEach((challenge) => {
      const selected =
        selectedId !== null && selectedId !== undefined && challenge.id === selectedId
          ? " selected"
          : "";
      options.push(
        `<option value="${challenge.id}"${selected}>${escapeHtml(challenge.name)} (#${challenge.id})</option>`
      );
    });
    return options.join("\n");
  }

  function openEditForm(step, career, anchorRow) {
    closeEditForm();

    const formRow = document.createElement("tr");
    formRow.className = "table-light";
    const formCell = document.createElement("td");
    formCell.colSpan = 7;

    const form = document.createElement("form");
    form.className = "row g-3 align-items-end";
    form.innerHTML = `
      <div class="col-md-3">
        <label class="form-label">${t("Step", "Step")}</label>
        <input type="text" name="name" class="form-control" value="${escapeHtml(step.name)}" required />
      </div>
      <div class="col-md-3">
        <label class="form-label">${t("Category", "Category")}</label>
        <input type="text" name="category" class="form-control" value="${escapeHtml(step.category)}" />
      </div>
      <div class="col-md-3">
        <label class="form-label">${t("Desafio vinculado", "Desafio vinculado")}</label>
        <select name="challenge_id" id="challenge-select" class="form-select">
          ${buildChallengeOptions(step.challenge_id)}
        </select>
      </div>
      <div class="col-md-2">
        <label class="form-label">${t("Required Solves", "Required Solves")}</label>
        <input type="number" name="required_solves" class="form-control" min="0" value="${escapeHtml(
          String(step.required_solves ?? 0)
        )}" />
      </div>
      <div class="col-md-2">
        <label class="form-label">${t("Image URL", "Image URL")}</label>
        <input type="text" name="image_url" class="form-control" value="${escapeHtml(
          step.image_url || ""
        )}" />
      </div>
      <div class="col-12">
        <label class="form-label">${t("Description", "Description")}</label>
        <textarea name="description" class="form-control" rows="3">${escapeHtml(step.description)}</textarea>
      </div>
      <div class="col-12 d-flex justify-content-end gap-2">
        <button type="button" class="btn btn-outline-secondary" data-action="cancel">${t(
          "Cancel",
          "Cancel"
        )}</button>
        <button type="submit" class="btn btn-primary">${t("Save", "Save")}</button>
      </div>
    `;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);

      const payload = {
        name: formData.get("name"),
        description: formData.get("description") || null,
        category: formData.get("category") || null,
        required_solves: formData.get("required_solves") || null,
        challenge_id: formData.get("challenge_id"),
        image_url: formData.get("image_url") || null,
      };

      if (payload.required_solves !== null) {
        payload.required_solves = Number(payload.required_solves);
      }

      if (payload.challenge_id === "" || payload.challenge_id === null) {
        payload.challenge_id = null;
      } else {
        payload.challenge_id = Number(payload.challenge_id);
      }

      if (payload.image_url === "") {
        payload.image_url = null;
      }

      try {
        await apiRequest(`/career/steps/${step.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        displayMessage("success", t("Step updated", "Step updated"));
        closeEditForm();
        await loadSteps();
      } catch (error) {
        displayMessage("danger", error.message || t("Unexpected error", "Unexpected error"));
      }
    });

    form.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.dataset.action === "cancel") {
        event.preventDefault();
        closeEditForm();
      }
    });

    formCell.appendChild(form);
    formRow.appendChild(formCell);
    anchorRow.parentNode.insertBefore(formRow, anchorRow.nextSibling);
    currentEditRow = formRow;
  }

  async function handleDelete(stepId) {
    const confirmation = window.confirm(t("Delete Step Confirmation", "Are you sure you want to delete this step?"));
    if (!confirmation) {
      return;
    }

    try {
      await apiRequest(`/career/steps/${stepId}`, { method: "DELETE" });
      displayMessage("success", t("Step deleted", "Step deleted"));
      await loadSteps();
    } catch (error) {
      displayMessage("danger", error.message || t("Unexpected error", "Unexpected error"));
    }
  }

  function createActionButtons(step, career, row) {
    const container = document.createElement("div");
    container.className = "d-flex gap-2";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "btn btn-sm btn-outline-primary";
    editButton.textContent = t("Edit Step", "Edit Step");
    editButton.addEventListener("click", () => openEditForm(step, career, row));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn btn-sm btn-outline-danger";
    deleteButton.textContent = t("Delete Step", "Delete Step");
    deleteButton.addEventListener("click", () => handleDelete(step.id));

    container.appendChild(editButton);
    container.appendChild(deleteButton);
    return container;
  }

  function renderTable(careerSteps) {
    if (!tableBody) {
      return;
    }
    tableBody.innerHTML = "";

    const fragment = document.createDocumentFragment();
    let hasSteps = false;

    careerSteps.forEach(({ career, steps }) => {
      const headerRow = document.createElement("tr");
      headerRow.className = "table-secondary";
      const headerCell = document.createElement("td");
      headerCell.colSpan = 7;
      headerCell.textContent = `${career.name || t("Career", "Career")} (#${career.id})`;
      headerRow.appendChild(headerCell);
      fragment.appendChild(headerRow);

      if (!steps.length) {
        const emptyRow = document.createElement("tr");
        const emptyCell = document.createElement("td");
        emptyCell.colSpan = 7;
        emptyCell.className = "text-center text-muted";
        emptyCell.textContent = t("No steps available", "No steps available");
        emptyRow.appendChild(emptyCell);
        fragment.appendChild(emptyRow);
        return;
      }

      hasSteps = true;

      steps.forEach((step) => {
        const row = document.createElement("tr");
        const imageCell = step.image_url
          ? `<a href="${escapeHtml(step.image_url)}" target="_blank" rel="noopener noreferrer">${t("View", "View")}</a>`
          : "";
        const challengeLabel =
          step.challenge_id !== null && step.challenge_id !== undefined
            ? `${escapeHtml(
                (challengeMap.get(step.challenge_id) || {}).name || String(step.challenge_id)
              )} (#${escapeHtml(String(step.challenge_id))})`
            : "";

        row.innerHTML = `
          <td>${escapeHtml(step.name)}</td>
          <td>${escapeHtml(career.name)}</td>
          <td>${escapeHtml(step.category)}</td>
          <td>${challengeLabel}</td>
          <td>${escapeHtml(String(step.required_solves ?? 0))}</td>
          <td>${imageCell}</td>
          <td></td>
        `;

        const actionsCell = row.querySelector("td:last-child");
        actionsCell.appendChild(createActionButtons(step, career, row));

        fragment.appendChild(row);
      });
    });

    if (!hasSteps && careerSteps.length === 0) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.colSpan = 7;
      emptyCell.className = "text-center text-muted";
      emptyCell.textContent = t("No steps available", "No steps available");
      emptyRow.appendChild(emptyCell);
      fragment.appendChild(emptyRow);
    }

    tableBody.appendChild(fragment);
  }

  async function loadSteps() {
    closeEditForm();
    displayMessage("info", t("Loading", "Loading"));

    try {
      if (!challengeOptions.length) {
        await loadChallenges();
      }
      const careerPayload = await apiRequest(`/career`);
      const careers = (careerPayload && careerPayload.careers) || [];

      const stepsData = await Promise.all(
        careers.map(async (career) => {
          const steps = await apiRequest(`/career/steps/${career.id}`);
          return { career, steps };
        })
      );

      renderTable(stepsData);
      displayMessage("success", t("Steps refreshed", "Steps refreshed"));
    } catch (error) {
      displayMessage("danger", error.message || t("Unexpected error", "Unexpected error"));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!tableBody) {
      return;
    }

    (async () => {
      try {
        await loadChallenges();
        await loadSteps();
      } catch (error) {
        // Error already surfaced via displayMessage in loaders
        if (error instanceof Error && error.message) {
          console.error(error);
        }
      }
    })();
  });
})();
