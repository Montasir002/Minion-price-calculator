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

// tier selector
for (let i = 1; i <= 11; i++) {
  const opt = document.createElement("option");
  opt.value = i;
  opt.textContent = `Tier ${i}`;
  tierSelect.appendChild(opt);
}

loadBtn.onclick = loadMinion;

function loadMinion() {
  materialsDiv.innerHTML = "";
  totalDiv.textContent = "Loading...";

  fetch(LIB_BASE + minionSelect.value)
  .then(r => {
    if (!r.ok) throw new Error("Minion file not found");
    return r.json();
  })
    .then(r => r.json())
    .then(minion => {
      const targetTier = Number(tierSelect.value);
      const totals = {};

      for (let t = 1; t <= targetTier; t++) {
        (minion.tiers[t] || []).forEach(mat => {
          totals[mat.item] = (totals[mat.item] || 0) + mat.qty;
        });
      }

      materialsDiv.innerHTML = "";
      totalDiv.textContent = "";

      Object.entries(totals).forEach(([item, qty]) => {
        const row = document.createElement("div");
        row.className = "row";
        row.innerHTML = `
          ${item} × ${qty}
          → <input type="number" min="0" data-qty="${qty}">
        `;
        materialsDiv.appendChild(row);
      });

      const btn = document.createElement("button");
      btn.textContent = "Calculate Total Cost";
      btn.onclick = calculateTotal;
      materialsDiv.appendChild(btn);
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