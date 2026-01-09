const LIB_BASE = "./Minion_recipes/";
const itemImageMap = {};
const DEFAULT_ITEM_ICON = "https://craftersmc.net/data/assets/logo/newOriginal512.png";

const minionSelect = document.getElementById("minionSelect");
const materialsDiv = document.getElementById("materials");
const totalDiv = document.getElementById("total");
const modeToggle = document.getElementById("modeToggle");

// Initial state: Disable the dropdown
minionSelect.disabled = true;
const defaultOption = minionSelect.options[0];
defaultOption.textContent = "Syncing with Bazaar... ⏳";

let firebasePrices = {};
let isPricesLoaded = false;

/**
 * 1. Initialize Data
 * Polls for Firebase and fetches all necessary data
 */
async function initializeData() {
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

        // Map icons
        itemData.forEach(e => { if (e.item) itemImageMap[e.item] = e.url; });
        
        // Load prices
        firebasePrices = prices || {};
        isPricesLoaded = true;

        // UNLOCK UI: Enable the dropdown
        minionSelect.disabled = false;
        defaultOption.textContent = "Select Minion type";
        console.log("Database Sync Complete.");
    } catch (err) {
        console.error("Initialization failed:", err);
        // Fallback: Unlock anyway so they can enter manual prices
        minionSelect.disabled = false;
        defaultOption.textContent = "Select Minion (Offline Mode)";
    }
}

initializeData();

function getItemImage(itemName) { return itemImageMap[itemName] || DEFAULT_ITEM_ICON; }

// Load Minion List
fetch(LIB_BASE + "index.json").then(r => r.json()).then(data => {
    data.minions.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.file; opt.textContent = m.name;
        minionSelect.appendChild(opt);
    });
});

// Load minion data automatically when the selection changes
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
                if (!m.item.includes("Minion") && !ignoreItems.includes(m.item)) materialSet.add(m.item);
            });
        }

        materialsDiv.innerHTML = "<h3>Enter Bazaar Prices</h3>";
        materialSet.forEach(item => {
            // Priority: Exact Match -> Underscore Match -> 0
            const price = firebasePrices[item] ?? firebasePrices[item.replace(/ /g, "_")] ?? 0;

            materialsDiv.innerHTML += `
                <div class="material-row" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                    <span style="display:flex; align-items:center;">
                        <img src="${getItemImage(item)}" class="item-icon" style="width:24px; height:24px; margin-right:10px; image-rendering:pixelated;">
                        ${item}
                    </span>
                    <input type="number" min="0" data-item="${item}" value="${price}" placeholder="0" style="width:80px;">
                </div>`;
        });

        const calcBtn = document.createElement("button");
        calcBtn.className = "primary-btn";
        calcBtn.style.width = "100%";
        calcBtn.style.marginTop = "15px";
        calcBtn.textContent = "Calculate Prices";
        calcBtn.onclick = () => calculateTierPrices(minion);
        materialsDiv.appendChild(calcBtn);
    });
}

async function calculateTierPrices(minion) {
    const currentPrices = {};
    document.querySelectorAll("#materials input").forEach(i => { 
        currentPrices[i.dataset.item] = Number(i.value || 0); 
    });

    let runningTotal = 0;
    totalDiv.innerHTML = "<h3>Craft Cost Per Tier</h3>";

    for (let t = 1; t <= minion.max_tier; t++) {
        let tierCost = 0;
        for (const m of minion.tiers[t] || []) {
            tierCost += (currentPrices[m.item] || 0) * m.qty;
        }
        runningTotal += tierCost;

        totalDiv.innerHTML += `
            <div class="tier-row" style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #444;">
                <span>${minion.name} T${t}</span>
                <span class="tier-price" style="font-weight:bold; color:#00ff00;">${runningTotal.toLocaleString()} coins</span>
            </div>`;
    }
}

modeToggle.onclick = () => {
    document.body.classList.toggle("dark-mode");
    modeToggle.textContent = document.body.classList.contains("dark-mode") ? "☀️" : "🌙";
};
