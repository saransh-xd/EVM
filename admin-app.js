import { db, ref, onValue } from "./firebase.js";
import { set, remove, push } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// DOM Node Selectors
const adminLoginOverlay = document.getElementById("adminLoginOverlay");
const adminPasswordInput = document.getElementById("adminPasswordInput");
const adminSubmitLoginBtn = document.getElementById("adminSubmitLoginBtn");
const adminDashboardContent = document.getElementById("adminDashboardContent");

const liveStatusBadge = document.getElementById("liveStatusBadge");
const masterStatusToggleBtn = document.getElementById("masterStatusToggleBtn");

const newRoleTitle = document.getElementById("newRoleTitle");
const candidateAName = document.getElementById("candidateAName");
const candidateBName = document.getElementById("candidateBName");
const createRoleBtn = document.getElementById("createRoleBtn");
const adminLiveRolesContainer = document.getElementById("adminLiveRolesContainer");

let currentSystemStatus = "open";

// --- 1. SECURE PASSCODE INTERCEPT ENGINE ---
adminSubmitLoginBtn.addEventListener("click", evaluatePasscode);
adminPasswordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") evaluatePasscode();
});

function evaluatePasscode() {
    const enteredValue = adminPasswordInput.value;

    if (enteredValue === "saransh270912") {
        adminLoginOverlay.style.display = "none";
        adminDashboardContent.style.display = "block";
        initializeDashboardSync(); // Initialize Firebase synchronization
    } else {
        alert("❌ Invalid administrative credentials. Access denied.");
        adminPasswordInput.value = "";
        adminPasswordInput.focus();
    }
}

// --- 2. FIREBASE DASHBOARD SYNC (STATUS, ROLES, AND RESULTS) ---
function initializeDashboardSync() {
    // Sync System Toggle Switch State
    onValue(ref(db, "settings/status"), (snapshot) => {
        const status = snapshot.val() || "open";
        currentSystemStatus = status;

        if (status === "closed") {
            liveStatusBadge.textContent = "OFFLINE (CLOSED)";
            liveStatusBadge.style.color = "#dc3545";
            masterStatusToggleBtn.textContent = "Open Election";
            masterStatusToggleBtn.className = "toggle-status-btn";
        } else {
            liveStatusBadge.textContent = "ONLINE (OPEN)";
            liveStatusBadge.style.color = "#28a745";
            masterStatusToggleBtn.textContent = "Close Election";
            masterStatusToggleBtn.className = "toggle-status-btn closed";
        }
    });

    // Sync Live Roles and Live Tally Counts
    onValue(ref(db), (snapshot) => {
        const rootData = snapshot.val() || {};
        const configData = rootData.election_config || {};
        const voteData = rootData.election || {};

        adminLiveRolesContainer.innerHTML = "";
        const keys = Object.keys(configData);

        if (keys.length === 0) {
            adminLiveRolesContainer.innerHTML = `<p style="text-align: center; color: #777; padding: 10px;">The ballot is empty. Add a position above to begin.</p>`;
            return;
        }

        keys.forEach(key => {
            const role = configData[key];
            
            // Fetch live transactional vote states from database node tracks
            const tallyA = (voteData[key] && voteData[key].candidateA) ? voteData[key].candidateA : 0;
            const tallyB = (voteData[key] && voteData[key].candidateB) ? voteData[key].candidateB : 0;

            adminLiveRolesContainer.innerHTML += `
                <div class="role-list-item">
                    <div>
                        <strong style="font-size: 16px; color: #1a237e;">${role.title}</strong>
                        <div style="font-size: 14px; color: #555; margin-top: 5px;">
                            📊 ${role.candidateA}: <strong>${tallyA} votes</strong> | ${role.candidateB}: <strong>${tallyB} votes</strong>
                        </div>
                    </div>
                    <button class="delete-btn" data-key="${key}">Remove</button>
                </div>
            `;
        });
    });
}

// --- 3. MASTER STATUS SWITCH ACTIONS ---
masterStatusToggleBtn.addEventListener("click", async () => {
    const targetStatus = currentSystemStatus === "open" ? "closed" : "open";
    masterStatusToggleBtn.disabled = true;

    try {
        await set(ref(db, "settings/status"), targetStatus);
    } catch (err) {
        console.error(err);
        alert("Failed to update status.");
    } finally {
        masterStatusToggleBtn.disabled = false;
    }
});

// --- 4. DYNAMIC ROLE CREATION DISPATCHER ---
createRoleBtn.addEventListener("click", async () => {
    const title = newRoleTitle.value.trim();
    const candA = candidateAName.value.trim();
    const candB = candidateBName.value.trim();

    if (!title || !candA || !candB) {
        alert("Please complete all configuration fields before posting.");
        return;
    }

    createRoleBtn.disabled = true;
    createRoleBtn.textContent = "Creating...";

    try {
        // Generate a new unique reference node location inside database
        const configListRef = ref(db, "election_config");
        const newPositionRef = push(configListRef);

        await set(newPositionRef, {
            title: title,
            candidateA: candA,
            candidateB: candB
        });

        // Initialize empty base vote tallies
        await set(ref(db, `election/${newPositionRef.key}`), {
            candidateA: 0,
            candidateB: 0
        });

        // Clear forms
        newRoleTitle.value = "";
        candidateAName.value = "";
        candidateBName.value = "";
        alert("🎉 New ballot category posted successfully!");

    } catch (err) {
        console.error(err);
        alert("Failed to create role node.");
    } finally {
        createRoleBtn.disabled = false;
        createRoleBtn.textContent = "Add Position to Ballot";
    }
});

// --- 5. BALLOT ROLE REMOVAL HANDLING ---
adminLiveRolesContainer.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("delete-btn")) return;
    
    const targetKey = e.target.getAttribute("data-key");
    const confirmWipe = confirm("Are you sure you want to completely remove this role and clear its data tallies?");
    
    if (!confirmWipe) return;

    try {
        // Cleanly erase the item out of configuration data and election records completely
        await remove(ref(db, `election_config/${targetKey}`));
        await remove(ref(db, `election/${targetKey}`));
    } catch (err) {
        console.error(err);
        alert("Error while wiping structural nodes.");
    }
});
