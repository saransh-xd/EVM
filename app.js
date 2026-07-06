import { db, ref, onValue } from "./firebase.js";
import { runTransaction } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

const ballotInterfaceWrapper = document.getElementById("ballotInterfaceWrapper");

let structuredRolesList = [];
let currentPositionIndex = 0;

// --- VOICE HELPER ENGINE ---
function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); 
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

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
        speakText("Voting has been terminated.");
        return;
    }

    let temporaryList = Object.keys(configData).map(key => {
        return {
            key: key,
            ...configData[key],
            sequence: parseInt(configData[key].sequence || 1)
        };
    });

    temporaryList.sort((a, b) => a.sequence - b.sequence);
    
    if (JSON.stringify(structuredRolesList.map(r => r.key)) !== JSON.stringify(temporaryList.map(r => r.key))) {
        structuredRolesList = temporaryList;
        if (structuredRolesList.length === 0) {
            ballotInterfaceWrapper.innerHTML = `
                <div class="ballot-card">
                    <span style="font-size: 60px;">📝</span>
                    <h2 style="color: #1a237e; margin-top: 15px;">Empty Ballot Matrix</h2>
                    <p style="color: #666;">There are currently no active positions configured for this election cycle.</p>
                </div>
            `;
        } else {
            renderActiveBallotStep();
        }
    }
});

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
        speakText("Thank you! Your ballot has been cast successfully.");
        document.getElementById("resetSessionBtn").addEventListener("click", () => {
            currentPositionIndex = 0;
            renderActiveBallotStep();
        });
        return;
    }

    const currentRole = structuredRolesList[currentPositionIndex];

    let candidatesList = [];
    if (currentRole.candidate1) candidatesList.push({ id: "c1", name: currentRole.candidate1 });
    if (currentRole.candidate2) candidatesList.push({ id: "c2", name: currentRole.candidate2 });
    if (currentRole.candidate3) candidatesList.push({ id: "c3", name: currentRole.candidate3 });
    if (currentRole.candidate4) candidatesList.push({ id: "c4", name: currentRole.candidate4 });

    let squaresContentHtml = "";
    candidatesList.forEach(cand => {
        squaresContentHtml += `
            <div class="candidate-square" data-candidate-id="${cand.id}" data-candidate-name="${cand.name}">
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

    speakText(`Voting for position: ${currentRole.title}.`);

    const squaresElements = ballotInterfaceWrapper.querySelectorAll(".candidate-square");
    squaresElements.forEach(square => {
        square.addEventListener("click", () => {
            const chosenId = square.getAttribute("data-candidate-id");
            const chosenName = square.getAttribute("data-candidate-name");
            
            // 🎯 IN-UI SCREEN INTERMEDIATE CONFIRMATION
            renderUIConfirmationScreen(currentRole, chosenId, chosenName);
        });
    });
}

// Renders visual internal UI card step asking the user to commit or change choice
function renderUIConfirmationScreen(role, candidateId, candidateName) {
    ballotInterfaceWrapper.innerHTML = `
        <div style="text-align: center; margin-bottom: 15px; font-weight: bold; color: #4f5e7b; font-size: 14px;">
            Confirming Selection
        </div>
        <div class="ballot-card" style="border: 2px solid #007bff; max-width: 550px;">
            <span style="font-size: 50px;">🤔</span>
            <h2 style="color: #1a237e; margin-top: 10px; font-weight:800;">Review Your Selection</h2>
            <p style="color: #555; font-size:16px; margin-bottom:20px;">
                You are about to choose <strong style="color:#007bff; font-size:18px;">${candidateName}</strong> for the position of <br><strong>${role.title}</strong>.
            </p>
            
            <div style="display: flex; gap: 15px; justify-content: center; margin-top: 10px;">
                <button id="cancelChoiceBtn" style="flex:1; background: #e0e4ec; color: #4f5e7b; border: none; padding: 14px; font-weight: bold; border-radius: 8px; cursor: pointer;">
                    Go Back
                </button>
                <button id="confirmChoiceBtn" style="flex:1; background: #28a745; color: white; border: none; padding: 14px; font-weight: bold; border-radius: 8px; cursor: pointer;">
                    Confirm & Submit
                </button>
            </div>
        </div>
    `;

    speakText(`Confirm your vote for ${candidateName}.`);

    document.getElementById("cancelChoiceBtn").addEventListener("click", () => {
        renderActiveBallotStep(); // Returns smoothly back to options grid
    });

    document.getElementById("confirmChoiceBtn").addEventListener("click", () => {
        processVoteSubmission(role.key, candidateId);
    });
}

async function processVoteSubmission(roleKey, candidateFieldId) {
    const targetVoteRef = ref(db, `election/${roleKey}/${candidateFieldId}`);
    try {
        await runTransaction(targetVoteRef, (currentValue) => {
            return (currentValue || 0) + 1;
        });
        currentPositionIndex++;
        renderActiveBallotStep();
    } catch (error) {
        console.error(error);
        alert("Submission failed. Please try again.");
    }
}
