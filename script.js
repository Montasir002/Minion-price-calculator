const LIB_BASE = "./Minion_recipes/";
const itemImageMap = {};
const DEFAULT_ITEM_ICON = "https://craftersmc.net/data/assets/logo/newOriginal512.png";

const minionSelect = document.getElementById("minionSelect");
const materialsDiv = document.getElementById("materials");
const totalDiv = document.getElementById("total");
const modeToggle = document.getElementById("modeToggle");

let firebasePrices = {};
let isPricesLoaded = false;

async function initializeData() {
    // Wait for Firebase to signal readiness
    const awaitFirebase = () => {
        return new Promise((resolve) => {
            const check = () => {
                if (window.firebaseRemoteReady && typeof window.loadPricesFromFirebase === 'function') {
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    };

    try {
        await awaitFirebase();
        const [itemData, prices] = await Promise.all([
            fetch(LIB_BASE + "items.json").then(r => r.json()),
            window.loadPricesFromFirebase()
        ]);

        itemData.forEach(e => { if (e.item) itemImageMap[e.item] = e.url; });
        firebasePrices = prices || {};
        isPricesLoaded = true;

        // Load the dropdown list once prices are ready
        loadMinionList();
        
        minionSelect.options[0].textContent = "Select Minion type";
    } catch (err) {
        console.error("Initialization failed:", err);
    }
}

function loadMinionList() {
    fetch(LIB_BASE + "index.json")
        .then(r => r.json())
        .then(data => {
            minionSelect.innerHTML = '<option value="" disabled selected>Select Minion type</option>';
            data.minions.forEach(m => {
                const opt = document.createElement("option");
                opt.value = m.file; 
                opt.textContent = m.name;
                minionSelect.appendChild(opt);
            });
        });
}

function getItemImage(itemName) { return itemImageMap[itemName] || DEFAULT_ITEM_ICON; }

minionSelect.addEventListener("change", loadMinion);

function loadMinion() {
    if (!minionSelect.value) return;
    materialsDiv.innerHTML = "Processing recipe...";
    totalDiv.innerHTML = "";

    Promise.all([
        fetch(LIB_BASE + "ignore_list.json").then(r => r.json()),
        fetch(LIB_BASE + minionSelect.value).then(r => r.json())
    ]).then(([ignoreData, minion]) => {
        const ignoreItems = (ignoreData.ignore || []).map(i => i.item);
        const materialSet = new Set();

        for (let t = 1; t <= minion.max_tier; t++) {
            (minion.tiers[t] || []).forEach(m => {
                if (!ignoreItems.includes(m.item)) materialSet.add(m.item);
            });
        }

        materialsDiv.innerHTML = "<h3>Enter Bazaar Prices</h3>";
        Array.from(materialSet).sort().forEach(item => {
            const price = firebasePrices[item] ?? firebasePrices[item.replace(/ /g, "_")] ?? 0;
            materialsDiv.innerHTML += `
                <div class="material-row">
                    <span><img src="${getItemImage(item)}" class="item-icon"> ${item}</span>
                    <input type="number" min="0" data-item="${item}" value="${price}">
                </div>`;
        });

        const calcBtn = document.createElement("button");
        calcBtn.className = "primary-btn";
        calcBtn.textContent = "Calculate Prices";
        calcBtn.onclick = () => calculateTierPrices(minion);
        materialsDiv.appendChild(calcBtn);
    });
}

function calculateTierPrices(minion) {
    const prices = {};
    document.querySelectorAll("#materials input").forEach(i => { 
        prices[i.dataset.item] = Number(i.value || 0); 
    });

    let runningTotal = 0;
    totalDiv.innerHTML = "<h3>Craft Cost Per Tier</h3>";

    for (let t = 1; t <= minion.max_tier; t++) {
        let tierCost = 0;
        for (const m of minion.tiers[t] || []) {
            tierCost += (prices[m.item] || 0) * m.qty;
        }
        runningTotal += tierCost;

        totalDiv.innerHTML += `
            <div class="tier-row">
                <span>${minion.name} T${t}</span>
                <span class="tier-price">${runningTotal.toLocaleString()} coins</span>
            </div>`;
    }
}

modeToggle.onclick = () => {
    document.body.classList.toggle("dark-mode");
    modeToggle.textContent = document.body.classList.contains("dark-mode") ? "☀️" : "🌙";
};

// --- Banner Logic (Unified to prevent crashes) ---
const helpBanner = document.getElementById("helpBanner");
const closeBanner = document.getElementById("closeBanner");

if (localStorage.getItem("hideBazaarBanner") === "true") {
    if (helpBanner) helpBanner.classList.add("hidden");
}

if (closeBanner && helpBanner) {
    closeBanner.onclick = () => {
        helpBanner.classList.add("hidden");
        localStorage.setItem("hideBazaarBanner", "true");
    };
}

initializeData();
