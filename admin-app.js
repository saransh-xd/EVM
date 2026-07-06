import { db, ref, onValue } from "./firebase.js";
import { set, remove, push, update } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

const adminLoginOverlay = document.getElementById("adminLoginOverlay");
const adminPasswordInput = document.getElementById("adminPasswordInput");
const adminSubmitLoginBtn = document.getElementById("adminSubmitLoginBtn");
const adminDashboardContent = document.getElementById("adminDashboardContent");

const liveStatusBadge = document.getElementById("liveStatusBadge");
const masterStatusToggleBtn = document.getElementById("masterStatusToggleBtn");

const tabDashboardBtn = document.getElementById("tabDashboardBtn");
const tabSetupBtn = document.getElementById("tabSetupBtn");
const panelDashboard = document.getElementById("panelDashboard");
const panelSetup = document.getElementById("panelSetup");

const newRoleTitle = document.getElementById("newRoleTitle");
const newRoleSequence = document.getElementById("newRoleSequence");
const candidate1Name = document.getElementById("candidate1Name");
const candidate2Name = document.getElementById("candidate2Name");
const candidate3Name = document.getElementById("candidate3Name");
const candidate4Name = document.getElementById("candidate4Name");
const createRoleBtn = document.getElementById("createRoleBtn");
const adminLiveRolesContainer = document.getElementById("adminLiveRolesContainer");

const liveDashboardChartsGrid = document.getElementById("liveDashboardChartsGrid");
const globalVoteCastCounter = document.getElementById("globalVoteCastCounter");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const resetAllVotesBtn = document.getElementById("resetAllVotesBtn");

let currentSystemStatus = "open";

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
        alert("❌ Invalid credentials.");
        adminPasswordInput.value = "";
    }
}

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

function initializeDashboardSync() {
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

    onValue(ref(db), (snapshot) => {
        const rootData = snapshot.val() || {};
        const configData = rootData.election_config || {};
        const voteData = rootData.election || {};

        adminLiveRolesContainer.innerHTML = "";
        liveDashboardChartsGrid.innerHTML = "";

        let structuredRoles = Object.keys(configData).map(key => {
            return {
                key: key,
                ...configData[key],
                sequence: parseInt(configData[key].sequence || 1)
            };
        });

        structuredRoles.sort((a, b) => a.sequence - b.sequence);
        let absoluteGlobalTurnout = 0;

        if (structuredRoles.length === 0) {
            const emptyMsg = `<p style="text-align: center; color: #777; padding: 20px; grid-column: 1/-1;">The ballot is empty.</p>`;
            adminLiveRolesContainer.innerHTML = emptyMsg;
            liveDashboardChartsGrid.innerHTML = emptyMsg;
            globalVoteCastCounter.textContent = "0";
            return;
        }

        const chartColors = ["#1a237e", "#28a745", "#fd7e14", "#6f42c1"];

        structuredRoles.forEach(role => {
            const key = role.key;
            let candidatesArray = [];
            if (role.candidate1) candidatesArray.push({ index: 1, name: role.candidate1 });
            if (role.candidate2) candidatesArray.push({ index: 2, name: role.candidate2 });
            if (role.candidate3) candidatesArray.push({ index: 3, name: role.candidate3 });
            if (role.candidate4) candidatesArray.push({ index: 4, name: role.candidate4 });

            let totalVotes = 0;
            let roleVotesData = voteData[key] || {};
            
            candidatesArray.forEach(cand => {
                const tally = roleVotesData[`c${cand.index}`] || 0;
                totalVotes += tally;
                cand.tally = tally;
            });

            absoluteGlobalTurnout += totalVotes;

            let chartRowsHtml = "";
            candidatesArray.forEach((cand, i) => {
                const pct = totalVotes > 0 ? ((cand.tally / totalVotes) * 100).toFixed(0) : 0;
                const activeColor = chartColors[i % chartColors.length];
                chartRowsHtml += `
                    <div style="display:flex; justify-content:space-between; margin-top: 4px;"><span>👤 ${cand.name}</span> <strong>${cand.tally} (${pct}%)</strong></div>
                    <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${pct}%; background: ${activeColor};"></div></div>
                `;
            });

            liveDashboardChartsGrid.innerHTML += `
                <div class="result-card" style="background:#fafbfc; border:1px solid #eef0f5; padding:15px; border-radius:10px; page-break-inside:avoid;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="color: #1a237e; margin: 0; font-size: 16px;">${role.title}</h3>
                        <span style="background: #e1e5f2; color: #1a237e; font-size: 11px; padding: 2px 8px; font-weight: bold; border-radius: 10px;">Order: ${role.sequence}</span>
                    </div>
                    <p style="font-size: 12px; color: #666; margin: 5px 0 12px 0;">Total Votes Placed: <strong>${totalVotes}</strong></p>
                    <div style="font-size: 14px; color: #333;">
                        ${chartRowsHtml}
                    </div>
                </div>
            `;

            let inlineInputsHtml = "";
            candidatesArray.forEach(cand => {
                inlineInputsHtml += `
                    <input type="text" class="inline-edit-input" id="input${cand.index}-${key}" value="${cand.name}">
                `;
            });

            adminLiveRolesContainer.innerHTML += `
                <div class="role-list-item">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                            <span style="font-size: 12px; font-weight: bold; color: #666;">Order:</span>
                            <input type="number" class="inline-order-input" id="order-${key}" value="${role.sequence}" min="1">
                            <strong style="font-size: 16px; color: #1a237e;">${role.title}</strong>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            ${inlineInputsHtml}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-left: 15px;">
                        <button class="save-inline-btn" data-key="${key}">💾 Save Changes</button>
                        <button class="delete-btn" data-key="${key}">🗑️ Remove Role</button>
                    </div>
                </div>
            `;
        });

        globalVoteCastCounter.textContent = absoluteGlobalTurnout.toString();
    });
}

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

