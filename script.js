const LIB_BASE = "./Minion_recipes/";

const minionSelect = document.getElementById("minionSelect");
const tierSelect = document.getElementById("tierSelect");
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
  materialsDiv.innerHTML = "";
  totalDiv.textContent = "Loading...";

  fetch(LIB_BASE + minionSelect.value)
    .then(r => r.json())
    .then(minion => {
      const runningTotals = {};
      materialsDiv.innerHTML = "";
      totalDiv.textContent = "";

      for (let t = 1; t <= minion.max_tier; t++) {
        (minion.tiers[t] || []).forEach(mat => {
          runningTotals[mat.item] =
            (runningTotals[mat.item] || 0) + mat.qty;
        });

        const tierBox = document.createElement("div");
        tierBox.className = "row";
        tierBox.innerHTML = `<b>Tier ${t}</b>`;
        materialsDiv.appendChild(tierBox);

        Object.entries(runningTotals).forEach(([item, qty]) => {
          const row = document.createElement("div");
          row.className = "row";
          row.innerHTML = `
            ${item} × ${qty}
            → <input type="number" min="0" data-tier="${t}" data-item="${item}">
          `;
          materialsDiv.appendChild(row);
        });
      }

      const btn = document.createElement("button");
      btn.textContent = "Calculate All Tier Costs";
      btn.onclick = calculateAllTiers;
      materialsDiv.appendChild(btn);
    });
}

function calculateAllTiers() {
  const tierTotals = {};

  document.querySelectorAll("#materials input").forEach(inp => {
    const tier = inp.dataset.tier;
    const price = Number(inp.value || 0);

    tierTotals[tier] = (tierTotals[tier] || 0) + price;
  });

  totalDiv.innerHTML = "<b>Total Cost Per Tier</b><br>";
  Object.entries(tierTotals).forEach(([tier, cost]) => {
    totalDiv.innerHTML += `Tier ${tier}: ${cost.toLocaleString()}<br>`;
  });
}

function calculateTotal() {
  let total = 0;
  document.querySelectorAll("#materials input").forEach(inp => {
    const price = Number(inp.value || 0);
    const qty = Number(inp.dataset.qty);
    total += price * qty;
  });

  totalDiv.textContent =
    "Total Crafting Cost: " + total.toLocaleString();
}