const LIB_BASE = "./Minion_recipes/";
const itemImageMap = {};
const DEFAULT_ITEM_ICON = "https://craftersmc.net/data/assets/logo/newOriginal512.png";

const minionSelect = document.getElementById("minionSelect");
const materialsDiv = document.getElementById("materials");
const totalDiv = document.getElementById("total");
const modeToggle = document.getElementById("modeToggle");

let firebasePrices = {};
let isPricesLoaded = false;

// 1. Initialize Data (Wait for Firebase)
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
        itemData.forEach(e => { if (e.item) itemImageMap[e.item] = e.url; });
        firebasePrices = prices || {};
        isPricesLoaded = true;
        minionSelect.disabled = false;
        minionSelect.options[0].textContent = "Select Minion type";
    } catch (err) {
        console.error("Initialization failed:", err);
        minionSelect.disabled = false;
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

// Helper to get Zombie Minion costs for Revenant calculation
async function getZombieMinionCosts(prices) {
    const res = await fetch(LIB_BASE + "zombie_minion.json");
    const zombie = await res.json();
    let costs = { 0: 0 }; // Tier 0 costs 0
    let runningTotal = 0;
    
    for (let t = 1; t <= zombie.max_tier; t++) {
        let tierCost = 0;
        zombie.tiers[t].forEach(ing => {
            tierCost += (prices[ing.item] || 0) * ing.qty;
        });
        runningTotal += tierCost;
        costs[t] = runningTotal;
    }
    return costs;
}

async function loadMinion() {
    if (!minionSelect.value) return;
    materialsDiv.innerHTML = "Loading recipe...";
    totalDiv.innerHTML = "";

    const [ignoreData, minion] = await Promise.all([
        fetch(LIB_BASE + "ignore_list.json").then(r => r.json()),
        fetch(LIB_BASE + minionSelect.value).then(r => r.json())
    ]);

    const ignoreItems = (ignoreData.ignore || []).map(i => i.item);
    const materialSet = new Set();
    
    // Scan recipe for materials (ignoring other Minion items)
    for (let t = 1; t <= minion.max_tier; t++) {
        (minion.tiers[t] || []).forEach(m => {
            if (!m.item.includes("Minion") && !ignoreItems.includes(m.item)) materialSet.add(m.item);
        });
    }

    // Special Case: If it's Revenant, we also need Zombie materials (Rotten Flesh, Iron Ingot)
    if (minion.name === "Revenant Minion") {
        materialSet.add("Rotten Flesh");
        materialSet.add("Iron Ingot");
    }

    materialsDiv.innerHTML = "<h3>Enter Bazaar Prices</h3>";
    Array.from(materialSet).sort().forEach(item => {
        const price = firebasePrices[item] ?? firebasePrices[item.replace(/ /g, "_")] ?? 0;
        materialsDiv.innerHTML += `
            <div class="material-row" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                <span style="display:flex; align-items:center;">
                    <img src="${getItemImage(item)}" class="item-icon" style="width:24px; height:24px; margin-right:10px;">
                    ${item}
                </span>
                <input type="number" min="0" data-item="${item}" value="${price}" style="width:80px;">
            </div>`;
    });

    const btn = document.createElement("button");
    btn.className = "primary-btn";
    btn.style.width = "100%";
    btn.textContent = "Calculate Prices";
    btn.onclick = () => calculateTierPrices(minion);
    materialsDiv.appendChild(btn);
}

async function calculateTierPrices(minion) {
    const prices = {};
    document.querySelectorAll("#materials input").forEach(i => { prices[i.dataset.item] = Number(i.value || 0); });

    let runningTotal = 0;
    totalDiv.innerHTML = "<h3>Craft Cost Per Tier</h3>";

    // Pre-calculate Zombie costs if needed
    let zombieCosts = {};
    if (minion.name === "Revenant Minion") {
        zombieCosts = await getZombieMinionCosts(prices);
    }

    for (let t = 1; t <= minion.max_tier; t++) {
        let tierCost = 0;
        for (const m of minion.tiers[t] || []) {
            if (prices[m.item]) {
                tierCost += prices[m.item] * m.qty;
            } 
            // Handle Zombie Minion requirement in Revenant recipe
            else if (m.item.startsWith("Zombie Minion")) {
                const tier = parseInt(m.item.split(" ").pop()) || 1; // Gets 1 from "Zombie Minion 1"
                // Add the cost of that Zombie Minion tier
                tierCost += zombieCosts[tier] || 0;
            }
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