createRoleBtn.addEventListener("click", async () => {
    const title = newRoleTitle.value.trim();
    const c1 = candidate1Name.value.trim();
    const c2 = candidate2Name.value.trim();
    const c3 = candidate3Name.value.trim();
    const c4 = candidate4Name.value.trim();
    const sequenceValue = parseInt(newRoleSequence.value) || 1;

    if (!title || !c1 || !c2) {
        alert("Please specify the title and at least two candidates.");
        return;
    }

    createRoleBtn.disabled = true;
    try {
        const newPositionRef = push(ref(db, "election_config"));
        let configPayload = { title, candidate1: c1, candidate2: c2, sequence: sequenceValue };
        let votePayload = { c1: 0, c2: 0 };

        if (c3) { configPayload.candidate3 = c3; votePayload.c3 = 0; }
        if (c4) { configPayload.candidate4 = c4; votePayload.c4 = 0; }

        await set(newPositionRef, configPayload);
        await set(ref(db, `election/${newPositionRef.key}`), votePayload);

        newRoleTitle.value = "";
        candidate1Name.value = "";
        candidate2Name.value = "";
        candidate3Name.value = "";
        candidate4Name.value = "";
        newRoleSequence.value = "1";
    } catch (err) {
        console.error(err);
    } finally {
        createRoleBtn.disabled = false;
    }
});

adminLiveRolesContainer.addEventListener("click", async (e) => {
    if (e.target.classList.contains("save-inline-btn")) {
        const targetKey = e.target.getAttribute("data-key");
        const val1 = document.getElementById(`input1-${targetKey}`) ? document.getElementById(`input1-${targetKey}`).value.trim() : "";
        const val2 = document.getElementById(`input2-${targetKey}`) ? document.getElementById(`input2-${targetKey}`).value.trim() : "";
        const val3 = document.getElementById(`input3-${targetKey}`) ? document.getElementById(`input3-${targetKey}`).value.trim() : "";
        const val4 = document.getElementById(`input4-${targetKey}`) ? document.getElementById(`input4-${targetKey}`).value.trim() : "";
        const valSeq = parseInt(document.getElementById(`order-${targetKey}`).value) || 1;

        if (!val1 || !val2) {
            alert("Primary candidates 1 and 2 cannot be blank.");
            return;
        }

        e.target.disabled = true;
        try {
            let updatePayload = { candidate1: val1, candidate2: val2, sequence: valSeq };
            if (document.getElementById(`input3-${targetKey}`)) updatePayload.candidate3 = val3;
            if (document.getElementById(`input4-${targetKey}`)) updatePayload.candidate4 = val4;

            await update(ref(db, `election_config/${targetKey}`), updatePayload);
            alert("Saved successfully!");
        } catch (err) {
            console.error(err);
        } finally {
            e.target.disabled = false;
        }
    }

    if (e.target.classList.contains("delete-btn")) {
        const targetKey = e.target.getAttribute("data-key");
        if (!confirm("Are you sure?")) return;
        try {
            await remove(ref(db, `election_config/${targetKey}`));
            await remove(ref(db, `election/${targetKey}`));
        } catch (err) {
            console.error(err);
        }
    }
});

// --- 7. PDF REPORT GENERATOR (FIXED AND STABILIZED) ---
downloadPdfBtn.addEventListener("click", () => {
    const reportElement = document.getElementById("pdfExportWrapper");
    
    // Explicit options ensuring container scaling renders multi-column structures correctly
    const outputOptions = {
        margin:       [10, 10, 10, 10],
        filename:     'Official_Election_Results_Report.pdf',
        image:        { type: 'jpeg', quality: 1.0 },
        html2canvas:  { 
            scale: 2, 
            useCORS: true, 
            logging: false, 
            backgroundColor: '#ffffff' 
        },
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
        console.error(error);
        downloadPdfBtn.textContent = "📄 Export PDF Report";
        downloadPdfBtn.disabled = false;
    });
});

resetAllVotesBtn.addEventListener("click", async () => {
    if (!confirm("Wipe all recorded votes?") || !confirm("Final warning! Reset?")) return;
    resetAllVotesBtn.disabled = true;
    try {
        const editButtons = adminLiveRolesContainer.querySelectorAll(".save-inline-btn");
        const clearPromises = Array.from(editButtons).map(async (btn) => {
            const key = btn.getAttribute("data-key");
            let clearedVotes = { c1: 0, c2: 0 };
            if (document.getElementById(`input3-${key}`) && document.getElementById(`input3-${key}`).value.trim()) clearedVotes.c3 = 0;
            if (document.getElementById(`input4-${key}`) && document.getElementById(`input4-${key}`).value.trim()) clearedVotes.c4 = 0;
            return set(ref(db, `election/${key}`), clearedVotes);
        });
        await Promise.all(clearPromises);
        alert("Reset complete.");
    } catch (err) {
        console.error(err);
    } finally {
        resetAllVotesBtn.disabled = false;
        resetAllVotesBtn.textContent = "⚠️ Reset All Votes";
    }
});
