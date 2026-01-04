const LIB_URL = "https://montasir002.github.io/minion-recipes/";

const minionSelect = document.getElementById("minionSelect");
const tierSelect = document.getElementById("tierSelect");
const materialsDiv = document.getElementById("materials");

// load minion list
fetch(LIB_URL + "index.json")
  .then(r => r.json())
  .then(data => {
    data.minions.forEach(m => {
      const o = document.createElement("option");
      o.value = m.file;
      o.textContent = m.name;
      minionSelect.appendChild(o);
    });
  });

// tier dropdown
for (let i = 1; i <= 11; i++) {
  const o = document.createElement("option");
  o.value = i;
  o.textContent = "Tier " + i;
  tierSelect.appendChild(o);
}

function loadRecipe() {
  materialsDiv.innerHTML = "Loading...";
  fetch(LIB_URL + minionSelect.value)
    .then(r => r.json())
    .then(minion => {
      const tier = Number(tierSelect.value);
      const totals = {};

      for (let t = 1; t <= tier; t++) {
        (minion.tiers[t] || []).forEach(m => {
          totals[m.item] = (totals[m.item] || 0) + m.qty;
        });
      }

      materialsDiv.innerHTML = "";
      Object.entries(totals).forEach(([item, qty]) => {
        const div = document.createElement("div");
        div.className = "row";
        div.innerHTML = `
          ${item} × ${qty}
          → <input type="number" min="0" placeholder="price" data-qty="${qty}">
        `;
        materialsDiv.appendChild(div);
      });

      const btn = document.createElement("button");
      btn.textContent = "Calculate Total";
      btn.onclick = calcTotal;
      materialsDiv.appendChild(btn);

      const totalDiv = document.createElement("div");
      totalDiv.id = "total";
      totalDiv.style.marginTop = "10px";
      materialsDiv.appendChild(totalDiv);
    });
}

function calcTotal() {
  let total = 0;
  document.querySelectorAll("#materials input").forEach(inp => {
    const price = Number(inp.value || 0);
    const qty = Number(inp.dataset.qty);
    total += price * qty;
  });
  document.getElementById("total").textContent =
    "Total Craft Cost: " + total.toLocaleString();
}
