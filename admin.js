import { db, ref, onValue } from "./firebase.js";
import { set, remove } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

const PASSWORD = "saransh270912";

const loginScreen = document.getElementById("loginScreen");
const dashboardScreen = document.getElementById("dashboardScreen");
const password = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const error = document.getElementById("error");

const liveResults = document.getElementById("liveResults");
const newRoleTitle = document.getElementById("newRoleTitle");
const candA = document.getElementById("candA");
const candB = document.getElementById("candB");
const addRoleBtn = document.getElementById("addRoleBtn");

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

// Save new role parameters straight to Firebase Realtime Database
addRoleBtn.onclick = async () => {
    const title = newRoleTitle.value.trim();
    const candidateA = candA.value.trim() || "Candidate A";
    const candidateB = candB.value.trim() || "Candidate B";

    if(!title) {
        alert("Please enter a Position Title!");
        return;
    }

    const key = title.toLowerCase().replace(/[^a-z0-9]/g, "_");

    // Save configurations and clear input forms
    await set(ref(db, `election_config/${key}`), { title, candidateA, candidateB });
    await set(ref(db, `election/${key}/candidateA`), 0);
    await set(ref(db, `election/${key}/candidateB`), 0);

    newRoleTitle.value = "";
    candA.value = "";
    candB.value = "";
};

// 🛠️ Secure Event Listener for the Delete Button
liveResults.addEventListener("click", async (e) => {
    if (e.target.classList.contains("delete-btn")) {
        const key = e.target.getAttribute("data-key");
        const roleTitle = e.target.getAttribute("data-title");
        
        if(confirm(`Are you sure you want to delete the "${roleTitle}" position and completely wipe its current vote results?`)) {
            try {
                await remove(ref(db, `election_config/${key}`));
                await remove(ref(db, `election/${key}`));
            } catch (err) {
                console.error("Error deleting node:", err);
            }
        }
    }
});

function loadDashboard(){
    // Listen directly to the configuration data. If this exists, we render cards!
    onValue(ref(db, "election_config"), (configSnapshot) => {
        const configData = configSnapshot.val();
        
        // Listen separately to the live votes data
        onValue(ref(db, "election"), (votesSnapshot) => {
            const votesData = votesSnapshot.val() || {};
            
            liveResults.innerHTML = "";
            
            if (!configData) {
                liveResults.innerHTML = "<p style='text-align:center; color:#777;'>No positions configured yet. Use the form above to add one!</p>";
                return;
            }

            let totalVotes = 0;

            Object.keys(configData).forEach(key => {
                const role = configData[key];
                const votes = votesData[key] || {};
                
                const a = votes.candidateA || 0;
                const b = votes.candidateB || 0;
                totalVotes += a + b;

                let winner = "Tie";
                if(a > b) winner = role.candidateA;
                if(b > a) winner = role.candidateB;

                liveResults.innerHTML += `
                <div class="card" style="position: relative; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h2 style="margin: 0;">${role.title}</h2>
                        <button class="delete-btn" data-key="${key}" data-title="${role.title}">🗑️ Remove</button>
                    </div>
                    <div class="row">
                        <span>${role.candidateA}</span>
                        <strong>${a}</strong>
                    </div>
                    <div class="row">
                        <span>${role.candidateB}</span>
                        <strong>${b}</strong>
                    </div>
                    <div class="winner" style="margin-top: 10px;">
                        🏆 Leading: ${winner}
                    </div>
                </div>
                `;
            });

            liveResults.innerHTML += `
            <div class="card total">
                Total Votes Cast
                <br><br>
                ${totalVotes}
            </div>
            `;
        });
    });
}
