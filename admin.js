import { db, ref, onValue } from "./firebase.js";

const PASSWORD = "saransh270912";

const loginScreen = document.getElementById("loginScreen");
const dashboardScreen = document.getElementById("dashboardScreen");

const password = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const error = document.getElementById("error");

const dashboard = document.getElementById("dashboard");

const roles = [
    { key: "headBoy", title: "Head Boy" },
    { key: "headGirl", title: "Head Girl" },
    { key: "deputyHeadBoy", title: "Deputy Head Boy" },
    { key: "deputyHeadGirl", title: "Deputy Head Girl" },
    { key: "redHouseCaptain", title: "Red House Captain" },
    { key: "greenHouseCaptain", title: "Green House Captain" },
    { key: "yellowHouseCaptain", title: "Yellow House Captain" },
    { key: "blueHouseCaptain", title: "Blue House Captain" }
];

loginBtn.onclick = () => {

    if(password.value === PASSWORD){

        loginScreen.style.display = "none";

        dashboardScreen.style.display = "block";

        loadDashboard();

    }else{

        error.textContent = "❌ Incorrect Password";

    }

};

password.addEventListener("keypress",(e)=>{

    if(e.key==="Enter"){

        loginBtn.click();

    }

});

function loadDashboard(){

    const electionRef = ref(db,"election");

    onValue(electionRef,(snapshot)=>{

        const data = snapshot.val() || {};

        dashboard.innerHTML = "";

        let totalVotes = 0;

        roles.forEach(role=>{

            const votes = data[role.key] || {};

            const a = votes.candidateA || 0;

            const b = votes.candidateB || 0;

            totalVotes += a+b;

            let winner = "Tie";

            if(a>b) winner = "Candidate A";

            if(b>a) winner = "Candidate B";

            dashboard.innerHTML += `

            <div class="card">

                <h2>${role.title}</h2>

                <div class="row">

                    <span>Candidate A</span>

                    <strong>${a}</strong>

                </div>

                <div class="row">

                    <span>Candidate B</span>

                    <strong>${b}</strong>

                </div>

                <div class="winner">

                    🏆 Leading: ${winner}

                </div>

            </div>

            `;

        });

        dashboard.innerHTML += `

        <div class="card total">

            Total Votes Cast

            <br><br>

            ${totalVotes}

        </div>

        `;

    });

}