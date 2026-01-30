// Initialize empty medications array - will be loaded from Supabase
let medications = [];

const filters = document.querySelectorAll("[data-filter]");
const medList = document.getElementById("medList");
const reminders = document.getElementById("reminders");

const nextDoseValue = document.getElementById("nextDoseValue");
const nextDoseHint = document.getElementById("nextDoseHint");
const pendingDoseValue = document.getElementById("pendingDoseValue");
const lowInventoryValue = document.getElementById("lowInventoryValue");
const expiringValue = document.getElementById("expiringValue");

// Load medications from Supabase
async function loadMedications() {
  try {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .order('id');
    
    if (error) throw error;
    
    // Transform database format to match existing code
    medications = data.map(med => ({
      id: med.id,
      name: med.name,
      dosage: med.dosage,
      schedule: med.schedule, // Already an array from JSONB
      stock: med.stock,
      refillThreshold: med.refill_threshold,
      expiresOn: med.expires_on,
      lastTaken: med.last_taken
    }));
    
    render();
  } catch (error) {
    console.error('Error loading medications:', error);
    medList.innerHTML = `<p class="hint">Error loading medications. Please refresh.</p>`;
  }
}

// Helper function to update last taken timestamp
async function updateLastTaken(medicationId) {
  try {
    const { error } = await supabase
      .from('medications')
      .update({ last_taken: new Date().toISOString() })
      .eq('id', medicationId);
    
    if (error) throw error;
    await loadMedications(); // Reload data
  } catch (error) {
    console.error('Error updating medication:', error);
  }
}

// Helper function to update stock
async function updateStock(medicationId, newStock) {
  try {
    const { error } = await supabase
      .from('medications')
      .update({ stock: newStock })
      .eq('id', medicationId);
    
    if (error) throw error;
    await loadMedications(); // Reload data
  } catch (error) {
    console.error('Error updating stock:', error);
  }
}

document.getElementById("toggleText").addEventListener("click", () => {
  document.body.classList.toggle("large-text");
});

const addMedModal = document.getElementById("addMedModal");
const addMedForm = document.getElementById("addMedForm");
const closeAddMedBtn = document.getElementById("closeAddMed");
const cancelAddMedBtn = document.getElementById("cancelAddMed");

function openAddMedModal() {
  addMedModal.classList.add("is-open");
  addMedModal.setAttribute("aria-hidden", "false");
  document.getElementById("barcodeHint").textContent = "";
  document.getElementById("medBarcode").value = "";
  document.getElementById("medName").focus();
}

// Normalize barcode for NDC search (digits only, then try 5-4-2 format)
function normalizeNDC(value) {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}`;
  if (digits.length === 11) return `${digits.slice(0, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}`;
  return value.replace(/\s/g, "").trim();
}

async function lookupNDC(barcode) {
  const hintEl = document.getElementById("barcodeHint");
  hintEl.textContent = "Looking up…";
  hintEl.style.color = "var(--muted)";

  const normalized = normalizeNDC(barcode);
  const searchTerms = [normalized];
  const digitsOnly = (barcode || "").replace(/\D/g, "");
  if (digitsOnly.length >= 10) {
    const d = digitsOnly.slice(0, 11);
    if (d.length === 10) searchTerms.push(`${d.slice(0, 5)}-${d.slice(5, 9)}-${d.slice(9)}`);
    else if (d.length === 11) searchTerms.push(`${d.slice(0, 5)}-${d.slice(5, 9)}-${d.slice(9)}`);
  }

  for (const term of searchTerms) {
    try {
      const res = await fetch(
        `https://api.fda.gov/drug/ndc.json?search=product_ndc:"${encodeURIComponent(term)}"&limit=1`
      );
      const data = await res.json();
      if (data.error) continue;
      const result = data.results && data.results[0];
      if (!result) continue;

      const name = result.brand_name || result.generic_name || result.openfda?.brand_name?.[0] || "Unknown";
      const dosageForm = result.dosage_form || result.openfda?.dosage_form?.[0] || "";
      document.getElementById("medName").value = name;
      document.getElementById("medDosage").value = dosageForm ? `${dosageForm}` : document.getElementById("medDosage").value || "";
      hintEl.textContent = "Medication found. Complete the rest and save.";
      hintEl.style.color = "var(--green)";
      document.getElementById("medName").focus();
      return;
    } catch (e) {
      console.warn("NDC lookup failed for", term, e);
    }
  }

  hintEl.textContent = "No medication found for this barcode. Enter details manually.";
  hintEl.style.color = "var(--muted)";
}

function closeAddMedModal() {
  stopScanCamera();
  addMedModal.classList.remove("is-open");
  addMedModal.setAttribute("aria-hidden", "true");
  addMedForm.reset();
}

