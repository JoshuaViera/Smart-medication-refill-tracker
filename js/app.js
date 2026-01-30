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

// P1: Success feedback toast (PRD – ease of use for elderly)
function showToast(message) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 2800);
}

// Load medications from Supabase (no errors when Supabase is not configured)
async function loadMedications() {
  if (!window.supabase || typeof window.supabase.from !== 'function') {
    medications = [];
    if (medList) {
      medList.innerHTML = `<p class="hint">Supabase is not configured. Add your project URL and anon key in <code>js/config.js</code>, then create the medications table (see <code>supabase-schema.sql</code>).</p>`;
    }
    render();
    return;
  }
  try {
    const { data, error } = await window.supabase
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
      lastTaken: med.last_taken,
      imageUrl: med.image_url || null
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
    const { error } = await window.supabase
      .from('medications')
      .update({ last_taken: new Date().toISOString() })
      .eq('id', medicationId);
    
    if (error) throw error;
    await loadMedications();
    showToast("Recorded");
  } catch (error) {
    console.error('Error updating medication:', error);
  }
}

// Helper function to update stock
async function updateStock(medicationId, newStock) {
    const { error } = await window.supabase
      .from('medications')
      .update({ stock: newStock })
    .eq('id', medicationId);

  if (error) throw error;
  await loadMedications();
  showToast("Stock updated");
}

// Helper function to update medication (edit)
async function updateMedication(medicationId, data) {
  try {
    const updateData = {
      name: data.name,
      dosage: data.dosage,
      schedule: data.schedule,
      stock: data.stock,
      refill_threshold: data.refill_threshold,
      expires_on: data.expires_on
    };
    if (data.image_url !== undefined) updateData.image_url = data.image_url || null;
    const { error } = await window.supabase
      .from('medications')
      .update(updateData)
      .eq('id', medicationId);

    if (error) throw error;
    await loadMedications();
    showToast("Saved");
  } catch (error) {
    console.error('Error updating medication:', error);
    throw error;
  }
}

// Helper function to delete medication
async function deleteMedication(medicationId) {
  try {
    const { error } = await window.supabase
      .from('medications')
      .delete()
      .eq('id', medicationId);

    if (error) throw error;
    await loadMedications();
    showToast("Medication removed");
  } catch (error) {
    console.error('Error deleting medication:', error);
    throw error;
  }
}

// PRD: Customized Accessibility – high-visibility (large print + oversized buttons), persisted
const HIGH_VISIBILITY_KEY = "highVisibility";
const toggleHighVisibilityBtn = document.getElementById("toggleHighVisibility");
const highVisibilityLabelEl = document.getElementById("highVisibilityLabel");

function getHighVisibility() {
  const stored = localStorage.getItem(HIGH_VISIBILITY_KEY);
  return stored === null ? true : stored === "true";
}

function setHighVisibility(on) {
  localStorage.setItem(HIGH_VISIBILITY_KEY, on ? "true" : "false");
  document.body.classList.toggle("high-visibility", on);
  if (highVisibilityLabelEl) highVisibilityLabelEl.textContent = on ? "Compact view" : "Large text & buttons";
}

function updateHighVisibilityLabel() {
  const on = document.body.classList.contains("high-visibility");
  if (highVisibilityLabelEl) highVisibilityLabelEl.textContent = on ? "Compact view" : "Large text & buttons";
}

if (toggleHighVisibilityBtn) {
  toggleHighVisibilityBtn.addEventListener("click", () => {
    const on = !document.body.classList.contains("high-visibility");
    setHighVisibility(on);
  });
}
setHighVisibility(getHighVisibility());

const addMedModal = document.getElementById("addMedModal");
const addMedForm = document.getElementById("addMedForm");
const closeAddMedBtn = document.getElementById("closeAddMed");
const cancelAddMedBtn = document.getElementById("cancelAddMed");
const addMedTitleEl = document.getElementById("addMedTitle");
const addMedBarcodeSection = document.getElementById("addMedBarcodeSection");

let editingMedId = null;

