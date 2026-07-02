import { db, ref, runTransaction, onValue } from "./firebase.js";

let roles = [];
let currentRole = 0;

const voteA = document.getElementById("candidateA");
const voteB = document.getElementById("candidateB");
const popup = document.getElementById("popup");
const popupText = document.getElementById("popupText");
const confirmBtn = document.getElementById("confirmVote");
const cancelBtn = document.getElementById("cancelVote");
const status = document.getElementById("status");
const roleTitle = document.getElementById("roleTitle");
const progress = document.getElementById("progress");

let selectedCandidateKey = "";
let selectedCandidateName = ""; 

// 1. Listen to database changes dynamically
onValue(ref(db), (snapshot) => {
    const rootData = snapshot.val() || {};
    
    // Check if the admin config exists, otherwise check your main election path
    const configData = rootData.election_config || rootData.election;
    
    if (!configData) {
        roleTitle.textContent = "❌ No active elections configured.";
        progress.textContent = "Position 0 of 0";
        voteA.style.display = "none";
        voteB.style.display = "none";
        return;
    }
    
    voteA.style.display = "block";
    voteB.style.display = "block";

    // Transform the data whether it uses custom candidate names or the old default ones
    roles = Object.keys(configData).map(key => {
        // Fallback checks to prevent empty buttons if paths are legacy formatted
        const title = configData[key].title || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        const candidateA = configData[key].candidateA !== undefined && typeof configData[key].candidateA !== 'number' 
            ? configData[key].candidateA 
            : "Candidate A";
        const candidateB = configData[key].candidateB !== undefined && typeof configData[key].candidateB !== 'number' 
            ? configData[key].candidateB 
            : "Candidate B";

        return {
            dbKey: key,
            title: title,
            candidateA: candidateA,
            candidateB: candidateB
        };
    });

    setupVotingUI();
});

function setupVotingUI() {
    if(roles.length > 0 && currentRole < roles.length) {
        roleTitle.textContent = `🗳️ ${roles[currentRole].title} Election`;
        progress.textContent = `Position ${currentRole + 1} of ${roles.length}`;
        voteA.textContent = roles[currentRole].candidateA;
        voteB.textContent = roles[currentRole].candidateB;
        
        voteA.disabled = false;
        voteB.disabled = false;
        status.textContent = "🟢 Ready";
    }
}

voteA.onclick = () => openPopup("candidateA", roles[currentRole].candidateA);
voteB.onclick = () => openPopup("candidateB", roles[currentRole].candidateB);

function openPopup(key, name){
    selectedCandidateKey = key;
    selectedCandidateName = name;
    popupText.textContent = `Are you sure you want to vote for ${name}?`;
    popup.classList.remove("hidden");
}

cancelBtn.onclick = () => { popup.classList.add("hidden"); };

confirmBtn.onclick = async () => {
    popup.classList.add("hidden");
    
    const voteRef = ref(db, `election/${roles[currentRole].dbKey}/${selectedCandidateKey}`);

    try{
        await runTransaction(voteRef, (current) => {
            return (current || 0) + 1;
        });
        startCooldown();
    }catch(error){
        console.error(error);
        alert("Vote could not be saved.");
    }
};

function startCooldown(){
    voteA.disabled = true;
    voteB.disabled = true;
    let seconds = 3;

    status.textContent = `✅ Vote Recorded! Next vote in ${seconds}s`;

    const timer = setInterval(() => {
        seconds--;
        if(seconds > 0){
            status.textContent = `✅ Vote Recorded! Next vote in ${seconds}s`;
        }else{
            clearInterval(timer);
            currentRole++;

            if(currentRole < roles.length){
                setupVotingUI();
            }else{
                document.querySelector(".container").innerHTML = `
                    <h1>🎉 Voting Complete</h1>
                    <p>All positions have been voted on successfully.</p>
                    <button id="nextStudent" style="width:100%; padding:18px; font-size:22px; background:#1976d2; color:white; border:none; border-radius:12px; cursor:pointer;">
                        Start Next Student
                    </button>
                `;
                document.getElementById("nextStudent").onclick = () => { location.reload(); };
            }
        }
    }, 1000);
}
