import { db, ref, runTransaction } from "./firebase.js";

const roles = [
    { title: "Head Boy", db: "headBoy" },
    { title: "Head Girl", db: "headGirl" },
    { title: "Deputy Head Boy", db: "deputyHeadBoy" },
    { title: "Deputy Head Girl", db: "deputyHeadGirl" },
    { title: "Red House Captain", db: "redHouseCaptain" },
    { title: "Green House Captain", db: "greenHouseCaptain" },
    { title: "Yellow House Captain", db: "yellowHouseCaptain" },
    { title: "Blue House Captain", db: "blueHouseCaptain" }
];

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

let selectedCandidate = "";

voteA.onclick = () => openPopup("Candidate A");
voteB.onclick = () => openPopup("Candidate B");

function openPopup(candidate){

    selectedCandidate = candidate;

    popupText.textContent =
        `Are you sure you want to vote for ${candidate}?`;

    popup.classList.remove("hidden");
}

cancelBtn.onclick = () => {

    popup.classList.add("hidden");

};

confirmBtn.onclick = async () => {

    popup.classList.add("hidden");

    const voteRef = ref(
        db,
        `election/${roles[currentRole].db}/${selectedCandidate === "Candidate A" ? "candidateA" : "candidateB"}`
    );

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

    status.textContent =
        `✅ Vote Recorded! Next vote in ${seconds}s`;

    const timer = setInterval(() => {

        seconds--;

        if(seconds > 0){

            status.textContent =
                `✅ Vote Recorded! Next vote in ${seconds}s`;

        }else{

            clearInterval(timer);

            currentRole++;

            if(currentRole < roles.length){

                roleTitle.textContent =
                    `🗳️ ${roles[currentRole].title} Election`;

                progress.textContent =
                    `Position ${currentRole + 1} of ${roles.length}`;

                status.textContent = "🟢 Ready";

                voteA.disabled = false;
                voteB.disabled = false;

            }else{

                document.querySelector(".container").innerHTML = `

                    <h1>🎉 Voting Complete</h1>

                    <p>
                        All 8 votes have been recorded.
                    </p>

                    <button id="nextStudent">
                        Start Next Student
                    </button>

                `;

                document
                    .getElementById("nextStudent")
                    .onclick = () => {

                        location.reload();

                    };

            }

        }

    }, 1000);

}