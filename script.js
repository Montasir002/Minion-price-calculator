const LIB_BASE = "./Minion_recipes/";
const minionCache = {};

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

  // fetch ignore list (accept either an array or { ignore: [...] })
  fetch(LIB_BASE + "ignore_list.json")
    .then(r => {
      if (!r.ok) throw new Error("Ignore list not found");
      return r.json();
    })
    .then(ignoreData => {
      const list = Array.isArray(ignoreData) ? ignoreData : (ignoreData.ignore || []);
      const ignoreItems = list.map(i => i.item); // array of items to ignore

      // fetch selected minion
      return fetch(LIB_BASE + minionSelect.value)
        .then(r => {
          if (!r.ok) throw new Error("Minion file not found");
          return r.json();
        })
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
            materialsDiv.innerHTML += `\n<div class="material-row">\n  <span>${item} × 1</span>\n  <input type="number" min="0" data-item="${item}">\n</div>\n`;
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

async function resolveMinionCost(minionFile, targetTier, prices) {
  const key = minionFile + ":" + targetTier;
  if (minionCache[key]) return minionCache[key];

  const res = await fetch(LIB_BASE + minionFile);
  const minion = await res.json();

  let total = 0;

  for (let t = 1; t <= targetTier; t++) {
    for (const mat of minion.tiers[t] || []) {
      if (mat.item.includes("Minion")) {
        // e.g. "Zombie Minion V"
        const [baseName, tierRoman] =
          mat.item.replace(" Minion", "").split(" ");
        const depTier = romanToNumber(tierRoman);
        const depFile =
          baseName.toLowerCase().replace(/ /g, "_") + "_minion.json";

        total += await resolveMinionCost(depFile, depTier, prices);
      } else {
        total += (prices[mat.item] || 0) * mat.qty;
      }
    }
  }

  minionCache[key] = total;
  return total;
}

function romanToNumber(r) {
  const map = {
    I:1, II:2, III:3, IV:4, V:5,
    VI:6, VII:7, VIII:8, IX:9, X:10
  };
  return map[r];
}

async function calculateTierPrices(minion) {
  // read user-entered prices
  const prices = {};
  document.querySelectorAll("#materials input").forEach(i => {
    prices[i.dataset.item] = Number(i.value || 0);
  });

  let runningTotal = 0;
  totalDiv.innerHTML = "<b>Craft Cost Per Tier</b><br>";

  for (let t = 1; t <= minion.max_tier; t++) {
    let tierCost = 0;

    for (const m of minion.tiers[t] || []) {
      if (m.item.includes("Minion")) {
        // dependency minion (e.g. Zombie Minion V)
        const parts = m.item.replace(" Minion", "").split(" ");
        const depTier = romanToNumber(parts.pop());
        const depName = parts.join(" ");
        const depFile =
          depName.toLowerCase().replace(/ /g, "_") + "_minion.json";

        tierCost += await resolveMinionCost(depFile, depTier, prices);
      } else {
        // normal material
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