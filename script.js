const LIB_BASE = "./Minion_recipes/";
const itemImageMap = {};
const DEFAULT_ITEM_ICON = "https://craftersmc.net/data/assets/logo/newOriginal512.png";

const minionSelect = document.getElementById("minionSelect");
const materialsDiv = document.getElementById("materials");
const totalDiv = document.getElementById("total");
const modeToggle = document.getElementById("modeToggle");

let firebasePrices = {};
let isPricesLoaded = false;

/**
 * 1. Initialize Data
 * Loads item icons and Firebase prices at the same time
 */
async function initializeData() {
  try {
    const [itemRes, prices] = await Promise.all([
      fetch(LIB_BASE + "items.json").then(r => r.json()),
      window.loadPricesFromFirebase ? window.loadPricesFromFirebase() : Promise.resolve({})
    ]);

    // Map item names to image URLs
    itemRes.forEach(e => { if (e.item) itemImageMap[e.item] = e.url; });
    
    // Store prices from Firestore
    firebasePrices = prices || {};
    isPricesLoaded = true;
    console.log("Database synced successfully.");
  } catch (err) {
    console.error("Initialization error:", err);
    isPricesLoaded = true; // Set to true so the UI doesn't stay stuck
  }
}

initializeData();

function getItemImage(itemName) { return itemImageMap[itemName] || DEFAULT_ITEM_ICON; }

/**
 * 2. Load the list of Minions into the dropdown
 */
fetch(LIB_BASE + "index.json").then(r => r.json()).then(data => {
  data.minions.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.file; opt.textContent = m.name;
    minionSelect.appendChild(opt);
  });
});

minionSelect.addEventListener("change", loadMinion);

/**
 * 3. Generate the material input list
 */
function loadMinion() {
  if (!minionSelect.value) return;
  
  // If database isn't ready, wait half a second
  if (!isPricesLoaded) {
    materialsDiv.innerHTML = "Syncing prices...";
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

    // Find all unique materials needed for all tiers
    for (let t = 1; t <= minion.max_tier; t++) {
      (minion.tiers[t] || []).forEach(m => {
        if (!m.item.includes("Minion") && !ignoreItems.includes(m.item)) {
          materialSet.add(m.item);
        }
      });
    }

    materialsDiv.innerHTML = "<h3>Enter Bazaar Prices</h3>";
    materialSet.forEach(item => {
      // Logic: Match "Acacia Log" to Firestore field "Acacia_Log" or "Acacia Log"
      const dbKey = item.replace(/ /g, "_");
      const priceValue = firebasePrices[dbKey] ?? firebasePrices[item] ?? "";

      materialsDiv.innerHTML += `
        <div class="material-row">
          <span><img src="${getItemImage(item)}" class="item-icon">${item}</span>
          <input 
            type="number" 
            min="0" 
            data-item="${item}" 
            value="${priceValue}" 
            placeholder="0"
          >
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

/**
 * 4. Calculate final crafting costs
 */
async function calculateTierPrices(minion) {
  const currentInputs = {};
  document.querySelectorAll("#materials input").forEach(input => { 
    currentInputs[input.dataset.item] = Number(input.value || 0); 
  });

  let runningTotal = 0;
  totalDiv.innerHTML = "<h3>Craft Cost Per Tier</h3>";

  for (let t = 1; t <= minion.max_tier; t++) {
    let tierCost = 0;
    for (const m of minion.tiers[t] || []) {
      // Use user input if available, else 0
      tierCost += (currentInputs[m.item] || 0) * m.qty;
    }
    runningTotal += tierCost;

    totalDiv.innerHTML += `
      <div class="tier-row">
        <span>${minion.name} T${t}</span>
        <span class="tier-price">${runningTotal.toLocaleString()} coins</span>
      </div>`;
  }
}

// Dark Mode Toggle
modeToggle.onclick = () => {
  document.body.classList.toggle("dark-mode");
  modeToggle.textContent = document.body.classList.contains("dark-mode") ? "☀️" : "🌙";
};
