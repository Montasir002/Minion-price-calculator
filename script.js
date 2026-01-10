const LIB_BASE = "./Minion_recipes/";
const DEFAULT_ITEM_ICON = "https://craftersmc.net/data/assets/logo/newOriginal512.png";

const minionSelect = document.getElementById("minionSelect");
const materialsDiv = document.getElementById("materials");
const totalDiv = document.getElementById("total");
const modeToggle = document.getElementById("modeToggle");

const itemImageMap = {};

/* ======================
   LOAD ITEM IMAGES
====================== */
fetch(LIB_BASE + "items.json")
  .then(r => r.json())
  .then(items => {
    items.forEach(({ item, url }) => {
      if (item) itemImageMap[item] = url;
    });
  });

const getItemImage = name => itemImageMap[name] || DEFAULT_ITEM_ICON;

/* ======================
   LOAD MINION LIST
====================== */
fetch(LIB_BASE + "index.json")
  .then(r => r.json())
  .then(data => {
    data.minions.forEach(({ file, name }) => {
      const opt = document.createElement("option");
      opt.value = file;
      opt.textContent = name;
      minionSelect.appendChild(opt);
    });
  });

minionSelect.addEventListener("change", loadMinion);

/* ======================
   LOAD MINION
====================== */
function loadMinion() {
  if (!minionSelect.value) return;

  materialsDiv.textContent = "Loading...";
  totalDiv.innerHTML = "";

  Promise.all([
    fetch(LIB_BASE + "ignore_list.json").then(r => r.json()),
    fetch(LIB_BASE + minionSelect.value).then(r => r.json())
  ])
    .then(([ignoreData, minion]) => {
      const ignoreItems = (ignoreData.ignore || []).map(i => i.item);
      const materials = new Set();

      for (let t = 1; t <= minion.max_tier; t++) {
        (minion.tiers[t] || []).forEach(m => {
          if (!m.item.includes("Minion") && !ignoreItems.includes(m.item)) {
            materials.add(m.item);
          }
        });
      }

      renderMaterialInputs([...materials], minion);
    })
    .catch(() => {
      materialsDiv.textContent = "Failed to load minion data";
    });
}

/* ======================
   MATERIAL INPUT UI
====================== */
function renderMaterialInputs(items, minion) {
  materialsDiv.innerHTML = "<h3>Enter Bazaar Prices</h3>";

  items.forEach(item => {
    materialsDiv.innerHTML += `
      <div class="material-row">
        <span>
          <img src="${getItemImage(item)}" class="item-icon">
          ${item}
        </span>
        <input type="number" min="0" data-item="${item}" placeholder="0">
      </div>
    `;
  });

  const btn = document.createElement("button");
  btn.className = "primary-btn";
  btn.style.width = "100%";
  btn.style.marginTop = "15px";
  btn.textContent = "Calculate Prices";
  btn.onclick = () => calculateTierPrices(minion);

  materialsDiv.appendChild(btn);
}

/* ======================
   CALCULATION
====================== */
function calculateTierPrices(minion) {
  const prices = {};
  document.querySelectorAll("#materials input").forEach(i => {
    prices[i.dataset.item] = Number(i.value || 0);
  });

  let total = 0;
  totalDiv.innerHTML = "<h3>Craft Cost Per Tier</h3>";

  for (let t = 1; t <= minion.max_tier; t++) {
    let tierCost = 0;

    (minion.tiers[t] || []).forEach(m => {
      tierCost += (prices[m.item] || 0) * m.qty;
    });

    total += tierCost;

    totalDiv.innerHTML += `
      <div class="tier-row">
        <span>${minion.name} T${t}</span>
        <span class="tier-price">${total.toLocaleString()} coins</span>
      </div>
    `;
  }
}

/* ======================
   DARK MODE
====================== */
modeToggle.onclick = () => {
  document.body.classList.toggle("dark-mode");
  modeToggle.textContent =
    document.body.classList.contains("dark-mode") ? "☀️" : "🌙";
};