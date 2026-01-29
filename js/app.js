const medications = [
  {
    id: 1,
    name: "Atorvastatin",
    dosage: "20mg",
    schedule: ["08:00"],
    stock: 12,
    refillThreshold: 10,
    expiresOn: "2026-02-15",
    lastTaken: "2026-01-27T08:15:00",
  },
  {
    id: 2,
    name: "Metformin",
    dosage: "500mg",
    schedule: ["08:00", "20:00"],
    stock: 4,
    refillThreshold: 8,
    expiresOn: "2026-03-20",
    lastTaken: "2026-01-27T20:00:00",
  },
  {
    id: 3,
    name: "Lisinopril",
    dosage: "10mg",
    schedule: ["09:00"],
    stock: 22,
    refillThreshold: 7,
    expiresOn: "2026-01-30",
    lastTaken: "2026-01-27T09:05:00",
  },
];

const filters = document.querySelectorAll("[data-filter]");
const medList = document.getElementById("medList");
const reminders = document.getElementById("reminders");

const nextDoseValue = document.getElementById("nextDoseValue");
const nextDoseHint = document.getElementById("nextDoseHint");
const pendingDoseValue = document.getElementById("pendingDoseValue");
const lowInventoryValue = document.getElementById("lowInventoryValue");
const expiringValue = document.getElementById("expiringValue");

document.getElementById("toggleText").addEventListener("click", () => {
  document.body.classList.toggle("large-text");
});

document.getElementById("addMedication").addEventListener("click", () => {
  alert("This is a placeholder for the add flow.");
});

filters.forEach((chip) => {
  chip.addEventListener("click", () => {
    filters.forEach((item) => item.classList.remove("is-active"));
    chip.classList.add("is-active");
    render(chip.dataset.filter);
  });
});

function formatTime(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(date) {
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function getDoseStatus(med, now) {
  const expiresOn = new Date(med.expiresOn);
  const daysToExpire = Math.ceil((expiresOn - now) / 86400000);
  const isExpiring = daysToExpire <= 30;
  const isLow = med.stock <= med.refillThreshold;

  const nextDose = getNextDoseDate(med, now);
  const diffHours = (nextDose - now) / 3600000;
  const isPending = diffHours <= 2 && diffHours >= 0;
  const isMissed = diffHours < -2;

  if (daysToExpire < 0) {
    return { level: "red", label: "Expired" };
  }
  if (isMissed || isLow || isExpiring) {
    return {
      level: "red",
      label: isMissed ? "Missed Dose" : isLow ? "Low Stock" : "Expiring Soon",
    };
  }
  if (isPending) {
    return { level: "yellow", label: "Due Now" };
  }
  return { level: "green", label: "On Track" };
}

function getNextDoseDate(med, now) {
  const today = new Date(now);
  const [nextTime] = med.schedule;
  const [hours, minutes] = nextTime.split(":").map(Number);
  const nextDose = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    hours,
    minutes
  );

  if (nextDose < now && med.schedule.length > 1) {
    const remaining = med.schedule
      .slice(1)
      .map((time) => {
        const [h, m] = time.split(":").map(Number);
        return new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          h,
          m
        );
      })
      .find((dose) => dose >= now);
    return remaining || nextDose;
  }

  if (nextDose < now && med.schedule.length === 1) {
    nextDose.setDate(nextDose.getDate() + 1);
  }

  return nextDose;
}

function renderDashboard(now) {
  const sorted = medications
    .map((med) => ({ med, nextDose: getNextDoseDate(med, now) }))
    .sort((a, b) => a.nextDose - b.nextDose);
  const next = sorted[0];

  nextDoseValue.textContent = next
    ? formatTime(next.nextDose)
    : "No doses";
  nextDoseHint.textContent = next
    ? `${next.med.name} · ${formatDate(next.nextDose)}`
    : "Add medications to begin";

  const pendingCount = medications.filter((med) => {
    const status = getDoseStatus(med, now);
    return status.level === "yellow";
  }).length;
  pendingDoseValue.textContent = pendingCount;

  const lowCount = medications.filter((med) => med.stock <= med.refillThreshold)
    .length;
  lowInventoryValue.textContent = lowCount;

  const expiringCount = medications.filter((med) => {
    const expiresOn = new Date(med.expiresOn);
    return Math.ceil((expiresOn - now) / 86400000) <= 30;
  }).length;
  expiringValue.textContent = expiringCount;
}

function renderMedications(filter, now) {
  const filtered = medications.filter((med) => {
    const status = getDoseStatus(med, now);
    if (filter === "pending") return status.level === "yellow";
    if (filter === "missed") return status.label === "Missed Dose";
    if (filter === "low") return status.label === "Low Stock";
    if (filter === "expiring") return status.label === "Expiring Soon";
    return true;
  });

  if (!filtered.length) {
    medList.innerHTML = `<p class="hint">No medications match this filter.</p>`;
    return;
  }

  medList.innerHTML = filtered
    .map((med) => {
      const status = getDoseStatus(med, now);
      const nextDose = getNextDoseDate(med, now);
      return `
        <article class="med-card">
          <div>
            <p class="med-title">${med.name} · ${med.dosage}</p>
            <div class="med-meta">
              <span>Next dose: ${formatTime(nextDose)}</span>
              <span>Stock: ${med.stock} left</span>
              <span>Expires: ${formatDate(new Date(med.expiresOn))}</span>
            </div>
          </div>
          <span class="status-pill status-${status.level}">
            ${status.label}
          </span>
        </article>
      `;
    })
    .join("");
}

function renderReminders(now) {
  const upcoming = medications.flatMap((med) =>
    med.schedule.map((time) => {
      const [hours, minutes] = time.split(":").map(Number);
      const next = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hours,
        minutes
      );
      if (next < now) next.setDate(next.getDate() + 1);
      return { med, at: next };
    })
  );

  const sorted = upcoming
    .filter((item) => item.at - now <= 24 * 3600000)
    .sort((a, b) => a.at - b.at);

  reminders.innerHTML = sorted
    .map(
      (item) => `
      <div class="reminder-card">
        <div>
          <strong>${item.med.name}</strong>
          <p class="hint">${item.med.dosage}</p>
        </div>
        <div>
          <strong>${formatTime(item.at)}</strong>
          <p class="hint">${formatDate(item.at)}</p>
        </div>
      </div>
    `
    )
    .join("");
}

function render(filter = "all") {
  const now = new Date();
  renderDashboard(now);
  renderMedications(filter, now);
  renderReminders(now);
}

render();
