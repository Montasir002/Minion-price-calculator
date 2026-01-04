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
      const materials = {};

      // collect ALL materials across tiers
      for (let t = 1; t <= minion.max_tier; t++) {
        (minion.tiers[t] || []).forEach(mat => {
          materials[mat.item] = true;
        });
      }

      materialsDiv.innerHTML = "<b>Enter material prices</b><br>";

      Object.keys(materials).forEach(item => {
        const row = document.createElement("div");
        row.className = "row";
        row.innerHTML = `
          ${item} price →
          <input type="number" min="0" data-item="${item}">
        `;
        materialsDiv.appendChild(row);
      });

      const btn = document.createElement("button");
      btn.textContent = "Calculate Tier Prices";
      btn.onclick = () => calculateTierPrices(minion);
      materialsDiv.appendChild(btn);
    });
}

function calculateTierPrices(minion) {
  const prices = {};

  document.querySelectorAll("#materials input").forEach(inp => {
    prices[inp.dataset.item] = Number(inp.value || 0);
  });

  let cumulativeCost = 0;
  totalDiv.innerHTML = "<b>Minion Craft Cost per Tier</b><br>";

  for (let t = 1; t <= minion.max_tier; t++) {
    let tierCost = 0;

    (minion.tiers[t] || []).forEach(mat => {
      tierCost += (prices[mat.item] || 0) * mat.qty;
    });

    cumulativeCost += tierCost;

    totalDiv.innerHTML +=
      `Tier ${t}: ${cumulativeCost.toLocaleString()}<br>`;
  }
}