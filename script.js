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

  // fetch ignore list
  fetch("./Minion_rrcipes/ignore_list.json")
    .then(r => r.json())
    .then(ignoreData => {
      const ignoreItems = ignoreData.map(i => i.item); // array of items to ignore

      // fetch selected minion
      fetch(LIB_BASE + minionSelect.value)
        .then(r => r.json())
        .then(minion => {
          const materialSet = new Set();

          for (let t = 1; t <= minion.max_tier; t++) {
            (minion.tiers[t] || []).forEach(m => {
              if (!ignoreItems.includes(m.item)) { // check ignore list
                materialSet.add(m.item);
              }
            });
          }

          materialsDiv.innerHTML = "<b>Enter Bazar Prices of these items-</b><br>";
          materialSet.forEach(item => {
            materialsDiv.innerHTML += `
<div class="material-row">
  <span>${item} × 1</span>
  <input type="number" min="0" data-item="${item}">
</div>
`;
          });

          const btn = document.createElement("button");
          btn.textContent = "Calculate Tier Prices";
          btn.onclick = () => calculateTierPrices(minion);
          materialsDiv.appendChild(btn);
        });
    })
    .catch(err => {
      console.error(err);
      alert("Failed to load ignore list or minion data");
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
    totalDiv.innerHTML += `
  <div class="tier-row">
    <span>${minion.name} T${t}</span>
    <span>${total.toLocaleString()} coins</span>
  </div>
`;
  }
}