import { db, ref, onValue } from "./firebase.js";
import { set } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// DOM Node Selectors
const adminLoginOverlay = document.getElementById("adminLoginOverlay");
const adminPasswordInput = document.getElementById("adminPasswordInput");
const adminSubmitLoginBtn = document.getElementById("adminSubmitLoginBtn");
const adminDashboardContent = document.getElementById("adminDashboardContent");

const liveStatusBadge = document.getElementById("liveStatusBadge");
const masterStatusToggleBtn = document.getElementById("masterStatusToggleBtn");

let currentSystemStatus = "open";

// --- 1. SECURE PASSCODE INTERCEPT ENGINE ---
adminSubmitLoginBtn.addEventListener("click", evaluatePasscode);
adminPasswordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") evaluatePasscode();
});

function evaluatePasscode() {
    const enteredValue = adminPasswordInput.value;

    if (enteredValue === "saransh270912") {
        // Authenticated! Dismiss security curtains and lift operational panel view
        adminLoginOverlay.style.display = "none";
        adminDashboardContent.style.display = "block";
        initializeDashboardSync(); // Fire up real-time Firebase syncing links
    } else {
        alert("❌ Invalid administrative credentials. Access denied.");
        adminPasswordInput.value = "";
        adminPasswordInput.focus();
    }
}

// --- 2. FIREBASE DASHBOARD SYNC REGISTRY ---
function initializeDashboardSync() {
    // Read the master setup node switch state dynamically
    onValue(ref(db, "settings/status"), (snapshot) => {
        const status = snapshot.val() || "open";
        currentSystemStatus = status;

        if (status === "closed") {
            liveStatusBadge.textContent = "OFFLINE (CLOSED)";
            liveStatusBadge.style.color = "#dc3545";
            masterStatusToggleBtn.textContent = "Open Election";
            masterStatusToggleBtn.className = "toggle-status-btn";
        } else {
            liveStatusBadge.textContent = "ONLINE (OPEN)";
            liveStatusBadge.style.color = "#28a745";
            masterStatusToggleBtn.textContent = "Close Election";
            masterStatusToggleBtn.className = "toggle-status-btn closed";
        }
    });
}

// --- 3. MASTER STATUS MUTATION DISPATCHER ---
masterStatusToggleBtn.addEventListener("click", async () => {
    // Invert your state tracks safely
    const targetStatus = currentSystemStatus === "open" ? "closed" : "open";
    
    masterStatusToggleBtn.disabled = true;
    masterStatusToggleBtn.textContent = "Processing Change...";

    try {
        // Write the brand-new status gate configuration block out to Firebase database
        await set(ref(db, "settings/status"), targetStatus);
    } catch (err) {
        console.error("Database mutation failure:", err);
        alert("Failed to update status. Please check your network connection.");
    } finally {
        masterStatusToggleBtn.disabled = false;
    }
});
