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


async function calculate(minion) {
    const materialsDiv = document.getElementById("materials");
    const totalDiv = document.getElementById("total");
    const cumulativeDiv = document.getElementById("cumulativeMaterials");

    // 1. Get user-input prices from the UI
    const currentPrices = {};
    document.querySelectorAll("#materials input").forEach(i => {
        currentPrices[i.dataset.item] = Number(i.value || 0);
    });

    try {
        // 2. Use the variables already defined in your global scope
        const ignoreRes = await fetch(LIB_BASE + "ignore_list.json");
        const itemsRes = await fetch("./Minion_recipes/items.json");
        
        const ignoreData = await ignoreRes.json();
        const itemsJson = await itemsRes.json();
        
        const ignoreItems = (ignoreData.ignore || []).map(i => i.item);
        const tierResults = {};
        let runningMaterialTotals = {};
        let cumulativeCost = 0;

        // Map icons for quick lookup
        const localImageMap = {};
        itemsJson.forEach(i => { if(i.item && i.url) localImageMap[i.item] = i.url; });

        // 3. Logic for Tiers
        for (let t = 1; t <= minion.max_tier; t++) {
            let tierCost = 0;
            (minion.tiers[t] || []).forEach(m => {
                const itemId = Object.keys(itemDisplayNameMap).find(key => itemDisplayNameMap[key] === m.item) || m.item;
                const price = currentPrices[itemId] || 0;
                
                runningMaterialTotals[m.item] = (runningMaterialTotals[m.item] || 0) + m.qty;
                
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

        // 4. Render the UI
        const renderMaterialCard = (tier) => {
            const data = tierResults[tier];
            let html = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h3 style="margin:0; font-size:1.2rem;">Total Materials</h3>
                    <select id="tierSelector" style="padding:6px 12px; border-radius:8px; border:1px solid #ccc; font-family:inherit; cursor:pointer; background-color: transparent; color: inherit;">
                        ${Object.keys(tierResults).map(t => `<option value="${t}" ${t == tier ? 'selected' : ''} style="color:black;">Tier ${t}</option>`).join('')}
                    </select>
                </div>
            `;

            Object.entries(data.materials).forEach(([name, qty]) => {
                const itemId = Object.keys(itemDisplayNameMap).find(key => itemDisplayNameMap[key] === name) || name;
                const unitPrice = currentPrices[itemId] || 0;
                const isIgnored = ignoreItems.includes(name);
                const totalItemPrice = isIgnored ? 0 : (unitPrice * qty);
                const imgUrl = localImageMap[name] || getItemImage(itemId);

                html += `
                    <div class="material-row" style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid rgba(128,128,128,0.1);">
                        <span style="display:flex; align-items:center; gap:10px;">
                            <img src="${imgUrl}" class="item-icon" style="width:24px; height:24px;" onerror="this.src='https://craftersmc.net/data/assets/logo/newOriginal512.png'">
                            ${name} <span style="color:#888;">x${qty.toLocaleString()}</span>
                        </span>
                        <span style="color: ${isIgnored ? '#888' : 'var(--primary)'}; font-weight: 600;">
                            ${isIgnored ? '0 coins' : totalItemPrice.toLocaleString() + ' coins'}
                        </span>
                    </div>
                `;
            });

            html += `
                <div style="margin-top:20px; padding:15px; background:rgba(0,255,0,0.08); border-radius:10px; border:1px solid rgba(0,255,0,0.2); display:flex; justify-content:space-between; font-weight:bold; font-size:1.1rem;">
                    <span>Cumulative Cost</span>
                    <span style="color:var(--primary);">${data.totalCost.toLocaleString()} coins</span>
                </div>
            `;

            cumulativeDiv.innerHTML = html;
            document.getElementById("tierSelector").onchange = (e) => renderMaterialCard(e.target.value);
        };

        renderMaterialCard(minion.max_tier);

        // Update the Cost Per Tier list
        totalDiv.innerHTML = "<h3>Cost Per Tier</h3>";
        for (let t = 1; t <= minion.max_tier; t++) {
            totalDiv.innerHTML += `
                <div class="tier-row">
                    <span>${minion.name} T${t}</span>
                    <span class="tier-price">${tierResults[t].totalCost.toLocaleString()} coins</span>
                </div>`;
        }

    } catch (err) {
        console.error("Calculation Error:", err);
        alert("Failed to calculate. Check if files are missing.");
    }
}




modeToggle.onclick = () => {
    document.body.classList.toggle("dark-mode");
    modeToggle.textContent = document.body.classList.contains("dark-mode") ? "☀️" : "🌙";
};

initializeData();
