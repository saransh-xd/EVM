import { db, ref, onValue } from "./firebase.js";
import { set, remove, push, update } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

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
const newRoleSequence = document.getElementById("newRoleSequence");
const candidate1Name = document.getElementById("candidate1Name");
const candidate2Name = document.getElementById("candidate2Name");
const candidate3Name = document.getElementById("candidate3Name");
const candidate4Name = document.getElementById("candidate4Name");
const createRoleBtn = document.getElementById("createRoleBtn");
const adminLiveRolesContainer = document.getElementById("adminLiveRolesContainer");

// Live Results Targets
const liveDashboardChartsGrid = document.getElementById("liveDashboardChartsGrid");
const globalVoteCastCounter = document.getElementById("globalVoteCastCounter");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const resetAllVotesBtn = document.getElementById("resetAllVotesBtn");

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

// --- 3. FIREBASE UNIFIED SYNCHRONIZATION (DYNAMIC MULTI-CANDIDATE TRACKING) ---
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

        // Transform into array for structural ordering operations
        let structuredRoles = Object.keys(configData).map(key => {
            return {
                key: key,
                ...configData[key],
                sequence: parseInt(configData[key].sequence || 1)
            };
        });

        // Sort via custom designated sequence number
        structuredRoles.sort((a, b) => a.sequence - b.sequence);

        let absoluteGlobalTurnout = 0;

        if (structuredRoles.length === 0) {
            const emptyMsg = `<p style="text-align: center; color: #777; padding: 20px; grid-column: 1/-1;">The ballot is empty. Add elements inside the Ballot Setup tab.</p>`;
            adminLiveRolesContainer.innerHTML = emptyMsg;
            liveDashboardChartsGrid.innerHTML = emptyMsg;
            globalVoteCastCounter.textContent = "0";
            return;
        }

        // Color theme options assigned symmetrically to multi-candidate charts
        const chartColors = ["#1a237e", "#28a745", "#fd7e14", "#6f42c1"];

        structuredRoles.forEach(role => {
            const key = role.key;
            
            // Build temporary arrays checking for up to 4 candidates dynamically
            let candidatesArray = [];
            if (role.candidate1) candidatesArray.push({ index: 1, name: role.candidate1 });
            if (role.candidate2) candidatesArray.push({ index: 2, name: role.candidate2 });
            if (role.candidate3) candidatesArray.push({ index: 3, name: role.candidate3 });
            if (role.candidate4) candidatesArray.push({ index: 4, name: role.candidate4 });

            let totalVotes = 0;
            let roleVotesData = voteData[key] || {};
            
            // Calculate total performance aggregates
            candidatesArray.forEach(cand => {
                const tally = roleVotesData[`c${cand.index}`] || 0;
                totalVotes += tally;
                cand.tally = tally;
            });

            absoluteGlobalTurnout += totalVotes;

            // Render Dynamic Performance Layout Card
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
                <div class="result-card">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="color: #1a237e; margin-top: 0; font-size: 16px;">${role.title}</h3>
                        <span style="background: #e1e5f2; color: #1a237e; font-size: 11px; padding: 2px 8px; font-weight: bold; border-radius: 10px;">Order: ${role.sequence}</span>
                    </div>
                    <p style="font-size: 12px; color: #666; margin-bottom: 12px;">Total Votes Placed: <strong>${totalVotes}</strong></p>
                    <div style="font-size: 14px; color: #333;">
                        ${chartRowsHtml}
                    </div>
                </div>
            `;

            // Build Symmetrical Multi-Input Config Row Block
            let inlineInputsHtml = "";
            candidatesArray.forEach(cand => {
                inlineInputsHtml += `
                    <input type="text" class="inline-edit-input" id="input${cand.index}-${key}" value="${cand.name}" placeholder="Candidate ${cand.index}">
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

// --- 5. NEW ROLE GENERATOR (WITH VARIABLE SLOTS SUPPORT) ---
createRoleBtn.addEventListener("click", async () => {
    const title = newRoleTitle.value.trim();
    const c1 = candidate1Name.value.trim();
    const c2 = candidate2Name.value.trim();
    const c3 = candidate3Name.value.trim();
    const c4 = candidate4Name.value.trim();
    const sequenceValue = parseInt(newRoleSequence.value) || 1;

    if (!title || !c1 || !c2) {
        alert("Please specify the role title and at least the first two mandatory candidates.");
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
        alert("🎉 New dynamic ballot element posted successfully!");
    } catch (err) {
        console.error(err);
    } finally {
        createRoleBtn.disabled = false;
    }
});

// --- 6. INTERACTION CAPTURE: INLINE EDITS & DELETIONS ---
adminLiveRolesContainer.addEventListener("click", async (e) => {
    if (e.target.classList.contains("save-inline-btn")) {
        const targetKey = e.target.getAttribute("data-key");
        const val1 = document.getElementById(`input1-${targetKey}`) ? document.getElementById(`input1-${targetKey}`).value.trim() : "";
        const val2 = document.getElementById(`input2-${targetKey}`) ? document.getElementById(`input2-${targetKey}`).value.trim() : "";
        const val3 = document.getElementById(`input3-${targetKey}`) ? document.getElementById(`input3-${targetKey}`).value.trim() : "";
        const val4 = document.getElementById(`input4-${targetKey}`) ? document.getElementById(`input4-${targetKey}`).value.trim() : "";
        const valSeq = parseInt(document.getElementById(`order-${targetKey}`).value) || 1;

        if (!val1 || !val2) {
            alert("Primary candidates 1 and 2 cannot be left blank.");
            return;
        }

        e.target.disabled = true;
        e.target.textContent = "Saving...";

        try {
            let updatePayload = {
                candidate1: val1,
                candidate2: val2,
                sequence: valSeq
            };

            // Safely write optional slots into matrix map updates
            if (document.getElementById(`input3-${targetKey}`)) updatePayload.candidate3 = val3;
            if (document.getElementById(`input4-${targetKey}`)) updatePayload.candidate4 = val4;

            await update(ref(db, `election_config/${targetKey}`), updatePayload);
            alert("Configuration settings modified successfully!");
        } catch (err) {
            console.error(err);
            alert("Failed to modify configuration matrix.");
        } finally {
            e.target.disabled = false;
            e.target.textContent = "💾 Save Changes";
        }
        return;
    }

    if (e.target.classList.contains("delete-btn")) {
        const targetKey = e.target.getAttribute("data-key");
        if (!confirm("Are you sure you want to completely erase this role? All associated votes will be lost.")) return;

        try {
            await remove(ref(db, `election_config/${targetKey}`));
            await remove(ref(db, `election/${targetKey}`));
        } catch (err) {
            console.error(err);
        }
    }
});

// --- 7. PDF REPORT GENERATOR ---
downloadPdfBtn.addEventListener("click", () => {
    const reportElement = document.getElementById("pdfExportWrapper");
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
        console.error(error);
        downloadPdfBtn.textContent = "📄 Export PDF Report";
        downloadPdfBtn.disabled = false;
    });
});

