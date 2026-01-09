const LIB_BASE = "./Minion_recipes/";
const minionCache = {};
const itemImageMap = {};
const DEFAULT_ITEM_ICON = "https://craftersmc.net/data/assets/logo/newOriginal512.png";

const minionSelect = document.getElementById("minionSelect");
const materialsDiv = document.getElementById("materials");
const totalDiv = document.getElementById("total");
const modeToggle = document.getElementById("modeToggle");

let firebasePrices = {};

(async () => {
  if (window.loadPricesFromFirebase) {
    firebasePrices = await window.loadPricesFromFirebase();
  }
})();

// Load images
fetch(LIB_BASE + "items.json").then(r => r.json()).then(data => {
  data.forEach(e => { if (e.item) itemImageMap[e.item] = e.url; });
});

function getItemImage(itemName) { return itemImageMap[itemName] || DEFAULT_ITEM_ICON; }

// Load minion list
fetch(LIB_BASE + "index.json").then(r => r.json()).then(data => {
  data.minions.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.file; opt.textContent = m.name;
    minionSelect.appendChild(opt);
  });
});

minionSelect.addEventListener("change", loadMinion);

function loadMinion() {
  if (!minionSelect.value) return alert("Select a minion");
  materialsDiv.innerHTML = "Loading...";
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
      materialsDiv.innerHTML += `
        <div class="material-row">
          <span><img src="${getItemImage(item)}" class="item-icon">${item}</span>
          <input type="number" min="0" data-item="${item}" placeholder="0">
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
