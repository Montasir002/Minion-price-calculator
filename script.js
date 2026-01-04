const LIB_BASE = "./Minion_recipes/";

const minionSelect = document.getElementById("minionSelect");
const materialsDiv = document.getElementById("materials");
const totalDiv = document.getElementById("total");
const loadBtn = document.getElementById("loadBtn");

// load minion list
fetch(LIB_BASE + "index.json")
  .then(r => {
    if (!r.ok) throw new Error("Index JSON not found");
    return r.json();
  })
  .then(data => {
    console.log("INDEX:", data);
    data.minions.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.file;
      opt.textContent = m.name;
      minionSelect.appendChild(opt);
    });
  })
  .catch(err => {
    console.error(err);
    alert("Failed to load minion list");
  });


loadBtn.onclick = loadMinion;

function loadMinion() {
  if (!minionSelect.value) {
    alert("Please select a minion type");
    return;
  }

  materialsDiv.innerHTML = "Loading...";
  totalDiv.innerHTML = "";

  fetch(LIB_BASE + minionSelect.value)
    .then(r => r.json())
    .then(minion => {

      // 1. Collect unique materials
      const materialSet = new Set();
      for (let t = 1; t <= minion.max_tier; t++) {
        (minion.tiers[t] || []).forEach(m => materialSet.add(m.item));
      }

      // 2. Render inputs ONCE
      materialsDiv.innerHTML = "<b>Enter material prices</b><br>";
      materialSet.forEach(item => {
        materialsDiv.innerHTML += `
          ${item} × 1 →
          <input type="number" min="0" data-item="${item}"><br>
        `;
      });

      // 3. Calculate button
      const btn = document.createElement("button");
      btn.textContent = "Calculate Tier Prices";
      btn.onclick = () => calculateTierPrices(minion);
      materialsDiv.appendChild(btn);
    });
}

function calculateTierPrices(minion) {
  const prices = {};
  document.querySelectorAll("#materials input").forEach(i => {
    prices[i.dataset.item] = Number(i.value || 0);
  });

  let total = 0;
  totalDiv.innerHTML = "<b>Craft Cost Per Tier</b><br>";

  for (let t = 1; t <= minion.max_tier; t++) {
    let tierCost = 0;

    (minion.tiers[t] || []).forEach(m => {
      tierCost += (prices[m.item] || 0) * m.qty;
    });

    total += tierCost;
    totalDiv.innerHTML +=
      `${minion.name} T${t} = ${total.toLocaleString()} coins<br>`;
  }
}