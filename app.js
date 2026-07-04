import { db, ref, onValue } from "./firebase.js";
import { runTransaction } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// DOM Node Selectors
const ballotPaper = document.getElementById("ballotPaper");
const electionClosedOverlay = document.getElementById("electionClosedOverlay");

// --- 1. LIVE MONITOR: MASTER ELECTION CLOSE SWITCH ---
onValue(ref(db, "settings/status"), (snapshot) => {
    const status = snapshot.val() || "open";
    
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
    
    ballotPaper.innerHTML = "";
    const positionKeys = Object.keys(configData);

    if (positionKeys.length === 0) {
        ballotPaper.innerHTML = `
            <div style="text-align:center; padding: 40px; color: #777;">
                <p style="font-size: 18px; font-weight: bold;">No open positions found.</p>
                <p>The election ballot is currently empty.</p>
            </div>`;
        return;
    }

    // Render an interactive voting card for every configured role node found
    positionKeys.forEach(key => {
        const role = configData[key];
        
        ballotPaper.innerHTML += `
        <div class="voter-card">
            <h2>${role.title}</h2>
            <div class="voter-options-grid">
                <button class="vote-action-btn" data-key="${key}" data-candidate="candidateA">
                    <span class="avatar">👤</span>
                    <span class="cand-name">${role.candidateA}</span>
                    <span class="action-tag">Tap to Vote</span>
                </button>
                <button class="vote-action-btn" data-key="${key}" data-candidate="candidateB">
                    <span class="avatar">👤</span>
                    <span class="cand-name">${role.candidateB}</span>
                    <span class="action-tag">Tap to Vote</span>
                </button>
            </div>
        </div>
        `;
    });
});

// --- 3. SECURE TRANSACTION TRANSACTION ENGINE ---
ballotPaper.addEventListener("click", async (e) => {
    // Traverse element tree up to safely locate the action button node
    const btn = e.target.closest(".vote-action-btn");
    if (!btn) return;

    const roleKey = btn.getAttribute("data-key");
    const choice = btn.getAttribute("data-candidate");
    
    // Prevent quick click spamming by disabling button context temporarily
    btn.style.pointerEvents = "none";
    btn.style.opacity = "0.5";

    try {
        const voteCounterRef = ref(db, `election/${roleKey}/${choice}`);
        
        // Atomic transaction guarantees database counts don't miscalculate during heavy user traffic
        await runTransaction(voteCounterRef, (currentValue) => {
            return (currentValue || 0) + 1;
        });

        alert("🎉 Your vote has been recorded securely. Thank you!");
    } catch (err) {
        console.error("Secure transaction runtime failure:", err);
        alert("An error occurred while submitting your ballot. Please try again.");
    } finally {
        // Restore interactive states
        if (btn) {
            btn.style.pointerEvents = "auto";
            btn.style.opacity = "1";
        }
    }
});
