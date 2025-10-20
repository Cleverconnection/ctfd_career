(function () {
  const translations = window.CTFDCareerTranslations || {};
  const root = document.getElementById("career-root");

  function t(key) {
    return translations[key] || key;
  }

  function buildStepList(steps) {
    const list = document.createElement("ul");
    list.className = "list-group list-group-flush";

    steps.forEach((step) => {
      const item = document.createElement("li");
      item.className = "list-group-item d-flex align-items-center justify-content-between";

      const info = document.createElement("div");
      info.className = "d-flex align-items-center gap-2";

      const statusIcon = document.createElement("span");
      statusIcon.setAttribute("aria-hidden", "true");
      statusIcon.textContent = step.completed ? "✅" : "🔒";
      info.appendChild(statusIcon);

      if (step.image_url) {
        const preview = document.createElement("img");
        preview.src = step.image_url;
        preview.alt = `${step.name} illustration`;
        preview.className = "career-step-image rounded";
        info.appendChild(preview);
      }

      const textWrapper = document.createElement("div");
      const title = document.createElement("div");
      title.className = "fw-semibold";
      title.textContent = step.name;
      textWrapper.appendChild(title);

      if (step.description) {
        const description = document.createElement("div");
        description.className = "text-muted small";
        description.textContent = step.description;
        textWrapper.appendChild(description);
      }

      info.appendChild(textWrapper);

      const badge = document.createElement("span");
      badge.className = `badge ${step.completed ? "bg-success" : "bg-secondary"}`;
      badge.textContent = step.completed ? t("Completed") : t("In Progress");

      item.appendChild(info);
      item.appendChild(badge);
      list.appendChild(item);
    });

    return list;
  }

  function renderCareer(career) {
    const card = document.createElement("div");
    card.className = "card shadow-sm mb-4 career-card";
    if (career.color) {
      card.style.borderTop = `4px solid ${career.color}`;
    }

    const header = document.createElement("div");
    header.className = "card-header bg-white d-flex align-items-center gap-3 position-relative";

    if (career.icon) {
      const icon = document.createElement("img");
      icon.src = career.icon;
      icon.alt = `${career.name} icon`;
      icon.className = "career-icon";
      header.appendChild(icon);
    }

    const headerText = document.createElement("div");
    const title = document.createElement("h5");
    title.className = "mb-0";
    const titleLink = document.createElement("a");
    titleLink.href = `/plugins/career/${career.id}`;
    titleLink.textContent = career.name;
    titleLink.className = "stretched-link text-decoration-none";
    title.appendChild(titleLink);
    headerText.appendChild(title);

    if (career.description) {
      const description = document.createElement("p");
      description.className = "mb-0 text-muted";
      description.textContent = career.description;
      headerText.appendChild(description);
    }

    header.appendChild(headerText);

    const progress = document.createElement("div");
    progress.className = "progress career-progress";
    const progressBar = document.createElement("div");
    const percent = career.total_steps
      ? Math.round((career.completed_steps / career.total_steps) * 100)
      : 0;
    progressBar.className = "progress-bar";
    progressBar.style.width = `${percent}%`;
    progressBar.setAttribute("aria-valuenow", percent);
    progressBar.setAttribute("aria-valuemax", 100);
    progressBar.setAttribute("aria-valuemin", 0);
    progressBar.textContent = `${percent}% ${t("Progress")}`;
    progress.appendChild(progressBar);

    const body = document.createElement("div");
    body.className = "card-body";
    body.appendChild(progress);
    body.appendChild(buildStepList(career.steps));

    card.appendChild(header);
    card.appendChild(body);
    return card;
  }

  function renderCareers(careers) {
    root.innerHTML = "";

    if (!careers.length) {
      const empty = document.createElement("div");
      empty.className = "alert alert-info";
      empty.textContent = t("No careers available yet");
      root.appendChild(empty);
      return;
    }

    careers.forEach((career) => {
      root.appendChild(renderCareer(career));
    });
  }

  function fetchCareers() {
    fetch("/plugins/career/api/v1/career", {
      credentials: "include",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load career data");
        }
        return response.json();
      })
      .then((payload) => {
        if (!payload.success) {
          throw new Error(payload.message || "Failed to load career data");
        }
        renderCareers(payload.data.careers || []);
      })
      .catch((error) => {
        console.error(error);
        root.innerHTML = "";
        const alert = document.createElement("div");
        alert.className = "alert alert-danger";
        alert.textContent = error.message;
        root.appendChild(alert);
      });
  }

  if (root) {
    document.addEventListener("DOMContentLoaded", fetchCareers);
  }
})();
