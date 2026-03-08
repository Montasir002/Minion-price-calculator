const LIB_BASE = "./Minion_recipes/";
const itemImageMap = {};
const itemDisplayNameMap = {}; // Maps "id" -> "Display Name"
const DEFAULT_ITEM_ICON = "https://craftersmc.net/data/assets/logo/newOriginal512.png";

const minionSelect = document.getElementById("minionSelect");
const materialsDiv = document.getElementById("materials");
const totalDiv = document.getElementById("total");
const modeToggle = document.getElementById("modeToggle");

let firebasePrices = {};

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

        firebasePrices = prices || {};

        // GRAB IDs from items.json to find their Display Names and Images
        itemData.forEach(e => { 
            if (e.id) {
                itemImageMap[e.id] = e.url; 
                itemDisplayNameMap[e.id] = e.item; // "acacia_log" -> "Acacia Log"
            }
        });

        // Load list
        fetch(LIB_BASE + "index.json").then(r => r.json()).then(data => {
            minionSelect.innerHTML = '<option value="" disabled selected>Select Minion type</option>';
            data.minions.forEach(m => {
                const opt = document.createElement("option");
                opt.value = m.file; opt.textContent = m.name;
                minionSelect.appendChild(opt);
            });
            minionSelect.disabled = false;
        });
    } catch (err) {
        console.error("Init error:", err);
    }
}

function getItemImage(itemId) { return itemImageMap[itemId] || DEFAULT_ITEM_ICON; }

minionSelect.addEventListener("change", async () => {
    if (!minionSelect.value) return;
    materialsDiv.innerHTML = "Loading recipe...";
    totalDiv.innerHTML = "";

    const [ignoreData, minion] = await Promise.all([
        fetch(LIB_BASE + "ignore_list.json").then(r => r.json()),
        fetch(LIB_BASE + minionSelect.value).then(r => r.json())
    ]);

    const ignoreItems = (ignoreData.ignore || []).map(i => i.item);
    const materialSet = new Set();

    for (let t = 1; t <= minion.max_tier; t++) {
        (minion.tiers[t] || []).forEach(m => {
            if (!ignoreItems.includes(m.item)) materialSet.add(m.item);
        });
    }

    materialsDiv.innerHTML = "<h3>Bazaar Prices</h3>";
    
    // We need to map the Names from the recipe to IDs for the database lookup
    Array.from(materialSet).sort().forEach(itemName => {
        // Find the ID in items.json that belongs to this item name
        const itemId = Object.keys(itemDisplayNameMap).find(key => itemDisplayNameMap[key] === itemName) || itemName;
        const price = firebasePrices[itemId] ?? 0;
        
        materialsDiv.innerHTML += `
            <div class="material-row">
                <span><img src="${getItemImage(itemId)}" class="item-icon">${itemName}</span>
                <input type="number" data-item="${itemId}" value="${price}">
            </div>`;
    });

    const btn = document.createElement("button");
    btn.className = "primary-btn";
    btn.textContent = "Calculate Total Cost";
    btn.onclick = () => calculate(minion);
    materialsDiv.appendChild(btn);
});

function calculate(minion) {
    const currentPrices = {};
    document.querySelectorAll("#materials input").forEach(i => {
        currentPrices[i.dataset.item] = Number(i.value || 0);
    });

    let cumulative = 0;
    totalDiv.innerHTML = "<h3>Cost Per Tier</h3>";
    for (let t = 1; t <= minion.max_tier; t++) {
        let tierCost = 0;
        (minion.tiers[t] || []).forEach(m => {
            // Find the ID so we can get the price
            const itemId = Object.keys(itemDisplayNameMap).find(key => itemDisplayNameMap[key] === m.item) || m.item;
            tierCost += (currentPrices[itemId] || 0) * m.qty;
        });
        cumulative += tierCost;
        totalDiv.innerHTML += `
            <div class="tier-row">
                <span>${minion.name} T${t}</span>
                <span class="tier-price">${cumulative.toLocaleString()} coins</span>
            </div>`;
    }
}

modeToggle.onclick = () => {
    document.body.classList.toggle("dark-mode");
    modeToggle.textContent = document.body.classList.contains("dark-mode") ? "☀️" : "🌙";
};

const helpBanner = document.getElementById("helpBanner");
const closeBanner = document.getElementById("closeBanner");

if (localStorage.getItem("hideBazaarBanner") === "true") {
    if (helpBanner) helpBanner.classList.add("hidden");
}

if (closeBanner) {
    closeBanner.onclick = () => {
        helpBanner.classList.add("hidden");
        localStorage.setItem("hideBazaarBanner", "true");
    };
}

initializeData();
