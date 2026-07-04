import { db, ref, onValue } from "./firebase.js";
import { runTransaction } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// DOM Node Selectors
const ballotPaper = document.getElementById("ballotPaper");
const electionClosedOverlay = document.getElementById("electionClosedOverlay");

// State Tracking Variables
let allRoles = [];
let currentRoleIndex = 0;
let electionStatus = "open";

// Tracking state for the unconfirmed, selected candidate
let selectedChoice = null; // Stores 'candidateA' or 'candidateB'

// --- 1. LIVE MONITOR: MASTER ELECTION CLOSE SWITCH ---
onValue(ref(db, "settings/status"), (snapshot) => {
    const status = snapshot.val() || "open";
    electionStatus = status;
    
    if (status === "closed") {
        electionClosedOverlay.style.display = "block";
    } else {
        electionClosedOverlay.style.display = "none";
    }
});

// --- 2. LIVE CONFIGURATION RUNTIME SYNC ---
onValue(ref(db), (snapshot) => {
    const rootData = snapshot.val() || {};
    const configData = rootData.election_config || {};
    
    // Convert configuration object into a manageable array
    const positionKeys = Object.keys(configData);
    allRoles = positionKeys.map(key => ({
        key: key,
        ...configData[key]
    }));

    // Reset view back to safety boundaries if configuration changes unexpectedly
    if (currentRoleIndex > allRoles.length) {
        currentRoleIndex = 0;
    }

    renderCurrentRole();
});

// --- 3. RENDERING ENGINE (ONE ROLE AT A TIME WITH INLINE CONFIRMATION) ---
function renderCurrentRole() {
    if (electionStatus === "closed") return;

    if (allRoles.length === 0) {
        ballotPaper.innerHTML = `
            <div style="text-align:center; padding: 40px; color: #777;">
                <p style="font-size: 18px; font-weight: bold;">No open positions found.</p>
                <p>The election ballot is currently empty.</p>
            </div>`;
        return;
    }

    // Check if the student has completed all voting categories
    if (currentRoleIndex >= allRoles.length) {
        ballotPaper.innerHTML = `
            <div style="text-align:center; padding: 40px; color: #2e7d32; background: #ffffff; border-radius: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <span style="font-size: 60px;">🎉</span>
                <h2 style="color: #1a237e; margin-top: 15px; margin-bottom: 10px;">All Votes Submitted!</h2>
                <p style="color: #555; font-size: 16px; margin-bottom: 30px;">Thank you for casting your official ballot. Your responses have been securely stored.</p>
                
                <button id="nextStudentBtn" style="background-color: #1a237e; color: #ffffff; border: none; padding: 14px 28px; font-size: 16px; font-weight: bold; border-radius: 8px; cursor: pointer; transition: background 0.2s; box-shadow: 0 4px 6px rgba(26,35,126,0.15);">
                    👤 Next Student Vote
                </button>
            </div>`;
        return;
    }

    const activeRole = allRoles[currentRoleIndex];
    const progressText = `<p style="text-align: center; color: #666; font-weight: bold; margin-bottom: 15px;">Position ${currentRoleIndex + 1} of ${allRoles.length}</p>`;

    // Determine the layout states based on whether a candidate has been pressed
    const isASelected = selectedChoice === "candidateA";
    const isBSelected = selectedChoice === "candidateB";
    const hasSelection = selectedChoice !== null;

    // Build the Action HTML or Confirmation HTML inside the cards depending on the selection state
    const actionTagA = isASelected 
        ? `<div style="margin-top: 10px; display: flex; gap: 8px;">
               <button class="confirm-vote-btn" data-candidate="candidateA" style="background-color: #28a745; color: white; border: none; padding: 6px 12px; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 13px;">Confirm</button>
               <button class="cancel-vote-btn" style="background-color: #6c757d; color: white; border: none; padding: 6px 12px; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 13px;">Cancel</button>
           </div>`
        : `<span class="action-tag">Tap to Vote</span>`;

    const actionTagB = isBSelected 
        ? `<div style="margin-top: 10px; display: flex; gap: 8px;">
               <button class="confirm-vote-btn" data-candidate="candidateB" style="background-color: #28a745; color: white; border: none; padding: 6px 12px; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 13px;">Confirm</button>
               <button class="cancel-vote-btn" style="background-color: #6c757d; color: white; border: none; padding: 6px 12px; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 13px;">Cancel</button>
           </div>`
        : `<span class="action-tag">Tap to Vote</span>`;

    ballotPaper.innerHTML = progressText + `
    <div class="voter-card">
        <h2>${activeRole.title}</h2>
        <div class="voter-options-grid">
            <button class="vote-action-btn ${isASelected ? 'selected-glow' : ''}" 
                    data-candidate="candidateA" 
                    style="${hasSelection && !isASelected ? 'opacity: 0.4; transform: scale(0.98); pointer-events: none;' : ''} ${isASelected ? 'border-color: #1a237e; box-shadow: 0 4px 12px rgba(26,35,126,0.15); pointer-events: none;' : ''}">
                <span class="avatar">👤</span>
                <span class="cand-name">${activeRole.candidateA}</span>
                ${actionTagA}
            </button>
            
            <button class="vote-action-btn ${isBSelected ? 'selected-glow' : ''}" 
                    data-candidate="candidateB" 
                    style="${hasSelection && !isBSelected ? 'opacity: 0.4; transform: scale(0.98); pointer-events: none;' : ''} ${isBSelected ? 'border-color: #1a237e; box-shadow: 0 4px 12px rgba(26,35,126,0.15); pointer-events: none;' : ''}">
                <span class="avatar">👤</span>
                <span class="cand-name">${activeRole.candidateB}</span>
                ${actionTagB}
            </button>
        </div>
    </div>
    `;
}

