import { db, ref, onValue } from "./firebase.js";
import { runTransaction } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

const ballotInterfaceWrapper = document.getElementById("ballotInterfaceWrapper");

let structuredRolesList = [];
let currentPositionIndex = 0;

// Connect and read from synced Firebase schema instance
onValue(ref(db), (snapshot) => {
    const rootData = snapshot.val() || {};
    const systemStatus = rootData.settings?.status || "open";
    const configData = rootData.election_config || {};

    if (systemStatus === "closed") {
        ballotInterfaceWrapper.innerHTML = `
            <div class="ballot-card">
                <span style="font-size: 60px;">🔒</span>
                <h2 style="color: #dc3545; margin-top: 15px;">Voting Terminated</h2>
                <p style="color: #666;">The active polling gate has been securely closed by the administrator. Ballots can no longer be transmitted.</p>
            </div>
        `;
        return;
    }

    // Parse configuration map into sorted sequencing arrays
    let temporaryList = Object.keys(configData).map(key => {
        return {
            key: key,
            ...configData[key],
            sequence: parseInt(configData[key].sequence || 1)
        };
    });

    // Sort matching administrative layout configurations (lowest sequence numbers first)
    temporaryList.sort((a, b) => a.sequence - b.sequence);
    structuredRolesList = temporaryList;

    if (structuredRolesList.length === 0) {
        ballotInterfaceWrapper.innerHTML = `
            <div class="ballot-card">
                <span style="font-size: 60px;">📝</span>
                <h2 style="color: #1a237e; margin-top: 15px;">Empty Ballot Matrix</h2>
                <p style="color: #666;">There are currently no active positions configured for this election cycle.</p>
            </div>
        `;
        return;
    }

    renderActiveBallotStep();
});

// Render the active ballot position card cleanly
function renderActiveBallotStep() {
    if (currentPositionIndex >= structuredRolesList.length) {
        ballotInterfaceWrapper.innerHTML = `
            <div class="ballot-card">
                <span style="font-size: 60px;">🎉</span>
                <h2 style="color: #28a745; margin-top: 15px;">Ballot Cast Successfully!</h2>
                <p style="color: #666; margin-bottom: 25px;">Thank you for fulfilling your democratic duty. Your selections have been written securely to the database.</p>
                <button id="resetSessionBtn" class="vote-badge" style="border: none; padding: 12px 30px; cursor: pointer; font-size: 14px; background: #1a237e; color: white; border-radius: 8px;">Next Voter</button>
            </div>
        `;
        document.getElementById("resetSessionBtn").addEventListener("click", () => {
            currentPositionIndex = 0;
            renderActiveBallotStep();
        });
        return;
    }

    const currentRole = structuredRolesList[currentPositionIndex];

    // Read up to 4 dynamic candidate keys without hardcoding or risking undefined values
    let candidatesList = [];
    if (currentRole.candidate1) candidatesList.push({ id: "c1", name: currentRole.candidate1 });
    if (currentRole.candidate2) candidatesList.push({ id: "c2", name: currentRole.candidate2 });
    if (currentRole.candidate3) candidatesList.push({ id: "c3", name: currentRole.candidate3 });
    if (currentRole.candidate4) candidatesList.push({ id: "c4", name: currentRole.candidate4 });

    // Generate balanced inner grid html layout blocks dynamically
    let squaresContentHtml = "";
    candidatesList.forEach(cand => {
        squaresContentHtml += `
            <div class="candidate-square" data-candidate-id="${cand.id}">
                <div class="candidate-avatar">👤</div>
                <div class="candidate-name">${cand.name}</div>
                <div class="vote-badge">Tap to Vote</div>
            </div>
        `;
    });

    ballotInterfaceWrapper.innerHTML = `
        <div style="text-align: center; margin-bottom: 15px; font-weight: bold; color: #4f5e7b; font-size: 14px;">
            Position ${currentPositionIndex + 1} of ${structuredRolesList.length}
        </div>
        <div class="ballot-card">
            <h2 style="color: #1a237e; margin-top: 0; margin-bottom: 5px; font-size: 28px; font-weight: 800;">${currentRole.title}</h2>
            <div class="candidates-grid">
                ${squaresContentHtml}
            </div>
        </div>
    `;

    // Bind event tap listeners to every candidate square box container dynamically
    const squaresElements = ballotInterfaceWrapper.querySelectorAll(".candidate-square");
    squaresElements.forEach(square => {
        square.addEventListener("click", () => {
            const chosenId = square.getAttribute("data-candidate-id");
            processVoteSubmission(currentRole.key, chosenId);
        });
    });
}

// Write transactional increments securely to prevent multi-device race collision bugs
async function processVoteSubmission(roleKey, candidateFieldId) {
    const targetVoteRef = ref(db, `election/${roleKey}/${candidateFieldId}`);
    
    try {
        await runTransaction(targetVoteRef, (currentValue) => {
            return (currentValue || 0) + 1;
        });
        
        // Advance smoothly to the next position step index layer
        currentPositionIndex++;
        renderActiveBallotStep();
    } catch (error) {
        console.error("Transmission error:", error);
        alert("System connection timeout. Please tap to re-submit your vote selection.");
    }
}
