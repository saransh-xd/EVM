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
const candidateAName = document.getElementById("candidateAName");
const candidateBName = document.getElementById("candidateBName");
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

// --- 3. FIREBASE UNIFIED SYNCHRONIZATION (LIVE CONFIG + SORTING) ---
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

        // Transform into array so we can process and sort sequentially
        let structuredRoles = Object.keys(configData).map(key => {
            return {
                key: key,
                ...configData[key],
                sequence: parseInt(configData[key].sequence || 1)
            };
        });

        // 📊 SORT ROLES LOGIC: Conduct lowest sequence values first (1, 2, 3...)
        structuredRoles.sort((a, b) => a.sequence - b.sequence);

        let absoluteGlobalTurnout = 0;

        if (structuredRoles.length === 0) {
            const emptyMsg = `<p style="text-align: center; color: #777; padding: 20px; grid-column: 1/-1;">The ballot is empty. Add elements inside the Ballot Setup tab.</p>`;
            adminLiveRolesContainer.innerHTML = emptyMsg;
            liveDashboardChartsGrid.innerHTML = emptyMsg;
            globalVoteCastCounter.textContent = "0";
            return;
        }

        structuredRoles.forEach(role => {
            const key = role.key;
            const tallyA = (voteData[key] && voteData[key].candidateA) ? voteData[key].candidateA : 0;
            const tallyB = (voteData[key] && voteData[key].candidateB) ? voteData[key].candidateB : 0;
            const totalVotes = tallyA + tallyB;

            absoluteGlobalTurnout += totalVotes;

            const pctA = totalVotes > 0 ? ((tallyA / totalVotes) * 100).toFixed(0) : 0;
            const pctB = totalVotes > 0 ? ((tallyB / totalVotes) * 100).toFixed(0) : 0;

            // Build View A: Sorted Performance Charts
            liveDashboardChartsGrid.innerHTML += `
                <div class="result-card">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="color: #1a237e; margin-top: 0; font-size: 16px;">${role.title}</h3>
                        <span style="background: #e1e5f2; color: #1a237e; font-size: 11px; padding: 2px 8px; font-weight: bold; border-radius: 10px;">Order: ${role.sequence}</span>
                    </div>
                    <p style="font-size: 12px; color: #666; margin-bottom: 12px;">Total Votes Placed: <strong>${totalVotes}</strong></p>
                    
                    <div style="font-size: 14px; color: #333;">
                        <div style="display:flex; justify-content:space-between;"><span>👤 ${role.candidateA}</span> <strong>${tallyA} (${pctA}%)</strong></div>
                        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${pctA}%; background: #1a237e;"></div></div>
                        
                        <div style="display:flex; justify-content:space-between; margin-top: 5px;"><span>👤 ${role.candidateB}</span> <strong>${tallyB} (${pctB}%)</strong></div>
                        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${pctB}%; background: #28a745;"></div></div>
                    </div>
                </div>
            `;

            // Build View B: Management List Block with inline Editable Position Sorting Order inputs
            adminLiveRolesContainer.innerHTML += `
                <div class="role-list-item">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                            <span style="font-size: 12px; font-weight: bold; color: #666;">Order:</span>
                            <input type="number" class="inline-order-input" id="order-${key}" value="${role.sequence}" min="1">
                            <strong style="font-size: 16px; color: #1a237e;">${role.title}</strong>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <input type="text" class="inline-edit-input" id="inputA-${key}" value="${role.candidateA}">
                            <span style="font-size: 13px; font-weight: bold; color: #888;">vs</span>
                            <input type="text" class="inline-edit-input" id="inputB-${key}" value="${role.candidateB}">
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

// --- 5. NEW ROLE GENERATOR (WITH INITIAL SEQUENCE) ---
createRoleBtn.addEventListener("click", async () => {
    const title = newRoleTitle.value.trim();
    const candA = candidateAName.value.trim();
    const candB = candidateBName.value.trim();
    const sequenceValue = parseInt(newRoleSequence.value) || 1;

    if (!title || !candA || !candB) {
        alert("Please complete all configuration fields.");
        return;
    }

    createRoleBtn.disabled = true;
    try {
        const newPositionRef = push(ref(db, "election_config"));
        await set(newPositionRef, { title, candidateA: candA, candidateB: candB, sequence: sequenceValue });
        await set(ref(db, `election/${newPositionRef.key}`), { candidateA: 0, candidateB: 0 });

        newRoleTitle.value = "";
        candidateAName.value = "";
        candidateBName.value = "";
        newRoleSequence.value = "1";
        alert("🎉 New ballot element posted successfully!");
    } catch (err) {
        console.error(err);
    } finally {
        createRoleBtn.disabled = false;
    }
});

// --- 6. INTERACTION CAPTURE: INLINE EDITS (NAMES & SEQUENCE ORDER) & DELETIONS ---
adminLiveRolesContainer.addEventListener("click", async (e) => {
    if (e.target.classList.contains("save-inline-btn")) {
        const targetKey = e.target.getAttribute("data-key");
        const valA = document.getElementById(`inputA-${targetKey}`).value.trim();
        const valB = document.getElementById(`inputB-${targetKey}`).value.trim();
        const valSeq = parseInt(document.getElementById(`order-${targetKey}`).value) || 1;

        if (!valA || !valB) {
            alert("Candidate names cannot be empty.");
            return;
        }

        e.target.disabled = true;
        e.target.textContent = "Saving...";

        try {
            await update(ref(db, `election_config/${targetKey}`), {
                candidateA: valA,
                candidateB: valB,
                sequence: valSeq
            });
            alert("Config and display conduct order successfully rearranged!");
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
            return set(ref(db, `election/${key}`), { candidateA: 0, candidateB: 0 });
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
