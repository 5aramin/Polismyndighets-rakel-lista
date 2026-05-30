import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBo3Bw1lh4fvHGbMT41bEJ4f-4389kqfM8",
  authDomain: "polismyndighets-rakel.firebaseapp.com",
  projectId: "polismyndighets-rakel",
  storageBucket: "polismyndighets-rakel.firebasestorage.app",
  messagingSenderId: "779611072872",
  appId: "1:779611072872:web:6db7ff4800c7d9552ecedd",
  measurementId: "G-7EYX8PEPWR",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const membersRef = collection(db, "members");

const loginView = document.querySelector("#loginView");
const appView = document.querySelector("#appView");
const loginForm = document.querySelector("#loginForm");
const usernameInput = document.querySelector("#usernameInput");
const passwordInput = document.querySelector("#passwordInput");
const loginError = document.querySelector("#loginError");
const logoutBtn = document.querySelector("#logoutBtn");

const membersEl = document.querySelector("#members");
const emptyState = document.querySelector("#emptyState");
const memberCount = document.querySelector("#memberCount");
const template = document.querySelector("#memberTemplate");
const form = document.querySelector("#memberForm");
const searchInput = document.querySelector("#searchInput");
const filterInputs = [...document.querySelectorAll(".filter-panel input[type='checkbox']")];
const clearFiltersBtn = document.querySelector("#clearFiltersBtn");

const sessionKey = "server-panel-authenticated";
const username = "Medlemsansvarig123";
const password = "Polismyndigheten123";
const policeRanks = [
  "Rikspolischef",
  "Bitr. Rikspolischef",
  "Polisdirektör",
  "Bitr. Polisdirektör",
  "Regions Chef",
  "Polismästare",
  "Polisöverintendent",
  "Polisledning",
  "Veckans kollega",
  "Polisintendent",
  "Sekreterare",
  "Kommissarie",
  "Administration",
  "Inspektör",
  "Polisassistent 4",
  "Polisassistent",
  "Aspirant",
  "Studerande",
];

const legacyRoles = {
  Polismyndigheten: "Polisassistent",
  Serverledning: "Polisledning",
  Civilperson: "Studerande",
  Räddningstjänst: "Studerande",
  Sjukvården: "Studerande",
  SOS: "Studerande",
  Utvecklingsteam: "Administration",
};

let members = [];
let unsubscribeMembers = null;

function normalizeStatus(status) {
  return status === "Tillgänglig" ? "Ledig" : status;
}

function normalizeRole(role) {
  if (policeRanks.includes(role)) return role;
  return legacyRoles[role] || "Studerande";
}

function normalizeMember(member) {
  return {
    id: member.id || crypto.randomUUID(),
    name: member.name || "",
    discord: member.discord || "",
    role: normalizeRole(member.role),
    status: normalizeStatus(member.status || "Aktiv"),
    inactivityWarning: Boolean(member.inactivityWarning),
  };
}

function showApp() {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  startMembersSync();
  renderMembers();
}

function showLogin() {
  appView.classList.add("hidden");
  loginView.classList.remove("hidden");
  passwordInput.value = "";
  usernameInput.focus();
}

async function offerPasswordSave() {
  if (!("credentials" in navigator) || typeof PasswordCredential === "undefined") {
    return;
  }

  try {
    const credential = new PasswordCredential(loginForm);
    await navigator.credentials.store(credential);
  } catch {
    // Some browsers only show their built-in prompt and do not expose a result.
  }
}

function getFilteredMembers() {
  const queryText = searchInput.value.trim().toLowerCase();
  const selectedRoles = filterInputs
    .filter((input) => input.name === "role" && input.checked)
    .map((input) => input.value);
  const selectedStatuses = filterInputs
    .filter((input) => input.name === "status" && input.checked)
    .map((input) => input.value);
  const warningOnly = document.querySelector("#warningFilter").checked;

  return members.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(queryText) ||
      member.discord.toLowerCase().includes(queryText);
    const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(member.role);
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(member.status);
    const matchesWarning = !warningOnly || member.inactivityWarning;

    return matchesSearch && matchesRole && matchesStatus && matchesWarning;
  });
}

