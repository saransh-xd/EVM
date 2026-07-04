import { db, ref, onValue } from "./firebase.js";
import { runTransaction } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// DOM Node Selectors
const ballotPaper = document.getElementById("ballotPaper");
const electionClosedOverlay = document.getElementById("electionClosedOverlay");

// State Tracking Variables
let allRoles = [];
let currentRoleIndex = 0;
let electionStatus = "open";

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

    // Reset view to the beginning if configuration changes or if starting fresh
    if (currentRoleIndex >= allRoles.length) {
        currentRoleIndex = 0;
    }

    renderCurrentRole();
});

// --- 3. RENDERING ENGINE (ONE ROLE AT A TIME) ---
function renderCurrentRole() {
    // If the election is closed, let the overlay do the blocking
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
                <h2 style="color: #1a237e; margin-top: 15px;">All Votes Submitted!</h2>
                <p style="color: #555; font-size: 16px;">Thank you for casting your official ballot. Your responses have been securely stored.</p>
            </div>`;
        return;
    }

    // Get the single active role to showcase
    const activeRole = allRoles[currentRoleIndex];

    // Progress Indicator Text to guide the user (e.g., Position 1 of 3)
    const progressText = `<p style="text-align: center; color: #666; font-weight: bold; margin-bottom: 15px;">Position ${currentRoleIndex + 1} of ${allRoles.length}</p>`;

    ballotPaper.innerHTML = progressText + `
    <div class="voter-card">
        <h2>${activeRole.title}</h2>
        <div class="voter-options-grid">
            <button class="vote-action-btn" data-key="${activeRole.key}" data-candidate="candidateA" data-name="${activeRole.candidateA}">
                <span class="avatar">👤</span>
                <span class="cand-name">${activeRole.candidateA}</span>
                <span class="action-tag">Tap to Vote</span>
            </button>
            <button class="vote-action-btn" data-key="${activeRole.key}" data-candidate="candidateB" data-name="${activeRole.candidateB}">
                <span class="avatar">👤</span>
                <span class="cand-name">${activeRole.candidateB}</span>
                <span class="action-tag">Tap to Vote</span>
            </button>
        </div>
    </div>
    `;
}

// --- 4. SECURE VOTE WITH CONFIRMATION PROMPT ---
ballotPaper.addEventListener("click", async (e) => {
    const btn = e.target.closest(".vote-action-btn");
    if (!btn) return;

    const roleKey = btn.getAttribute("data-key");
    const choice = btn.getAttribute("data-candidate");
    const candidateName = btn.getAttribute("data-name");
    const currentRole = allRoles[currentRoleIndex];

    // 🛑 VOTE CONFIRMATION STEP ADDED BACK
    const confirmVote = confirm(`Are you sure you want to vote for "${candidateName}" as ${currentRole.title}?`);
    
    if (!confirmVote) return; // If student clicks Cancel, do nothing!

    // Temporarily freeze button to prevent double-clicks
    btn.style.pointerEvents = "none";
    btn.style.opacity = "0.5";

    try {
        const voteCounterRef = ref(db, `election/${roleKey}/${choice}`);
        
        // Atomically increment vote counts inside Firebase safely
        await runTransaction(voteCounterRef, (currentValue) => {
            return (currentValue || 0) + 1;
        });

        // Advance layout track to the next sequential position role index
        currentRoleIndex++;
        renderCurrentRole();

    } catch (err) {
        console.error("Secure transaction runtime failure:", err);
        alert("An error occurred while submitting your ballot. Please try again.");
        
        // Restore buttons if something crashes
        btn.style.pointerEvents = "auto";
        btn.style.opacity = "1";
    }
});
