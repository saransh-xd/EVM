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

// 🔊 Preload the audio file cleanly
const voteAudio = new Audio("vote-confirm.ogg");
voteAudio.preload = "auto";

// 1. Listen to database changes dynamically
onValue(ref(db, "election_config"), (snapshot) => {
    const data = snapshot.val();
    
    if(!data) {
        roleTitle.textContent = "❌ No active elections configured.";
        progress.textContent = "Position 0 of 0";
        voteA.style.display = "none";
        voteB.style.display = "none";
        return;
    }
    
    voteA.style.display = "block";
    voteB.style.display = "block";

    roles = Object.keys(data).map(key => ({
        dbKey: key,
        title: data[key].title,
        candidateA: data[key].candidateA,
        candidateB: data[key].candidateB
    }));

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
    // 💡 Quick activation trigger hack so the browser unblocks the audio element
    voteAudio.play().then(() => {
        voteAudio.pause();
        voteAudio.currentTime = 0;
    }).catch(() => {});

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

        // 🎵 Play the confirm sound safely
        voteAudio.play().catch(e => console.error("Audio block error:", e));

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
