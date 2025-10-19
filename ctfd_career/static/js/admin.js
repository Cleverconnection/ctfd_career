(function () {
  const translations = window.CTFDCareerTranslations || {};
  const careerList = document.getElementById("career-admin-list");
  const careerForm = document.getElementById("career-form");
  const stepForm = document.getElementById("step-form");
  const careerSelect = document.getElementById("step-career-id");
  const syncButton = document.getElementById("career-sync-button");
  const summaryContainer = document.getElementById("career-summary");
  const careerIdInput = document.getElementById("career-id");
  const careerCancelButton = document.getElementById("career-cancel");
  const careerSubmitButton = careerForm
    ? careerForm.querySelector("button[type='submit']")
    : null;

  let careersCache = [];
  let editingCareerId = null;

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

  function resetCareerForm() {
    if (!careerForm) {
      return;
    }

    careerForm.reset();
    editingCareerId = null;

    if (careerIdInput) {
      careerIdInput.value = "";
    }

    if (careerSubmitButton) {
      careerSubmitButton.textContent = t("Add Career");
    }

    if (careerCancelButton) {
      careerCancelButton.classList.add("d-none");
    }
  }

  function populateCareerForm(career) {
    if (!careerForm) {
      return;
    }

    editingCareerId = Number(career.id);

    if (careerIdInput) {
      careerIdInput.value = career.id;
    }

    const nameInput = careerForm.querySelector("#career-name");
    const descriptionInput = careerForm.querySelector("#career-description");
    const iconInput = careerForm.querySelector("#career-icon");
    const colorInput = careerForm.querySelector("#career-color");

    if (nameInput) {
      nameInput.value = career.name || "";
    }
    if (descriptionInput) {
      descriptionInput.value = career.description || "";
    }
    if (iconInput) {
      iconInput.value = career.icon || "";
    }
    if (colorInput) {
      colorInput.value = career.color || "";
    }

    if (careerSubmitButton) {
      careerSubmitButton.textContent = t("Update Career");
    }

    if (careerCancelButton) {
      careerCancelButton.classList.remove("d-none");
    }

    careerForm.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderCareers(careers) {
    careersCache = Array.isArray(careers) ? careers : [];

    if (careerList) {
      careerList.innerHTML = "";
    }

    const selectedCareerId = careerSelect ? careerSelect.value : "";

    if (careerSelect) {
      careerSelect.innerHTML = "";
    }

    if (!careersCache.length) {
      if (careerSelect) {
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = t("No careers available yet");
        placeholder.disabled = true;
        placeholder.selected = true;
        careerSelect.appendChild(placeholder);
      }

      if (careerList) {
        const empty = document.createElement("div");
        empty.className = "alert alert-info";
        empty.textContent = t("No careers available yet");
        careerList.appendChild(empty);
      }

      return;
    }

    careersCache.forEach((career) => {
      if (careerSelect) {
        const option = document.createElement("option");
        option.value = career.id;
        option.textContent = career.name;
        if (String(career.id) === selectedCareerId) {
          option.selected = true;
        }
        careerSelect.appendChild(option);
      }

      if (careerList) {
        const item = document.createElement("div");
        item.className = "card mb-3";

        const header = document.createElement("div");
        header.className = "card-header d-flex justify-content-between align-items-center";
        header.innerHTML = `
          <span class="fw-semibold">${career.name}</span>
          <div class="btn-group btn-group-sm" role="group">
            <button type="button" class="btn btn-primary" data-action="edit" data-id="${career.id}">${t(
              "Edit"
            )}</button>
            <button type="button" class="btn btn-danger" data-action="delete" data-id="${career.id}">${t(
              "Delete"
            )}</button>
          </div>
        `;

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
      }
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
    resetCareerForm();

    if (careerCancelButton) {
      careerCancelButton.addEventListener("click", (event) => {
        event.preventDefault();
        resetCareerForm();
      });
    }

    careerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(careerForm);
      const payload = Object.fromEntries(formData.entries());
      const isEditing = Boolean(editingCareerId);
      delete payload.id;

      const url = isEditing
        ? `/plugins/career/api/v1/career/${editingCareerId}`
        : "/plugins/career/api/v1/career";
      const method = isEditing ? "PUT" : "POST";

      fetch(url, {
        method,
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
          resetCareerForm();
          loadCareers();
          loadSummary();
          notify(isEditing ? t("Career updated") : t("Career created"));
        })
        .catch((error) => notify(error.message, "danger"));
    });
  }

  if (careerList) {
    careerList.addEventListener("click", (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const { action, id } = target.dataset;

      if (!action || !id) {
        return;
      }

      if (action === "edit") {
        const career = careersCache.find((entry) => String(entry.id) === id);
        if (career) {
          populateCareerForm(career);
        }
        return;
      }

      if (action === "delete") {
        if (!window.confirm(t("Are you sure you want to delete this career?"))) {
          return;
        }

        const numericId = Number(id);

        fetch(`/plugins/career/api/v1/career/${id}`, {
          method: "DELETE",
          credentials: "include",
        })
          .then((response) => {
            if (!response.ok) {
              return response.json().then((data) => {
                throw new Error(
                  data.message || "Unable to delete career"
                );
              });
            }
            return response.json();
          })
          .then(() => {
            if (editingCareerId === numericId) {
              resetCareerForm();
            }
            loadCareers();
            loadSummary();
            notify(t("Career deleted"));
          })
          .catch((error) => notify(error.message, "danger"));
      }
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
