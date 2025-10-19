(function () {
  const translations = window.CTFDCareerTranslations || {};
  const careerList = document.getElementById("career-admin-list");
  const careerForm = document.getElementById("career-form");
  const stepForm = document.getElementById("step-form");
  const careerSelect = document.getElementById("step-career-id");
  const syncButton = document.getElementById("career-sync-button");
  const summaryContainer = document.getElementById("career-summary");

  function t(key) {
    return translations[key] || key;
  }

  function notify(message, variant = "success") {
    const alert = document.createElement("div");
    alert.className = `alert alert-${variant}`;
    alert.textContent = message;
    if (summaryContainer) {
      summaryContainer.prepend(alert);
    } else {
      document.body.prepend(alert);
    }
    setTimeout(() => alert.remove(), 4000);
  }

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
      header.className = "card-header d-flex justify-content-between align-items-center";
      header.innerHTML = `<span class="fw-semibold">${career.name}</span>`;

      const body = document.createElement("div");
      body.className = "card-body";
      body.innerHTML = `
        <p class="mb-1"><strong>${t("Description")}:</strong> ${
          career.description || "-"
        }</p>
        <p class="mb-0"><strong>${t("Steps")}:</strong> ${career.total_steps}</p>
      `;

      item.appendChild(header);
      item.appendChild(body);
      careerList.appendChild(item);
    });
  }

  function loadCareers() {
    fetch("/plugins/career/api/v1/career", {
      credentials: "include",
    })
      .then((response) => response.json())
      .then((payload) => {
        if (!payload.success) {
          throw new Error(payload.message || "Unable to load careers");
        }
        const data = payload.data.careers || [];
        renderCareers(data);
      })
      .catch((error) => {
        notify(error.message, "danger");
      });
  }

  function loadSummary() {
    fetch("/plugins/career/api/v1/career/summary", {
      credentials: "include",
    })
      .then((response) => response.json())
      .then((payload) => {
        if (!payload.success) {
          throw new Error(payload.message || "Unable to load summary");
        }
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
      })
      .catch((error) => {
        notify(error.message, "danger");
      });
  }

  if (careerForm) {
    careerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(careerForm);
      const payload = Object.fromEntries(formData.entries());

      fetch("/plugins/career/api/v1/career", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
        .then((response) => {
          if (!response.ok) {
            return response.json().then((data) => {
              throw new Error(data.message || "Unable to create career");
            });
          }
          return response.json();
        })
        .then(() => {
          careerForm.reset();
          loadCareers();
          loadSummary();
          notify(t("Career created"));
        })
        .catch((error) => notify(error.message, "danger"));
    });
  }

  if (stepForm) {
    stepForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(stepForm);
      const payload = Object.fromEntries(formData.entries());
      payload.required_solves = Number(payload.required_solves || 1);

      fetch("/plugins/career/api/v1/career/steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
        .then((response) => {
          if (!response.ok) {
            return response.json().then((data) => {
              throw new Error(data.message || "Unable to create step");
            });
          }
          return response.json();
        })
        .then(() => {
          stepForm.reset();
          loadCareers();
          loadSummary();
          notify(t("Step created"));
        })
        .catch((error) => notify(error.message, "danger"));
    });
  }

  if (syncButton) {
    syncButton.addEventListener("click", () => {
      syncButton.disabled = true;
      fetch("/plugins/career/api/v1/career/sync", {
        method: "PUT",
        credentials: "include",
      })
        .then((response) => {
          if (!response.ok) {
            return response.json().then((data) => {
              throw new Error(data.message || "Unable to sync progress");
            });
          }
          return response.json();
        })
        .then(() => {
          loadSummary();
          notify(t("Progress recalculated"));
        })
        .catch((error) => notify(error.message, "danger"))
        .finally(() => {
          syncButton.disabled = false;
        });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadCareers();
    loadSummary();
  });
})();