// --- 8. MASTER RESET ALL VOTES ---
resetAllVotesBtn.addEventListener("click", async () => {
    const firstConfirm = confirm("⚠️ WARNING: You are about to wipe out EVERY single vote recorded in the database. This action cannot be undone. Do you wish to proceed?");
    if (!firstConfirm) return;

    const secondConfirm = confirm("FINAL CONFIRMATION: Are you absolutely certain you want to reset all vote tallies to 0?");
    if (!secondConfirm) return;

    resetAllVotesBtn.disabled = true;
    resetAllVotesBtn.textContent = "Clearing...";

    try {
        const editButtons = adminLiveRolesContainer.querySelectorAll(".save-inline-btn");
        if (editButtons.length === 0) {
            alert("No active roles found to reset.");
            return;
        }

        const clearPromises = Array.from(editButtons).map(async (btn) => {
            const key = btn.getAttribute("data-key");
            
            // Rebuild exact schema clearing dynamic keys to 0 safely
            let clearedVotes = { c1: 0, c2: 0 };
            if (document.getElementById(`input3-${key}`) && document.getElementById(`input3-${key}`).value.trim()) clearedVotes.c3 = 0;
            if (document.getElementById(`input4-${key}`) && document.getElementById(`input4-${key}`).value.trim()) clearedVotes.c4 = 0;

            return set(ref(db, `election/${key}`), clearedVotes);
        });

        await Promise.all(clearPromises);
        alert("🎉 Success! All election data streams have been reset to 0.");
    } catch (err) {
        console.error(err);
        alert("An error occurred while resetting data streams.");
    } finally {
        resetAllVotesBtn.disabled = false;
        resetAllVotesBtn.textContent = "⚠️ Reset All Votes";
    }
});
