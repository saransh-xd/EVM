import { db, ref, onValue } from "./firebase.js";
import { set, remove, push } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// DOM Node Selectors
const adminLoginOverlay = document.getElementById("adminLoginOverlay");
const adminPasswordInput = document.getElementById("adminPasswordInput");
const adminSubmitLoginBtn = document.getElementById("adminSubmitLoginBtn");
const adminDashboardContent = document.getElementById("adminDashboardContent");

const liveStatusBadge = document.getElementById("liveStatusBadge");
const masterStatusToggleBtn = document.getElementById("masterStatusToggleBtn");

// Tab Switching Components
const tabDashboardBtn = document.getElementById("tabDashboardBtn");
const tabSetupBtn = document.getElementById("tabSetupBtn");
const panelDashboard = document.getElementById("panelDashboard");
const panelSetup = document.getElementById("panelSetup");

// Management Setup Inputs
const newRoleTitle = document.getElementById("newRoleTitle");
const candidateAName = document.getElementById("candidateAName");
const candidateBName = document.getElementById("candidateBName");
const createRoleBtn = document.getElementById("createRoleBtn");
const adminLiveRolesContainer = document.getElementById("adminLiveRolesContainer");

// Live Results Targets
const liveDashboardChartsGrid = document.getElementById("liveDashboardChartsGrid");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");

let currentSystemStatus = "open";

// --- 1. SECURE PASSCODE INTERCEPT ENGINE ---
adminSubmitLoginBtn.addEventListener("click", evaluatePasscode);
adminPasswordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") evaluatePasscode();
});

function evaluatePasscode() {
    if (adminPasswordInput.value === "saransh270912") {
        adminLoginOverlay.style.display = "none";
        adminDashboardContent.style.display = "block";
        initializeDashboardSync();
    } else {
        alert("❌ Invalid administrative credentials. Access denied.");
        adminPasswordInput.value = "";
        adminPasswordInput.focus();
    }
}

// --- 2. MULTI-TAB INTERACTION CONTROLLER ---
tabDashboardBtn.addEventListener("click", () => {
    tabDashboardBtn.classList.add("active");
    tabSetupBtn.classList.remove("active");
    panelDashboard.style.display = "block";
    panelSetup.style.display = "none";
});

tabSetupBtn.addEventListener("click", () => {
    tabSetupBtn.classList.add("active");
    tabDashboardBtn.classList.remove("active");
    panelSetup.style.display = "block";
    panelDashboard.style.display = "none";
});

// --- 3. FIREBASE UNIFIED SYNCHRONIZATION (LIVE CONFIG + CHARTS) ---
function initializeDashboardSync() {
    // Monitor Online/Offline Gate Status
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

    // Monitor Database Streams to build Setup Panels & Live Charts
    onValue(ref(db), (snapshot) => {
        const rootData = snapshot.val() || {};
        const configData = rootData.election_config || {};
        const voteData = rootData.election || {};

        // Reset display targets
        adminLiveRolesContainer.innerHTML = "";
        liveDashboardChartsGrid.innerHTML = "";

        const keys = Object.keys(configData);

        if (keys.length === 0) {
            const emptyMsg = `<p style="text-align: center; color: #777; padding: 20px; grid-column: 1/-1;">The ballot is empty. Add elements inside the Ballot Setup tab.</p>`;
            adminLiveRolesContainer.innerHTML = emptyMsg;
            liveDashboardChartsGrid.innerHTML = emptyMsg;
            return;
        }

        keys.forEach(key => {
            const role = configData[key];
            const tallyA = (voteData[key] && voteData[key].candidateA) ? voteData[key].candidateA : 0;
            const tallyB = (voteData[key] && voteData[key].candidateB) ? voteData[key].candidateB : 0;
            const totalVotes = tallyA + tallyB;

            // Compute percentage splits safely
            const pctA = totalVotes > 0 ? ((tallyA / totalVotes) * 100).toFixed(0) : 0;
            const pctB = totalVotes > 0 ? ((tallyB / totalVotes) * 100).toFixed(0) : 0;

            // Build View A: Live Performance Charts & Bars
            liveDashboardChartsGrid.innerHTML += `
                <div class="result-card">
                    <h3 style="color: #1a237e; margin-top: 0; font-size: 16px;">${role.title}</h3>
                    <p style="font-size: 12px; color: #666; margin-bottom: 12px;">Total Votes Placed: <strong>${totalVotes}</strong></p>
                    
                    <div style="font-size: 14px; color: #333;">
                        <div style="display:flex; justify-content:space-between;"><span>👤 ${role.candidateA}</span> <strong>${tallyA} (${pctA}%)</strong></div>
                        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${pctA}%; background: #1a237e;"></div></div>
                        
                        <div style="display:flex; justify-content:space-between; margin-top: 5px;"><span>👤 ${role.candidateB}</span> <strong>${tallyB} (${pctB}%)</strong></div>
                        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${pctB}%; background: #28a745;"></div></div>
                    </div>
                </div>
            `;

            // Build View B: Management List Blocks
            adminLiveRolesContainer.innerHTML += `
                <div class="role-list-item">
                    <div>
                        <strong style="font-size: 15px; color: #1a237e;">${role.title}</strong>
                        <div style="font-size: 13px; color: #666; margin-top: 2px;">${role.candidateA} vs ${role.candidateB}</div>
                    </div>
                    <button class="delete-btn" data-key="${key}">Remove</button>
                </div>
            `;
        });
    });
}