document.getElementById("addMedication").addEventListener("click", openAddMedModal);

const medBarcodeInput = document.getElementById("medBarcode");
const barcodeLookupBtn = document.getElementById("barcodeLookup");
const scanWithCameraBtn = document.getElementById("scanWithCamera");
const scanOverlay = document.getElementById("scanOverlay");
const scanVideo = document.getElementById("scanVideo");
const scanStatus = document.getElementById("scanStatus");
const cancelScanBtn = document.getElementById("cancelScan");

barcodeLookupBtn.addEventListener("click", () => {
  const v = medBarcodeInput.value.trim();
  if (v) lookupNDC(v);
});

medBarcodeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const v = medBarcodeInput.value.trim();
    if (v) lookupNDC(v);
  }
});

let scanStream = null;
let scanAnimationId = null;

function stopScanCamera() {
  if (scanStream) {
    scanStream.getTracks().forEach((t) => t.stop());
    scanStream = null;
  }
  if (scanAnimationId) cancelAnimationFrame(scanAnimationId);
  scanOverlay.classList.remove("is-open");
  scanOverlay.setAttribute("aria-hidden", "true");
  scanVideo.srcObject = null;
}

async function startCameraScan() {
  if (!("BarcodeDetector" in window)) {
    document.getElementById("barcodeHint").textContent =
      "Camera scanning isn't available in this browser. Click in the box above and use a handheld scanner, or type the barcode and click Look up.";
    document.getElementById("barcodeHint").style.color = "var(--muted)";
    medBarcodeInput.focus();
    return;
  }

  scanOverlay.classList.add("is-open");
  scanOverlay.setAttribute("aria-hidden", "false");
  scanStatus.textContent = "Starting camera…";

  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    scanVideo.srcObject = scanStream;
    scanVideo.onloadedmetadata = () => scanVideo.play();
  } catch (err) {
    scanStatus.textContent = "Camera access denied or unavailable.";
    console.error(err);
    stopScanCamera();
    return;
  }

  const barcodeDetector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "codabar"] });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  scanStatus.textContent = "Point at the barcode on the medicine container…";

  function detectFrame() {
    if (!scanStream || !scanVideo.videoWidth) {
      scanAnimationId = requestAnimationFrame(detectFrame);
      return;
    }
    canvas.width = scanVideo.videoWidth;
    canvas.height = scanVideo.videoHeight;
    ctx.drawImage(scanVideo, 0, 0);
    barcodeDetector
      .detect(canvas)
      .then((codes) => {
        if (codes.length > 0 && codes[0].rawValue) {
          const raw = codes[0].rawValue;
          stopScanCamera();
          medBarcodeInput.value = raw;
          lookupNDC(raw);
        }
      })
      .catch(() => {});
    scanAnimationId = requestAnimationFrame(detectFrame);
  }
  detectFrame();
}

scanWithCameraBtn.addEventListener("click", startCameraScan);
cancelScanBtn.addEventListener("click", stopScanCamera);

closeAddMedBtn.addEventListener("click", closeAddMedModal);
cancelAddMedBtn.addEventListener("click", closeAddMedModal);

addMedModal.addEventListener("click", (e) => {
  if (e.target === addMedModal) {
    stopScanCamera();
    closeAddMedModal();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (scanOverlay.classList.contains("is-open")) stopScanCamera();
    else if (addMedModal.classList.contains("is-open")) closeAddMedModal();
  }
});

addMedForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("medName").value.trim();
  const dosage = document.getElementById("medDosage").value.trim();
  const scheduleInput = document.getElementById("medSchedule").value.trim();
  const stock = parseInt(document.getElementById("medStock").value, 10);
  const refillThreshold = parseInt(document.getElementById("medRefillThreshold").value, 10);
  const expiresOn = document.getElementById("medExpiresOn").value;

  const schedule = scheduleInput
    .split(",")
    .map((t) => t.trim())
    .filter((t) => /^\d{1,2}:\d{2}$/.test(t));

  if (!schedule.length) {
    alert("Please enter at least one valid dose time (e.g. 08:00 or 8:00).");
    return;
  }

  try {
    const { error } = await supabase.from("medications").insert({
      name,
      dosage,
      schedule,
      stock,
      refill_threshold: refillThreshold,
      expires_on: expiresOn,
      last_taken: null
    });

    if (error) throw error;
    closeAddMedModal();
    await loadMedications();
  } catch (err) {
    console.error("Error adding medication:", err);
    alert("Could not add medication. Check the console or your Supabase setup.");
  }
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

// Initialize app by loading medications from Supabase
loadMedications();