// --- 4. CLICK CAPTURE FOR SELECTION, CONFIRMATION, AND RESET LOOPS ---
ballotPaper.addEventListener("click", async (e) => {
    // 🔄 Handle Next Student Button
    if (e.target && e.target.id === "nextStudentBtn") {
        currentRoleIndex = 0;
        selectedChoice = null;
        renderCurrentRole();
        return;
    }

    // 🛑 Handle Inline Cancel Button Click
    if (e.target.classList.contains("cancel-vote-btn")) {
        e.stopPropagation(); // Avoid triggering container buttons
        selectedChoice = null;
        renderCurrentRole();
        return;
    }

    // ✅ Handle Inline Secure Confirm Button Click
    if (e.target.classList.contains("confirm-vote-btn")) {
        e.stopPropagation();
        
        const choice = e.target.getAttribute("data-candidate");
        const activeRole = allRoles[currentRoleIndex];
        
        // Disable the confirmation block styling state during background writing
        e.target.disabled = true;
        e.target.textContent = "Saving...";

        try {
            const voteCounterRef = ref(db, `election/${activeRole.key}/${choice}`);
            
            // Atomically increment vote counts safely inside Firebase
            await runTransaction(voteCounterRef, (currentValue) => {
                return (currentValue || 0) + 1;
            });

            // Clean up selections and advance loop to next position
            selectedChoice = null;
            currentRoleIndex++;
            renderCurrentRole();

        } catch (err) {
            console.error("Secure transaction runtime failure:", err);
            alert("An error occurred while submitting your ballot. Please try again.");
            selectedChoice = null;
            renderCurrentRole();
        }
        return;
    }

    // 👤 Handle Base Card Tap to Initiate Confirmation Phase
    const btn = e.target.closest(".vote-action-btn");
    if (!btn) return;

    // Only allow selecting if nothing is currently locked into confirmation mode
    if (selectedChoice === null) {
        selectedChoice = btn.getAttribute("data-candidate");
        renderCurrentRole();
    }
});
