import { db, ref, onValue } from "./firebase.js";
import { set, remove, update } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

const PASSWORD = "saransh270912";

// UI Screens
const loginScreen = document.getElementById("loginScreen");
const dashboardScreen = document.getElementById("dashboardScreen");
const password = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const error = document.getElementById("error");

// Navigation Tabs
const tabResultsBtn = document.getElementById("tabResultsBtn");
const tabSettingsBtn = document.getElementById("tabSettingsBtn");
const resultsTab = document.getElementById("resultsTab");
const settingsTab = document.getElementById("settingsTab");

// Content Views
const liveResults = document.getElementById("liveResults");
const setupRoleList = document.getElementById("setupRoleList");
const newRoleTitle = document.getElementById("newRoleTitle");
const candA = document.getElementById("candA");
const candB = document.getElementById("candB");
const addRoleBtn = document.getElementById("addRoleBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const massResetBtn = document.getElementById("massResetBtn");

// Track current keys in local memory so the reset trigger knows exactly what nodes exist
let currentActiveKeys = [];

// --- DOWNLOAD PDF CLICK CONTROLLER ---
downloadPdfBtn.onclick = () => {
    const dateStr = new Date().toLocaleDateString().replace(/\//g, '-');
    document.title = `Election_Final_Results_${dateStr}`;
    window.print();
};

// --- MASS RESET BUTTON CLICK CONTROLLER ---
massResetBtn.onclick = async () => {
    if (currentActiveKeys.length === 0) {
        alert("There are no active election positions to reset!");
        return;
    }

    // Double Confirmation system to prevent accidental wipes
    const firstConfirm = confirm("⚠️ CRITICAL WARNING:\n\nAre you sure you want to RESET ALL VOTE COUNTS back to 0?\nThis action cannot be undone.");
    
    if (firstConfirm) {
        const secondConfirm = confirm("🛑 FINAL VERIFICATION:\n\nAre you absolutely sure? All live voting progress will be lost immediately.");
        
        if (secondConfirm) {
            try {
                // Loop through every single active position key and update its vote counters to 0
                for (const key of currentActiveKeys) {
                    await set(ref(db, `election/${key}`), {
                        candidateA: 0,
                        candidateB: 0
                    });
                }
                alert("🎉 Success! All vote counters have been wiped back to 0.");
            } catch (err) {
                console.error("Mass reset failure:", err);
                alert("An error occurred while resetting the votes.");
            }
        }
    }
};

// --- TAB ROUTING CONTROLLERS ---
tabResultsBtn.onclick = () => {
    tabResultsBtn.classList.add("active");
    tabSettingsBtn.classList.remove("active");
    resultsTab.classList.remove("hidden");
    settingsTab.classList.add("hidden");
};

tabSettingsBtn.onclick = () => {
    tabSettingsBtn.classList.add("active");
    tabResultsBtn.classList.remove("active");
    settingsTab.classList.remove("hidden");
    resultsTab.classList.add("hidden");
};

// --- SECURITY LOGIN GATE ---
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

// --- ENGINE: WRITE NEW POSITION ---
addRoleBtn.onclick = async () => {
    const title = newRoleTitle.value.trim();
    const candidateA = candA.value.trim() || "Candidate A";
    const candidateB = candB.value.trim() || "Candidate B";

    if(!title) {
        alert("Please enter a Position Title!");
        return;
    }

    const key = title.toLowerCase().replace(/[^a-z0-9]/g, "_");

    await set(ref(db, `election_config/${key}`), { title, candidateA, candidateB });
    await set(ref(db, `election/${key}/candidateA`), 0);
    await set(ref(db, `election/${key}/candidateB`), 0);

    newRoleTitle.value = "";
    candA.value = "";
    candB.value = "";
    alert(`Added "${title}" successfully!`);
};

// --- ENGINE: CAPTURE EDIT & REMOVE ACTIONS ---
setupRoleList.addEventListener("click", async (e) => {
    if (e.target.classList.contains("delete-btn")) {
        const key = e.target.getAttribute("data-key");
        const roleTitle = e.target.getAttribute("data-title");
        
        if(confirm(`Are you absolutely sure you want to delete "${roleTitle}"? This completely wipes its layout and votes permanently.`)) {
            try {
                await remove(ref(db, `election_config/${key}`));
                await remove(ref(db, `election/${key}`));
            } catch (err) {
                console.error("Delete failure:", err);
            }
        }
    }

    if (e.target.classList.contains("save-btn")) {
        const key = e.target.getAttribute("data-key");
        const inputA = document.getElementById(`editA_${key}`);
        const inputB = document.getElementById(`editB_${key}`);
        
        const newA = inputA.value.trim() || "Candidate A";
        const newB = inputB.value.trim() || "Candidate B";

        try {
            await update(ref(db, `election_config/${key}`), {
                candidateA: newA,
                candidateB: newB
            });
            alert("Candidate names updated successfully!");
        } catch (err) {
            console.error("Update failure:", err);
        }
    }
});

// --- CORE REALTIME SYNC HANDLER ---
function loadDashboard(){
    onValue(ref(db), (snapshot) => {
        const rootData = snapshot.val() || {};
        const configData = rootData.election_config || {};
        const votesData = rootData.election || {};
        
        liveResults.innerHTML = "";
        setupRoleList.innerHTML = "";
        
        // Save the dynamic keys list globally for our Mass Reset handler to read
        currentActiveKeys = Object.keys(configData);
        
        if (currentActiveKeys.length === 0) {
            liveResults.innerHTML = "<p style='text-align:center; color:#777; padding:20px;'>No active positions configured. Go to the Setup tab to add your first position!</p>";
            setupRoleList.innerHTML = "<p style='color:#777; padding:10px;'>No configurations tracked yet.</p>";
            return;
        }

        let totalVotes = 0;

        currentActiveKeys.forEach(key => {
            const role = configData[key];
            const votes = votesData[key] || {};
            
            const a = votes.candidateA || 0;
            const b = votes.candidateB || 0;
            totalVotes += a + b;

            let winner = "Tie";
            if(a > b) winner = role.candidateA;
            if(b > a) winner = role.candidateB;

            // Render Tab 1 View: Live Clean Results Dashboard
            liveResults.innerHTML += `
            <div class="card">
                <h2>${role.title}</h2>
                <div class="row"><span>${role.candidateA}</span><strong>${a}</strong></div>
                <div class="row"><span>${role.candidateB}</span><strong>${b}</strong></div>
                <div class="winner">🏆 Leading: ${winner}</div>
            </div>
            `;

            // Render Tab 2 View: Interactive Setup Management Blocks
            setupRoleList.innerHTML += `
            <div class="setup-management-item">
                <div class="setup-header-line">
                    <h3>📋 ${role.title}</h3>
                    <button class="delete-btn" data-key="${key}" data-title="${role.title}">🗑️ Delete Role</button>
                </div>
                <div class="edit-inputs-row">
                    <div class="input-block">
                        <label>Candidate A Name:</label>
                        <input type="text" id="editA_${key}" value="${role.candidateA}">
                    </div>
                    <div class="input-block">
                        <label>Candidate B Name:</label>
                        <input type="text" id="editB_${key}" value="${role.candidateB}">
                    </div>
                    <button class="save-btn" data-key="${key}">💾 Save Names</button>
                </div>
            </div>
            `;
        });

        // Appends the absolute sum card at the bottom of Dashboard view
        liveResults.innerHTML += `
        <div class="card total">Total Votes Cast: ${totalVotes}</div>
        `;
    });
}
