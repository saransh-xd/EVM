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
let isCooldownActive = false; // Prevents interactions during countdowns

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

    if (!isCooldownActive) {
        renderCurrentRole();
    }
});

// --- 3. RENDERING ENGINE (ONE ROLE AT A TIME WITH FIXED ACTION BAR) ---
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

    // Determine selection states
    const isASelected = selectedChoice === "candidateA";
    const isBSelected = selectedChoice === "candidateB";
    const hasSelection = selectedChoice !== null;
    
    // Grab the actual text name of the candidate who was chosen
    const selectedName = isASelected ? activeRole.candidateA : (isBSelected ? activeRole.candidateB : "");

    // Render the beautiful bottom-docked verification drawer panel if a choice is picked
    const confirmationBarHtml = hasSelection 
        ? `<div style="margin-top: 25px; padding-top: 20px; border-top: 2px solid #f4f6f9; text-align: center; animation: fadeIn 0.2s ease-out;">
               <p style="margin: 0 0 15px 0; font-size: 16px; color: #333;">Confirm your vote for <strong style="color: #1a237e;">${selectedName}</strong>?</p>
               <div style="display: flex; justify-content: center; gap: 15px;">
                   <button class="cancel-vote-btn" style="background-color: #e0e4ec; color: #4f5e7b; border: none; padding: 10px 24px; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 14px; transition: background 0.2s;">Cancel</button>
                   <button class="confirm-vote-btn" data-candidate="${selectedChoice}" style="background-color: #28a745; color: white; border: none; padding: 10px 24px; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 14px; box-shadow: 0 4px 10px rgba(40,167,69,0.2); transition: background 0.2s;">Confirm Vote</button>
               </div>
           </div>`
        : '';

    ballotPaper.innerHTML = progressText + `
    <div class="voter-card">
        <h2>${activeRole.title}</h2>
        <div class="voter-options-grid">
            <button class="vote-action-btn" 
                    data-candidate="candidateA" 
                    style="${hasSelection && !isASelected ? 'opacity: 0.3; transform: scale(0.97); pointer-events: none;' : ''} ${isASelected ? 'border-color: #1a237e; box-shadow: 0 6px 15px rgba(26,35,126,0.12);' : ''}">
                <span class="avatar">👤</span>
                <span class="cand-name">${activeRole.candidateA}</span>
                <span class="action-tag" style="${isASelected ? 'background-color: #1a237e; color: #fff;' : ''}">${isASelected ? 'Selected' : 'Tap to Vote'}</span>
            </button>
            
            <button class="vote-action-btn" 
                    data-candidate="candidateB" 
                    style="${hasSelection && !isBSelected ? 'opacity: 0.3; transform: scale(0.97); pointer-events: none;' : ''} ${isBSelected ? 'border-color: #1a237e; box-shadow: 0 6px 15px rgba(26,35,126,0.12);' : ''}">
                <span class="avatar">👤</span>
                <span class="cand-name">${activeRole.candidateB}</span>
                <span class="action-tag" style="${isBSelected ? 'background-color: #1a237e; color: #fff;' : ''}">${isBSelected ? 'Selected' : 'Tap to Vote'}</span>
            </button>
        </div>
        ${confirmationBarHtml}
    </div>
    `;
}

// --- 4. COOLDOWN COUNTDOWN SCREEN WITH NATIVE AUDIO PROMPT ---
function triggerVoteCooldown() {
    isCooldownActive = true;
    let secondsLeft = 3;

    // 🔊 AUDIO NOTIFICATION SYSTEM
    try {
        // Cancel any pending speech queues to prevent overlap stutter
        window.speechSynthesis.cancel();
        
        const announcement = new SpeechSynthesisUtterance("Vote counted, please continue on next vote.");
        announcement.rate = 1.0;  // Normal speaking pace
        announcement.pitch = 1.0; // Standard voice timbre
        announcement.lang = 'en-US'; 
        
        window.speechSynthesis.speak(announcement);
    } catch (audioError) {
        console.warn("Speech engine context could not initialize:", audioError);
    }

    const runCountdown = () => {
        if (secondsLeft <= 0) {
            isCooldownActive = false;
            currentRoleIndex++;
            renderCurrentRole();
        } else {
            ballotPaper.innerHTML = `
                <div style="text-align:center; padding: 50px 40px; color: #2e7d32; background: #ffffff; border-radius: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 2px solid #a4deab; animation: fadeIn 0.2s ease-out;">
                    <span style="font-size: 50px;">✅</span>
                    <h2 style="color: #1a237e; margin-top: 15px; margin-bottom: 8px;">Vote Recorded Successfully!</h2>
                    <p style="color: #666; font-size: 15px; margin-bottom: 20px;">Your selection has been saved securely to the database.</p>
                    <div style="display: inline-block; padding: 8px 20px; background-color: #e8f5e9; color: #2e7d32; font-weight: bold; border-radius: 20px; font-size: 14px;">
                        ⏱️ Next ballot loading in ${secondsLeft}s...
                    </div>
                </div>`;
            secondsLeft--;
            setTimeout(runCountdown, 1000);
        }
    };

    runCountdown();
}

// --- 5. CLICK CAPTURE FOR SELECTION, CONFIRMATION, AND RESET LOOPS ---
ballotPaper.addEventListener("click", async (e) => {
    if (isCooldownActive) return; // Completely ignore screen taps during the 3s window

    // 🔄 Handle Next Student Button Click
    if (e.target && e.target.id === "nextStudentBtn") {
        currentRoleIndex = 0;
        selectedChoice = null;
        renderCurrentRole();
        return;
    }

    // 🛑 Handle Cancel Action Button Click
    if (e.target.classList.contains("cancel-vote-btn")) {
        selectedChoice = null;
        renderCurrentRole();
        return;
    }

    // ✅ Handle Secure Save Confirm Button Click
    if (e.target.classList.contains("confirm-vote-btn")) {
        const choice = e.target.getAttribute("data-candidate");
        const activeRole = allRoles[currentRoleIndex];
        
        e.target.disabled = true;
        e.target.textContent = "Saving...";

        try {
            const voteCounterRef = ref(db, `election/${activeRole.key}/${choice}`);
            
            // Atomically increment vote counts safely inside Firebase
            await runTransaction(voteCounterRef, (currentValue) => {
                return (currentValue || 0) + 1;
            });

            // Wipe out temporary selection and fire up the 3-second cooldown transition
            selectedChoice = null;
            triggerVoteCooldown();

        } catch (err) {
            console.error("Secure transaction runtime failure:", err);
            alert("An error occurred while submitting your ballot. Please try again.");
            selectedChoice = null;
            renderCurrentRole();
        }
        return;
    }

    // 👤 Handle Base Card Option Selection
    const btn = e.target.closest(".vote-action-btn");
    if (!btn) return;

    const clickedChoice = btn.getAttribute("data-candidate");
    
    if (selectedChoice === clickedChoice) {
        selectedChoice = null;
    } else {
        selectedChoice = clickedChoice;
    }
    
    renderCurrentRole();
});