function openAddMedModal() {
  editingMedId = null;
  if (addMedTitleEl) addMedTitleEl.textContent = "Add Medication";
  if (addMedBarcodeSection) addMedBarcodeSection.style.display = "";
  addMedModal.classList.add("is-open");
  addMedModal.setAttribute("aria-hidden", "false");
  document.getElementById("barcodeHint").textContent = "";
  document.getElementById("medBarcode").value = "";
  addMedForm.reset();
  document.getElementById("medStock").value = "30";
  document.getElementById("medRefillThreshold").value = "7";
  document.getElementById("medName").focus();
}

function openEditMedModal(med) {
  editingMedId = med.id;
  if (addMedTitleEl) addMedTitleEl.textContent = "Edit Medication";
  if (addMedBarcodeSection) addMedBarcodeSection.style.display = "none";
  document.getElementById("medName").value = med.name;
  document.getElementById("medDosage").value = med.dosage || "";
  document.getElementById("medSchedule").value = Array.isArray(med.schedule) ? med.schedule.join(", ") : "";
  document.getElementById("medStock").value = med.stock;
  document.getElementById("medRefillThreshold").value = med.refillThreshold;
  document.getElementById("medExpiresOn").value = med.expiresOn ? med.expiresOn.slice(0, 10) : "";
  const imageUrlEl = document.getElementById("medImageUrl");
  if (imageUrlEl) imageUrlEl.value = med.imageUrl || "";
  addMedModal.classList.add("is-open");
  addMedModal.setAttribute("aria-hidden", "false");
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
  editingMedId = null;
  if (addMedTitleEl) addMedTitleEl.textContent = "Add Medication";
  if (addMedBarcodeSection) addMedBarcodeSection.style.display = "";
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

// Update stock modal
const updateStockModalEl = document.getElementById("updateStockModal");
const updateStockInputEl = document.getElementById("updateStockInput");
const closeUpdateStockBtn = document.getElementById("closeUpdateStock");
const cancelUpdateStockBtn = document.getElementById("cancelUpdateStock");
const saveUpdateStockBtn = document.getElementById("saveUpdateStock");

let updateStockMedId = null;

function openUpdateStockModal(med) {
  updateStockMedId = med.id;
  if (updateStockInputEl) {
    updateStockInputEl.value = med.stock;
    updateStockInputEl.min = "0";
  }
  if (updateStockModalEl) {
    updateStockModalEl.classList.add("is-open");
    updateStockModalEl.setAttribute("aria-hidden", "false");
    if (updateStockInputEl) updateStockInputEl.focus();
  }
}

function closeUpdateStockModal() {
  updateStockMedId = null;
  if (updateStockModalEl) {
    updateStockModalEl.classList.remove("is-open");
    updateStockModalEl.setAttribute("aria-hidden", "true");
  }
}

if (saveUpdateStockBtn && updateStockInputEl) {
  saveUpdateStockBtn.addEventListener("click", async () => {
    const value = parseInt(updateStockInputEl.value, 10);
    if (isNaN(value) || value < 0) {
      alert("Please enter a valid number (0 or more).");
      return;
    }
    if (!updateStockMedId) return;
    saveUpdateStockBtn.disabled = true;
    saveUpdateStockBtn.textContent = "Saving…";
    try {
      await updateStock(updateStockMedId, value);
      closeUpdateStockModal();
    } catch (err) {
      console.error("Error updating stock:", err);
      alert("Could not update stock. Check the console or your Supabase setup.");
    }
    saveUpdateStockBtn.disabled = false;
    saveUpdateStockBtn.textContent = "Save";
  });
}

if (closeUpdateStockBtn) closeUpdateStockBtn.addEventListener("click", closeUpdateStockModal);
if (cancelUpdateStockBtn) cancelUpdateStockBtn.addEventListener("click", closeUpdateStockModal);
if (updateStockModalEl) {
  updateStockModalEl.addEventListener("click", (e) => {
    if (e.target === updateStockModalEl) closeUpdateStockModal();
  });
}

addMedModal.addEventListener("click", (e) => {
  if (e.target === addMedModal) {
    stopScanCamera();
    closeAddMedModal();
  }
});

// PRD: Caregiver visibility – support for those managing remote care
const caregiverModalEl = document.getElementById("caregiverModal");
const closeCaregiverModalBtn = document.getElementById("closeCaregiverModal");
const openCaregiverInfoBtn = document.getElementById("openCaregiverInfo");
const copyCaregiverSummaryBtn = document.getElementById("copyCaregiverSummary");
const caregiverCopyHintEl = document.getElementById("caregiverCopyHint");

function openCaregiverModal() {
  if (caregiverModalEl) {
    caregiverModalEl.classList.add("is-open");
    caregiverModalEl.setAttribute("aria-hidden", "false");
  }
}

function closeCaregiverModal() {
  if (caregiverModalEl) {
    caregiverModalEl.classList.remove("is-open");
    caregiverModalEl.setAttribute("aria-hidden", "true");
  }
  if (caregiverCopyHintEl) caregiverCopyHintEl.textContent = "";
}

function buildCaregiverSummary() {
  const now = new Date();
  const dateStr = now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const sorted = medications
    .map((med) => ({ med, nextDose: getNextDoseDate(med, now) }))
    .sort((a, b) => a.nextDose - b.nextDose);
  const next = sorted[0];
  const pendingCount = medications.filter((m) => getDoseStatus(m, now).level === "yellow").length;
  const lowCount = medications.filter((m) => m.stock <= m.refillThreshold).length;
  const expiringCount = medications.filter((m) => {
    const days = Math.ceil((new Date(m.expiresOn) - now) / 86400000);
    return days <= 30 && days >= 0;
  }).length;

  let text = `Medication status – ${dateStr}\n\n`;
  text += next
    ? `Next dose: ${next.med.name} at ${formatTime(next.nextDose)}\n`
    : "Next dose: None scheduled\n";
  text += `Pending (due now): ${pendingCount}\n`;
  text += `Low stock: ${lowCount}\n`;
  text += `Expiring within 30 days: ${expiringCount}\n\n`;
  text += "Medications:\n";
  medications.forEach((m) => {
    const status = getDoseStatus(m, now);
    const nextDose = getNextDoseDate(m, now);
    text += `- ${m.name} (${m.dosage}): ${status.label}, next ${formatTime(nextDose)}, stock ${m.stock}, expires ${formatDate(new Date(m.expiresOn))}\n`;
  });
  return text;
}

// PRD VI: Success metrics – collect feedback
const feedbackModalEl = document.getElementById("feedbackModal");
const closeFeedbackModalBtn = document.getElementById("closeFeedbackModal");
const openFeedbackBtn = document.getElementById("openFeedback");
const feedbackTextEl = document.getElementById("feedbackText");
const cancelFeedbackBtn = document.getElementById("cancelFeedback");
const feedbackHintEl = document.getElementById("feedbackHint");

function openFeedbackModal() {
  if (feedbackModalEl) {
    feedbackModalEl.classList.add("is-open");
    feedbackModalEl.setAttribute("aria-hidden", "false");
    if (feedbackTextEl) feedbackTextEl.value = "";
    if (feedbackHintEl) feedbackHintEl.textContent = "";
  }
}

function closeFeedbackModal() {
  if (feedbackModalEl) {
    feedbackModalEl.classList.remove("is-open");
    feedbackModalEl.setAttribute("aria-hidden", "true");
  }
}

if (openFeedbackBtn) openFeedbackBtn.addEventListener("click", openFeedbackModal);
if (closeFeedbackModalBtn) closeFeedbackModalBtn.addEventListener("click", closeFeedbackModal);
if (cancelFeedbackBtn) cancelFeedbackBtn.addEventListener("click", closeFeedbackModal);
if (feedbackModalEl) {
  feedbackModalEl.addEventListener("click", (e) => {
    if (e.target === feedbackModalEl) closeFeedbackModal();
  });
}
const copyFeedbackBtnEl = document.getElementById("copyFeedback");
if (copyFeedbackBtnEl) {
  copyFeedbackBtnEl.addEventListener("click", async () => {
    const message = feedbackTextEl ? feedbackTextEl.value.trim() : "";
    const date = new Date().toISOString().slice(0, 10);
    const text = `Smart Medication & Refill Tracker – Feedback (${date})\n\n${message || "(No message)"}`;
    try {
      await navigator.clipboard.writeText(text);
      if (feedbackHintEl) feedbackHintEl.textContent = "Copied. Paste into an email or survey to send.";
    } catch (err) {
      if (feedbackHintEl) feedbackHintEl.textContent = "Could not copy. You can copy the text manually.";
    }
  });
}

if (openCaregiverInfoBtn) openCaregiverInfoBtn.addEventListener("click", openCaregiverModal);
if (closeCaregiverModalBtn) closeCaregiverModalBtn.addEventListener("click", closeCaregiverModal);
if (caregiverModalEl) {
  caregiverModalEl.addEventListener("click", (e) => {
    if (e.target === caregiverModalEl) closeCaregiverModal();
  });
}
if (copyCaregiverSummaryBtn) {
  copyCaregiverSummaryBtn.addEventListener("click", async () => {
    const text = buildCaregiverSummary();
    try {
      await navigator.clipboard.writeText(text);
      if (caregiverCopyHintEl) caregiverCopyHintEl.textContent = "Copied to clipboard.";
    } catch (err) {
      if (caregiverCopyHintEl) caregiverCopyHintEl.textContent = "Could not copy. Select and copy manually.";
    }
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (scanOverlay.classList.contains("is-open")) stopScanCamera();
    else if (updateStockModalEl && updateStockModalEl.classList.contains("is-open")) closeUpdateStockModal();
    else if (feedbackModalEl && feedbackModalEl.classList.contains("is-open")) closeFeedbackModal();
    else if (caregiverModalEl && caregiverModalEl.classList.contains("is-open")) closeCaregiverModal();
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

  // Check if Supabase is configured and client is valid
  if (!window.supabase || typeof window.supabase.from !== "function") {
    alert(
      "Supabase is not configured.\n\n1. Open js/config.js\n2. Set SUPABASE_URL and SUPABASE_ANON_KEY from your Supabase project (Project Settings → API).\n3. Create the medications table in Supabase (see supabase-schema.sql in the project)."
    );
    return;
  }

  const imageUrl = document.getElementById("medImageUrl").value.trim() || null;
  const payload = {
    name,
    dosage,
    schedule,
    stock,
    refill_threshold: refillThreshold,
    expires_on: expiresOn,
    image_url: imageUrl
  };

  try {
    if (editingMedId) {
      await updateMedication(editingMedId, payload);
      closeAddMedModal();
    } else {
      const insertData = { ...payload, last_taken: null };
      if (insertData.image_url === null) delete insertData.image_url;
      const { error } = await window.supabase.from("medications").insert(insertData);
      if (error) throw error;
      closeAddMedModal();
      await loadMedications();
      showToast("Medication added");
    }
  } catch (err) {
    console.error(editingMedId ? "Error updating medication:" : "Error adding medication:", err);
    const msg = err?.message || String(err);
    const hint =
      msg.includes("relation") && msg.includes("does not exist")
        ? "The medications table doesn't exist. Run the SQL in supabase-schema.sql in your Supabase SQL editor."
        : msg.includes("row-level security") || msg.includes("policy")
          ? "Supabase is blocking the operation. Add an RLS policy (see supabase-schema.sql)."
          : msg;
    alert(editingMedId ? "Could not update medication.\n\n" + hint : "Could not add medication.\n\n" + hint);
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
    if (medications.length === 0) {
      medList.innerHTML = `
        <div class="empty-state" aria-live="polite">
          <p class="empty-state-title">No medications yet</p>
          <p class="empty-state-hint">Add your first medication to start tracking doses and refills.</p>
          <button type="button" class="btn btn-primary empty-state-cta" data-empty-state-add>Add your first medication</button>
        </div>`;
    } else {
      medList.innerHTML = `<p class="hint">No medications match this filter.</p>`;
    }
    return;
  }

  medList.innerHTML = filtered
    .map((med) => {
      const status = getDoseStatus(med, now);
      const nextDose = getNextDoseDate(med, now);
      const imgHtml = med.imageUrl
        ? `<img class="med-card-img" src="${String(med.imageUrl).replace(/"/g, "&quot;")}" alt="" loading="lazy" onerror="this.remove()" />`
        : "";
      return `
        <article class="med-card">
          <div class="med-card-main">
            ${imgHtml}
            <div>
            <p class="med-title">${med.name} · ${med.dosage}</p>
            <div class="med-meta">
              <span>Next dose: ${formatTime(nextDose)}</span>
              <span>Stock: ${med.stock} left</span>
              <span>Expires: ${formatDate(new Date(med.expiresOn))}</span>
            </div>
            <div class="med-card-actions">
              <button type="button" class="btn btn-small btn-primary" data-mark-taken data-med-id="${med.id}">Mark as taken</button>
              <div class="med-card-more">
                <button type="button" class="btn btn-small btn-secondary" data-more-menu aria-haspopup="true" aria-expanded="false">More</button>
                <div class="med-card-dropdown" role="menu" hidden>
                  <button type="button" class="med-card-dropdown-item" role="menuitem" data-edit-med data-med-id="${med.id}">Edit</button>
                  <button type="button" class="med-card-dropdown-item" role="menuitem" data-update-stock data-med-id="${med.id}">Update stock</button>
                  <button type="button" class="med-card-dropdown-item med-card-dropdown-item--danger" role="menuitem" data-delete-med data-med-id="${med.id}">Delete</button>
                </div>
              </div>
            </div>
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

// P2: Close all "More" dropdowns
function closeAllMedCardDropdowns() {
  document.querySelectorAll(".med-card-more.is-open").forEach((el) => {
    el.classList.remove("is-open");
    const dd = el.querySelector(".med-card-dropdown");
    if (dd) dd.hidden = true;
  });
  document.querySelectorAll("[data-more-menu][aria-expanded='true']").forEach((btn) => btn.setAttribute("aria-expanded", "false"));
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".med-card-more")) closeAllMedCardDropdowns();
});

// Event delegation: empty state CTA
medList.addEventListener("click", (e) => {
  if (e.target.closest("[data-empty-state-add]")) {
    openAddMedModal();
    return;
  }
});

// Event delegation: handle Mark as taken, More menu, Edit, Update stock, Delete
medList.addEventListener("click", async (e) => {
  const moreBtn = e.target.closest("[data-more-menu]");
  if (moreBtn) {
    e.stopPropagation();
    const moreEl = moreBtn.closest(".med-card-more");
    const isOpen = moreEl && moreEl.classList.contains("is-open");
    closeAllMedCardDropdowns();
    if (!isOpen && moreEl) {
      moreEl.classList.add("is-open");
      const dd = moreEl.querySelector(".med-card-dropdown");
      if (dd) dd.hidden = false;
      moreBtn.setAttribute("aria-expanded", "true");
    }
    return;
  }
  const markBtn = e.target.closest("[data-mark-taken]");
  if (markBtn) {
    const id = markBtn.dataset.medId;
    if (!id) return;
    markBtn.disabled = true;
    markBtn.textContent = "Recording…";
    await updateLastTaken(id);
    markBtn.disabled = false;
    markBtn.textContent = "Mark as taken";
    return;
  }
  const editBtn = e.target.closest("[data-edit-med]");
  if (editBtn) {
    closeAllMedCardDropdowns();
    const id = editBtn.dataset.medId;
    if (!id) return;
    const med = medications.find((m) => String(m.id) === String(id));
    if (med) openEditMedModal(med);
    return;
  }
  const updateStockBtn = e.target.closest("[data-update-stock]");
  if (updateStockBtn) {
    closeAllMedCardDropdowns();
    const id = updateStockBtn.dataset.medId;
    if (!id) return;
    const med = medications.find((m) => String(m.id) === String(id));
    if (med) openUpdateStockModal(med);
    return;
  }
  const deleteBtn = e.target.closest("[data-delete-med]");
  if (deleteBtn) {
    closeAllMedCardDropdowns();
    const id = deleteBtn.dataset.medId;
    if (!id) return;
    const med = medications.find((m) => String(m.id) === String(id));
    const name = med ? med.name : "this medication";
    if (!confirm(`Remove "${name}" from your list? This cannot be undone.`)) return;
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Removing…";
    try {
      await deleteMedication(id);
    } catch (err) {
      alert("Could not delete medication. Check the console or your Supabase setup.");
      deleteBtn.disabled = false;
      deleteBtn.textContent = "Delete";
    }
  }
});

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
  updateReminderBanner(now);
}

// --- Intelligent reminders ---
const reminderBanner = document.getElementById("reminderBanner");
const enableRemindersBtn = document.getElementById("enableReminders");

// PRD: Intelligent Reminders — alerts to take medication; warnings when Rx is about to run out or expire.
// Color-coded: GREEN = no pending, YELLOW = pending (within current time window), RED = missed / run out / expire.
function getReminderState(now) {
  const dueNow = medications.filter((med) => {
    const status = getDoseStatus(med, now);
    return status.level === "yellow";
  });
  const missedNow = medications.filter((med) => {
    const status = getDoseStatus(med, now);
    return status.label === "Missed Dose";
  });
  const lowOrExpiring = medications.filter((med) => {
    const isLow = med.stock <= med.refillThreshold;
    const expiresOn = new Date(med.expiresOn);
    const daysToExpire = Math.ceil((expiresOn - now) / 86400000);
    return isLow || (daysToExpire <= 30 && daysToExpire >= 0);
  });
  return { dueNow, missedNow, lowOrExpiring, lowOrExpiringCount: lowOrExpiring.length };
}

let reminderBannerDismissed = false;

function applyFilterAndShowMedications(filter) {
  filters.forEach((chip) => chip.classList.remove("is-active"));
  const chip = document.querySelector(`[data-filter="${filter}"]`);
  if (chip) chip.classList.add("is-active");
  render(filter);
  const panel = document.querySelector(".panel");
  if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateReminderBanner(now) {
  if (!reminderBanner) return;
  if (reminderBannerDismissed) {
    reminderBanner.classList.remove("is-visible", "reminder-due", "reminder-warning", "reminder-missed");
    reminderBanner.setAttribute("aria-hidden", "true");
    reminderBanner.innerHTML = "";
    return;
  }
  const { dueNow, missedNow, lowOrExpiringCount } = getReminderState(now);
  const hasDue = dueNow.length > 0;
  const hasMissed = missedNow.length > 0;
  const hasRunOutOrExpire = lowOrExpiringCount > 0;

  if (!hasDue && !hasMissed && !hasRunOutOrExpire) {
    reminderBanner.classList.remove("is-visible", "reminder-due", "reminder-warning", "reminder-missed");
    reminderBanner.setAttribute("aria-hidden", "true");
    reminderBanner.innerHTML = "";
    return;
  }

  reminderBanner.classList.add("is-visible");
  reminderBanner.setAttribute("aria-hidden", "false");

  const dueNames = dueNow.map((m) => m.name).join(", ");
  const missedNames = missedNow.map((m) => m.name).join(", ");

  // PRD: Alerts users to take medication; warnings when an Rx is about to run out or expire.
  const parts = [];
  if (hasMissed) {
    parts.push(`<span class="reminder-block"><strong>You missed a dose</strong> — ${missedNames}. Take as soon as possible. <button type="button" class="reminder-link" data-show-filter="missed">Show</button></span>`);
  }
  if (hasDue) {
    parts.push(`<span class="reminder-block"><strong>Time to take your medication</strong> — ${dueNames} (within current time window). <button type="button" class="reminder-link" data-show-filter="pending">Show</button></span>`);
  }
  if (hasRunOutOrExpire) {
    parts.push(`<span class="reminder-block"><strong>An Rx is about to run out or expire</strong> — ${lowOrExpiringCount} medication(s). <button type="button" class="reminder-link" data-show-filter="low">Show low stock</button> <button type="button" class="reminder-link" data-show-filter="expiring">Show expiring</button></span>`);
  }

  reminderBanner.className = "reminder-banner is-visible " + (hasMissed ? "reminder-missed" : hasDue ? "reminder-due" : "reminder-warning");
  reminderBanner.innerHTML = `
    <div class="reminder-banner-content">
      ${parts.join(" ")}
    </div>
    <div class="reminder-banner-actions">
      <button type="button" class="reminder-banner-dismiss" data-dismiss-reminder>Dismiss</button>
    </div>
  `;
}

if (reminderBanner) {
  reminderBanner.addEventListener("click", (e) => {
    if (e.target.closest("[data-dismiss-reminder]")) {
      reminderBannerDismissed = true;
      updateReminderBanner(new Date());
      return;
    }
    const showBtn = e.target.closest("[data-show-filter]");
    if (showBtn) {
      const filter = showBtn.dataset.showFilter;
      applyFilterAndShowMedications(filter);
    }
  });
}

// Browser notifications: throttle so we don't spam (same med within 30 min)
const lastNotifiedDoseAt = {};
const DOSE_NOTIFY_COOLDOWN_MS = 30 * 60 * 1000;

function maybeShowDoseNotifications(now) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const { dueNow } = getReminderState(now);
  dueNow.forEach((med) => {
    const key = `${med.id}-${now.getDate()}-${now.getHours()}`;
    const last = lastNotifiedDoseAt[key];
    if (last && now - last < DOSE_NOTIFY_COOLDOWN_MS) return;
    try {
      new Notification("Time to take your medication", {
        body: med.name + (med.dosage ? " · " + med.dosage : ""),
        icon: "/favicon.ico"
      });
      lastNotifiedDoseAt[key] = now.getTime();
    } catch (e) {
      console.warn("Notification failed:", e);
    }
  });
}

// PRD: Warnings when an Rx is about to run out or expire.
function maybeShowLowExpiringNotification(now) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const key = "lowExpiringNotified";
  if (sessionStorage.getItem(key)) return;
  const { lowOrExpiringCount } = getReminderState(now);
  if (lowOrExpiringCount === 0) return;
  try {
    new Notification("An Rx is about to run out or expire", {
      body: `${lowOrExpiringCount} medication(s) need attention. Refill or check expiry dates.`,
      icon: "/favicon.ico"
    });
    sessionStorage.setItem(key, "1");
  } catch (e) {
    console.warn("Notification failed:", e);
  }
}

// PRD: Alerts users to take medication (including missed doses).
function maybeShowMissedNotification(now) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const key = "missedNotified";
  if (sessionStorage.getItem(key)) return;
  const { missedNow } = getReminderState(now);
  if (missedNow.length === 0) return;
  const names = missedNow.map((m) => m.name).join(", ");
  try {
    new Notification("You missed a dose", {
      body: `${names}. Take as soon as possible.`,
      icon: "/favicon.ico"
    });
    sessionStorage.setItem(key, "1");
  } catch (e) {
    console.warn("Notification failed:", e);
  }
}

let reminderIntervalId = null;

function startReminderLoop() {
  if (reminderIntervalId) return;
  const run = () => {
    const now = new Date();
    maybeShowDoseNotifications(now);
    maybeShowMissedNotification(now);
    maybeShowLowExpiringNotification(now);
  };
  run();
  reminderIntervalId = setInterval(run, 60 * 1000);
}

function updateEnableRemindersButton() {
  if (!enableRemindersBtn) return;
  if (!("Notification" in window)) {
    enableRemindersBtn.style.display = "none";
    return;
  }
  if (Notification.permission === "granted") {
    enableRemindersBtn.textContent = "Reminders on";
    enableRemindersBtn.disabled = true;
    startReminderLoop();
    return;
  }
  enableRemindersBtn.textContent = "Enable reminders";
  enableRemindersBtn.disabled = false;
}

if (enableRemindersBtn) {
  enableRemindersBtn.addEventListener("click", async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      startReminderLoop();
      updateEnableRemindersButton();
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        startReminderLoop();
        updateEnableRemindersButton();
      } else {
        alert("Reminders are blocked. You can still see in-app reminders when doses are due.");
      }
    } catch (e) {
      console.error("Notification permission error:", e);
    }
  });
}

// Initialize app by loading medications from Supabase
loadMedications();

// Start reminder loop if permission was already granted (e.g. previous visit)
updateEnableRemindersButton();