// --- 4. MASTER STATUS CONTROLLER ACTION ---
masterStatusToggleBtn.addEventListener("click", async () => {
    const targetStatus = currentSystemStatus === "open" ? "closed" : "open";
    masterStatusToggleBtn.disabled = true;
    try {
        await set(ref(db, "settings/status"), targetStatus);
    } catch (err) {
        console.error(err);
    } finally {
        masterStatusToggleBtn.disabled = false;
    }
});

// --- 5. NEW ROLE GENERATOR ---
createRoleBtn.addEventListener("click", async () => {
    const title = newRoleTitle.value.trim();
    const candA = candidateAName.value.trim();
    const candB = candidateBName.value.trim();

    if (!title || !candA || !candB) {
        alert("Please complete all configuration fields.");
        return;
    }

    createRoleBtn.disabled = true;
    try {
        const newPositionRef = push(ref(db, "election_config"));
        await set(newPositionRef, { title, candidateA: candA, candidateB: candB });
        await set(ref(db, `election/${newPositionRef.key}`), { candidateA: 0, candidateB: 0 });

        newRoleTitle.value = "";
        candidateAName.value = "";
        candidateBName.value = "";
        alert("🎉 New ballot element posted successfully!");
    } catch (err) {
        console.error(err);
    } finally {
        createRoleBtn.disabled = false;
    }
});

// --- 6. ROLE REMOVAL ACTION ---
adminLiveRolesContainer.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("delete-btn")) return;
    const targetKey = e.target.getAttribute("data-key");
    if (!confirm("Are you sure you want to completely erase this role?")) return;

    try {
        await remove(ref(db, `election_config/${targetKey}`));
        await remove(ref(db, `election/${targetKey}`));
    } catch (err) {
        console.error(err);
    }
});

// --- 7. 📄 HIGH-FIDELITY PDF EXPORT COMPILER ---
downloadPdfBtn.addEventListener("click", () => {
    const reportElement = document.getElementById("pdfExportWrapper");
    
    // Configure compilation attributes for html2pdf
    const outputOptions = {
        margin:       15,
        filename:     'Official_Election_Results_Report.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    downloadPdfBtn.textContent = "Compiling PDF...";
    downloadPdfBtn.disabled = true;

    html2pdf().set(outputOptions).from(reportElement).save()
    .then(() => {
        downloadPdfBtn.textContent = "📄 Export PDF Report";
        downloadPdfBtn.disabled = false;
    })
    .catch((error) => {
        console.error("PDF engine crash summary:", error);
        alert("An error occurred while compiling your document.");
        downloadPdfBtn.textContent = "📄 Export PDF Report";
        downloadPdfBtn.disabled = false;
    });
});
