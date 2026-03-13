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

    // We will store all tiers' results here to make the dropdown work instantly
    const tierResults = {};
    let runningMaterialTotals = {};
    let cumulativeCost = 0;

    for (let t = 1; t <= minion.max_tier; t++) {
        let tierCost = 0;
        
        // Add current tier materials to the running totals
        (minion.tiers[t] || []).forEach(m => {
            const itemId = Object.keys(itemDisplayNameMap).find(key => itemDisplayNameMap[key] === m.item) || m.item;
            const price = currentPrices[itemId] || 0;
            
            // Track quantity
            runningMaterialTotals[m.item] = (runningMaterialTotals[m.item] || 0) + m.qty;
            tierCost += price * m.qty;
        });

        cumulativeCost += tierCost;

        // Save a "snapshot" of materials and cost for this specific tier
        tierResults[t] = {
            totalCost: cumulativeCost,
            materials: JSON.parse(JSON.stringify(runningMaterialTotals))
        };
    }

    // Function to render the Materials Card based on selected Tier
    const renderMaterialCard = (tier) => {
        const data = tierResults[tier];
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3>Total Materials List</h3>
                <select id="tierSelector" style="padding:5px; border-radius:5px; background:#333; color:white;">
                    ${Object.keys(tierResults).map(t => `<option value="${t}" ${t == tier ? 'selected' : ''}>Tier ${t}</option>`).join('')}
                </select>
            </div>
            <hr style="border:0; border-top:1px solid #333; margin:10px 0;">
        `;

        Object.entries(data.materials).forEach(([name, qty]) => {
            const itemId = Object.keys(itemDisplayNameMap).find(key => itemDisplayNameMap[key] === name) || name;
            const unitPrice = currentPrices[itemId] || 0;
            const totalItemPrice = unitPrice * qty;

            html += `
                <div class="material-row" style="display:flex; justify-content:space-between; font-size:0.9rem;">
                    <span>${name} x${qty.toLocaleString()}</span>
                    <span style="color: var(--primary);">${totalItemPrice.toLocaleString()} coins</span>
                </div>
            `;
        });

        html += `
            <div style="margin-top:15px; padding-top:10px; border-top:2px solid var(--primary); display:flex; justify-content:space-between; font-weight:bold;">
                <span>Total Cost</span>
                <span>${data.totalCost.toLocaleString()} coins</span>
            </div>
        `;

        const container = document.getElementById("cumulativeMaterials");
        container.innerHTML = html;

        // Add listener to the new dropdown
        document.getElementById("tierSelector").onchange = (e) => renderMaterialCard(e.target.value);
    };

    // Initial render for the Max Tier
    renderMaterialCard(minion.max_tier);

    // Also update your original Cost Per Tier list
    totalDiv.innerHTML = "<h3>Cost Per Tier</h3>";
    for (let t = 1; t <= minion.max_tier; t++) {
        totalDiv.innerHTML += `
            <div class="tier-row">
                <span>${minion.name} T${t}</span>
                <span class="tier-price">${tierResults[t].totalCost.toLocaleString()} coins</span>
            </div>`;
    }
}


modeToggle.onclick = () => {
    document.body.classList.toggle("dark-mode");
    modeToggle.textContent = document.body.classList.contains("dark-mode") ? "☀️" : "🌙";
};

initializeData();
