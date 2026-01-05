const LIB_BASE = "./Minion_recipes/";
const minionCache = {};
const itemImageMap = {};

// DEFAULT ICON (used if url missing)
const DEFAULT_ITEM_ICON =
  "https://craftersmc.wiki.gg/images/thumb/Inventory_slot.png/16px-Inventory_slot.png";

// DOM
const minionSelect = document.getElementById("minionSelect");
const materialsDiv = document.getElementById("materials");
const totalDiv = document.getElementById("total");
const loadBtn = document.getElementById("loadBtn");

/* =========================
   LOAD ITEM IMAGES
========================= */
fetch(LIB_BASE + "items.json")
  .then(r => r.json())
  .then(data => {
    data.forEach(e => {
      if (e.item) itemImageMap[e.item] = e.url;
    });
  })
  .catch(() => console.warn("items.json not found, using default icons"));

function getItemImage(itemName) {
  return itemImageMap[itemName] || DEFAULT_ITEM_ICON;
}

/* =========================
   LOAD MINION LIST
========================= */
fetch(LIB_BASE + "index.json")
  .then(r => {
    if (!r.ok) throw new Error("Index JSON not found");
    return r.json();
  })
  .then(data => {
    data.minions.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.file;
      opt.textContent = m.name;
      minionSelect.appendChild(opt);
    });
  })
  .catch(() => alert("Failed to load minion list"));

loadBtn.onclick = loadMinion;

/* =========================
   LOAD SELECTED MINION
========================= */
function loadMinion() {
  if (!minionSelect.value) {
    alert("Please select a minion type");
    return;
  }

  // reset cache
  Object.keys(minionCache).forEach(k => delete minionCache[k]);

  materialsDiv.innerHTML = "Loading...";
  totalDiv.innerHTML = "";

  Promise.all([
    fetch(LIB_BASE + "ignore_list.json").then(r => r.json()),
    fetch(LIB_BASE + minionSelect.value).then(r => r.json())
  ])
    .then(([ignoreData, minion]) => {
      const ignoreItems = (ignoreData.ignore || ignoreData || []).map(i => i.item);
      const materialSet = new Set();
      const isRevenant = minion.name === "Revenant Minion";

      for (let t = 1; t <= minion.max_tier; t++) {
        (minion.tiers[t] || []).forEach(m => {
          if (!m.item.includes("Minion") && !ignoreItems.includes(m.item)) {
            materialSet.add(m.item);
          }

          // Revenant → Zombie dependency materials
          if (isRevenant && m.item.includes("Zombie Minion")) {
            materialSet.add("Rotten Flesh");
            materialSet.add("Enchanted Rotten Flesh");
          }
        });
      }

      materialsDiv.innerHTML = "<b>Enter Bazar Prices</b>";

      materialSet.forEach(item => {
        materialsDiv.innerHTML += `
          <div class="material-row">
            <span class="item-label">
              <img src="${getItemImage(item)}" class="item-icon">
              ${item} × 1
            </span>
            <input type="number" min="0" data-item="${item}">
          </div>
        `;
      });

      const btn = document.createElement("button");
      btn.textContent = "Calculate Tier Prices";
      btn.onclick = () => calculateTierPrices(minion);
      materialsDiv.appendChild(btn);
    })
    .catch(() => alert("Failed to load minion data"));
}

/* =========================
   ZOMBIE MINION COST (REVENANT ONLY)
========================= */
async function resolveZombieMinionCost(targetTier, prices) {
  const key = "zombie:" + targetTier;
  if (minionCache[key]) return minionCache[key];

  const res = await fetch(LIB_BASE + "zombie_minion.json");
  const zombie = await res.json();

  let total = 0;
  for (let t = 1; t <= targetTier; t++) {
    for (const m of zombie.tiers[t] || []) {
      total += (prices[m.item] || 0) * m.qty;
    }
  }

  minionCache[key] = total;
  return total;
}

/* =========================
   ROMAN NUMBERS
========================= */
function romanToNumber(r) {
  return {
    I:1, II:2, III:3, IV:4, V:5,
    VI:6, VII:7, VIII:8, IX:9, X:10
  }[r];
}

/* =========================
   MAIN CALCULATION
========================= */
async function calculateTierPrices(minion) {
  const prices = {};
  document.querySelectorAll("#materials input").forEach(i => {
    prices[i.dataset.item] = Number(i.value || 0);
  });

  const hasZombieDependency = minion.name === "Revenant Minion";

  let runningTotal = 0;
  totalDiv.innerHTML = "<b>Craft Cost Per Tier</b>";

  for (let t = 1; t <= minion.max_tier; t++) {
    let tierCost = 0;

    for (const m of minion.tiers[t] || []) {
      if (hasZombieDependency && m.item.includes("Zombie Minion")) {
        const tierRoman = m.item.split(" ").pop();
        const zombieTier = romanToNumber(tierRoman);
        tierCost += await resolveZombieMinionCost(zombieTier, prices);
      } else {
        tierCost += (prices[m.item] || 0) * m.qty;
      }
    }

    runningTotal += tierCost;

    totalDiv.innerHTML += `
      <div class="tier-row">
        <span>${minion.name} T${t}</span>
        <span>${runningTotal.toLocaleString()} coins</span>
      </div>
    `;
  }
}