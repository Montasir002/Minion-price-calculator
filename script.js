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

    // 1. Clear all result areas immediately
    materialsDiv.innerHTML = "Loading recipe...";
    totalDiv.innerHTML = "";
    
    // Clear the new cumulative container
    const cumulativeDiv = document.getElementById("cumulativeMaterials");
    if (cumulativeDiv) {
        cumulativeDiv.innerHTML = "";
    }

    try {
        // 2. Fetch the ignore list and the specific minion recipe
        const [ignoreData, minion] = await Promise.all([
            fetch(LIB_BASE + "ignore_list.json").then(r => r.json()),
            fetch(LIB_BASE + minionSelect.value).then(r => r.json())
        ]);

        const ignoreItems = (ignoreData.ignore || []).map(i => i.item);
        const materialSet = new Set();

        // 3. Identify which items from the recipe need price inputs
        for (let t = 1; t <= minion.max_tier; t++) {
            (minion.tiers[t] || []).forEach(m => {
                if (!ignoreItems.includes(m.item)) {
                    materialSet.add(m.item);
                }
            });
        }

        // 4. Render the Price Input section
        materialsDiv.innerHTML = "<h3>Bazaar Prices</h3>";
        Array.from(materialSet).sort().forEach(itemName => {
            // Find ID in items.json for database lookup
            const itemId = Object.keys(itemDisplayNameMap).find(key => itemDisplayNameMap[key] === itemName) || itemName;
            const price = firebasePrices[itemId] ?? 0;
            
            materialsDiv.innerHTML += `
                <div class="material-row">
                    <span><img src="${getItemImage(itemId)}" class="item-icon">${itemName}</span>
                    <input type="number" data-item="${itemId}" value="${price}">
                </div>`;
        });

        // 5. Add the calculation button
        const btn = document.createElement("button");
        btn.className = "primary-btn";
        btn.textContent = "Calculate Total Cost";
        btn.onclick = () => calculate(minion);
        materialsDiv.appendChild(btn);

    } catch (error) {
        console.error("Error loading minion data:", error);
        materialsDiv.innerHTML = "Error loading recipe. Please try again.";
    }
});


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

    // We need the ignore list again for the cumulative view
    fetch(LIB_BASE + "ignore_list.json")
    .then(r => r.json())
    .then(ignoreData => {
        const ignoreItems = (ignoreData.ignore || []).map(i => i.item);
        const tierResults = {};
        let runningMaterialTotals = {};
        let cumulativeCost = 0;

        for (let t = 1; t <= minion.max_tier; t++) {
            let tierCost = 0;
            (minion.tiers[t] || []).forEach(m => {
                const itemId = Object.keys(itemDisplayNameMap).find(key => itemDisplayNameMap[key] === m.item) || m.item;
                const price = currentPrices[itemId] || 0;
                
                // Track quantity for ALL items
                runningMaterialTotals[m.item] = (runningMaterialTotals[m.item] || 0) + m.qty;
                
                // Only add to cost if NOT in the ignore list
                if (!ignoreItems.includes(m.item)) {
                    tierCost += price * m.qty;
                }
            });

            cumulativeCost += tierCost;
            tierResults[t] = {
                totalCost: cumulativeCost,
                materials: JSON.parse(JSON.stringify(runningMaterialTotals))
            };
        }

        const renderMaterialCard = (tier) => {
            const data = tierResults[tier];
            let html = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h3 style="margin:0;">Total Materials List</h3>
                    <select id="tierSelector" style="padding:8px; border-radius:8px; background:#121212; color:white; border:1px solid #333;">
                        ${Object.keys(tierResults).map(t => `<option value="${t}" ${t == tier ? 'selected' : ''}>Tier ${t}</option>`).join('')}
                    </select>
                </div>
            `;

            Object.entries(data.materials).forEach(([name, qty]) => {
                const itemId = Object.keys(itemDisplayNameMap).find(key => itemDisplayNameMap[key] === name) || name;
                const unitPrice = currentPrices[itemId] || 0;
                const isIgnored = ignoreItems.includes(name);
                const totalItemPrice = isIgnored ? 0 : (unitPrice * qty);

                html += `
                    <div class="material-row" style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom: 1px solid #222;">
                        <span style="display:flex; align-items:center; gap:10px;">
                            <img src="${getItemImage(itemId)}" class="item-icon" style="width:24px; height:24px;">
                            ${name} <span style="color:#888;">x${qty.toLocaleString()}</span>
                        </span>
                        <span style="color: ${isIgnored ? '#666' : 'var(--primary)'}; font-size: 0.9rem;">
                            ${isIgnored ? '---' : totalItemPrice.toLocaleString() + ' coins'}
                        </span>
                    </div>
                `;
            });

            html += `
                <div style="margin-top:15px; padding:12px; background:rgba(0,255,0,0.05); border-radius:8px; border:1px solid rgba(0,255,0,0.2); display:flex; justify-content:space-between; font-weight:bold;">
                    <span>Cumulative Cost</span>
                    <span style="color:var(--primary);">${data.totalCost.toLocaleString()} coins</span>
                </div>
            `;

            const container = document.getElementById("cumulativeMaterials");
            container.innerHTML = html;
            document.getElementById("tierSelector").onchange = (e) => renderMaterialCard(e.target.value);
        };

        renderMaterialCard(minion.max_tier);

        // Update the original Cost Per Tier list
        totalDiv.innerHTML = "<h3>Cost Per Tier</h3>";
        for (let t = 1; t <= minion.max_tier; t++) {
            totalDiv.innerHTML += `
                <div class="tier-row">
                    <span>${minion.name} T${t}</span>
                    <span class="tier-price">${tierResults[t].totalCost.toLocaleString()} coins</span>
                </div>`;
        }
    });
}



modeToggle.onclick = () => {
    document.body.classList.toggle("dark-mode");
    modeToggle.textContent = document.body.classList.contains("dark-mode") ? "☀️" : "🌙";
};

initializeData();