function renderMembers() {
  const filteredMembers = getFilteredMembers();
  membersEl.innerHTML = "";
  memberCount.textContent = `${filteredMembers.length} / ${members.length}`;
  emptyState.classList.toggle("hidden", filteredMembers.length !== 0);

  filteredMembers.forEach((member) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".member-card");
    const dot = node.querySelector(".status-dot");
    const warningButton = node.querySelector(".inactivity-warning");

    card.dataset.memberId = member.id;
    card.classList.toggle("has-warning", member.inactivityWarning);
    node.querySelector(".member-name").textContent = member.name;
    node.querySelector(".member-role").textContent = member.role;
    node.querySelector(".member-discord").textContent = member.discord;
    dot.dataset.status = member.status;

    node.querySelector(".remove").addEventListener("click", async () => {
      await deleteDoc(doc(db, "members", member.id));
    });

    warningButton.classList.toggle("is-active", member.inactivityWarning);
    warningButton.addEventListener("click", async () => {
      await updateDoc(doc(db, "members", member.id), {
        inactivityWarning: !member.inactivityWarning,
      });
    });

    const activeButton = node.querySelector(".status-active");
    const inactiveButton = node.querySelector(".status-inactive");
    const availableButton = node.querySelector(".status-available");

    activeButton.classList.toggle("is-selected", member.status === "Aktiv");
    inactiveButton.classList.toggle("is-selected", member.status === "Inaktiv");
    availableButton.classList.toggle("is-selected", member.status === "Ledig");

    activeButton.addEventListener("click", () => setStatus(member, "Aktiv"));
    inactiveButton.addEventListener("click", () => setStatus(member, "Inaktiv"));
    availableButton.addEventListener("click", () => setStatus(member, "Ledig"));

    membersEl.append(node);
  });
}

function startMembersSync() {
  if (unsubscribeMembers) return;

  const membersQuery = query(membersRef, orderBy("createdAt", "desc"));
  unsubscribeMembers = onSnapshot(
    membersQuery,
    (snapshot) => {
      members = snapshot.docs.map((memberDoc) =>
        normalizeMember({
          id: memberDoc.id,
          ...memberDoc.data(),
        })
      );
      renderMembers();
    },
    (error) => {
      console.error("Firestore sync failed:", error);
      emptyState.textContent = "Kunde inte ansluta till databasen. Kontrollera Firestore-inställningarna.";
      emptyState.classList.remove("hidden");
    }
  );
}

async function setStatus(member, status) {
  await updateDoc(doc(db, "members", member.id), { status });
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const validLogin = usernameInput.value.trim() === username && passwordInput.value === password;
  if (!validLogin) {
    loginError.textContent = "Fel användarnamn eller lösenord.";
    return;
  }

  loginError.textContent = "";
  await offerPasswordSave();
  localStorage.setItem(sessionKey, "true");
  showApp();
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem(sessionKey);
  showLogin();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = normalizeMember({
    name: document.querySelector("#nameInput").value.trim(),
    discord: document.querySelector("#rakelInput").value.trim(),
    role: document.querySelector("#roleInput").value,
    status: document.querySelector("#statusInput").value,
  });

  if (!formData.name || !formData.discord) return;

  await addDoc(membersRef, {
    name: formData.name,
    discord: formData.discord,
    role: formData.role,
    status: formData.status,
    inactivityWarning: false,
    createdAt: serverTimestamp(),
  });

  form.reset();
  document.querySelector("#statusInput").value = "Aktiv";
  document.querySelector("#roleInput").value = "Rikspolischef";
});

searchInput.addEventListener("input", renderMembers);
filterInputs.forEach((input) => input.addEventListener("change", renderMembers));

clearFiltersBtn.addEventListener("click", () => {
  filterInputs.forEach((input) => {
    input.checked = false;
  });
  renderMembers();
});

if (localStorage.getItem(sessionKey) === "true") {
  showApp();
} else {
  showLogin();
}
