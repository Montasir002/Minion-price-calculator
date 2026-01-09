const LIB_BASE = "./Minion_recipes/";
const itemImageMap = {};
const DEFAULT_ITEM_ICON = "https://craftersmc.net/data/assets/logo/newOriginal512.png";

const minionSelect = document.getElementById("minionSelect");
const materialsDiv = document.getElementById("materials");
const totalDiv = document.getElementById("total");
const modeToggle = document.getElementById("modeToggle");

let firebasePrices = {};
let isPricesLoaded = false;

// 1. Initialize Data
async function initializeData() {
    try {
        console.log("Fetching Firebase Prices...");
        const [itemData, prices] = await Promise.all([
            fetch(LIB_BASE + "items.json").then(r => r.json()),
            window.loadPricesFromFirebase ? window.loadPricesFromFirebase() : Promise.resolve({})
        ]);

        itemData.forEach(e => { if (e.item) itemImageMap[e.item] = e.url; });
        
        firebasePrices = prices || {};
        isPricesLoaded = true;
        
        console.log("Firebase Prices Loaded:", firebasePrices); // CHECK THIS IN CONSOLE
    } catch (err) {
        console.error("Initialization failed:", err);
        isPricesLoaded = true; 
    }
}

initializeData();

function getItemImage(itemName) { return itemImageMap[itemName] || DEFAULT_ITEM_ICON; }

// 2. Load Minion List
fetch(LIB_BASE + "index.json").then(r => r.json()).then(data => {
    data.minions.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.file; opt.textContent = m.name;
        minionSelect.appendChild(opt);
    });
});

minionSelect.addEventListener("change", loadMinion);

function loadMinion() {
    if (!minionSelect.value) return;

    // Wait if Firebase isn't ready
    if (!isPricesLoaded) {
        materialsDiv.innerHTML = "<div class='card'>Syncing with Bazaar...</div>";
        setTimeout(loadMinion, 500);
        return;
    }

    materialsDiv.innerHTML = "Loading recipe...";
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
            // MATCHING LOGIC: 
            // We look for the exact name (e.g., "Acacia Log")
            // If that fails, we check for underscores (e.g., "Acacia_Log")
            const price = firebasePrices[item] ?? firebasePrices[item.replace(/ /g, "_")] ?? 0;

            materialsDiv.innerHTML += `
                <div class="material-row" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                    <span style="display:flex; align-items:center;">
                        <img src="${getItemImage(item)}" class="item-icon" style="width:24px; height:24px; margin-right:10px;">
                        ${item}
                    </span>
                    <input type="number" min="0" data-item="${item}" value="${price}" placeholder="0" style="width:80px;">
                </div>`;
        });

        const btn = document.createElement("button");
        btn.className = "primary-btn";
        btn.style.width = "100%";
        btn.style.marginTop = "15px";
        btn.textContent = "Calculate Prices";
        btn.onclick = () => calculateTierPrices(minion);
        materialsDiv.appendChild(btn);
    });
}

async function calculateTierPrices(minion) {
    const prices = {};
    document.querySelectorAll("#materials input").forEach(i => { prices[i.dataset.item] = Number(i.value || 0); });

    let runningTotal = 0;
    totalDiv.innerHTML = "<h3>Craft Cost Per Tier</h3>";

    for (let t = 1; t <= minion.max_tier; t++) {
        let tierCost = 0;
        for (const m of minion.tiers[t] || []) {
            tierCost += (prices[m.item] || 0) * m.qty;
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
