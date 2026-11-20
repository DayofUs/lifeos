export function ingredientKey(name, unit) {
  return String(name).trim().replace(/\s+/g, ' ').toLowerCase() + '|' + unit;
}

export function isRecipe(recipe, servings) {
  return Boolean(recipe && Number.isInteger(recipe.servings) && recipe.servings > 0 &&
    recipe.servings <= 16 && (servings === undefined || recipe.servings === servings) &&
    Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 &&
    recipe.ingredients.length <= 50 && recipe.ingredients.every(item =>
      typeof item?.name === 'string' && item.name.trim() && item.name.length <= 100 &&
      typeof item.unit === 'string' && item.unit.trim() && item.unit.length <= 16 &&
      typeof item.quantity === 'number' && Number.isFinite(item.quantity) &&
      item.quantity > 0 && item.quantity <= 20000) &&
    Array.isArray(recipe.steps) && recipe.steps.length > 0 && recipe.steps.length <= 32 &&
    recipe.steps.every(step => typeof step === 'string' && step.trim() && step.length <= 1200));
}

export function dinnerServings(servings, linkedLunch) {
  return servings * (linkedLunch ? 2 : 1);
}

export function linkedLunchSource(day) {
  return Number.isInteger(day) && day >= 1 && day <= 4 ? day - 1 : null;
}

export function shoppingNeeds(ingredients, pantry) {
  const totals = new Map();
  for (const { name, quantity, unit } of ingredients) {
    if (!name || !Number.isFinite(quantity) || quantity <= 0) continue;
    const key = ingredientKey(name, unit);
    const previous = totals.get(key)?.qty || 0;
    totals.set(key, { name, unit, qty: previous + quantity });
  }
  return [...totals].map(([key, item]) => {
    const owned = pantry.filter(p => ingredientKey(p.name, p.unit) === key)
      .reduce((total, p) => total + (Number.isFinite(p.qty) && p.qty > 0 ? p.qty : 0), 0);
    return { ...item, owned, missing: Math.max(0, Math.round((item.qty - owned) * 1000) / 1000) };
  }).filter(item => item.missing > 0).sort((a, b) => a.name.localeCompare(b.name));
}

export function confirmCooking({ pantry, logs, key, recipe, at }) {
  if (logs[key]?.status === 'cooked' || !isRecipe(recipe)) return null;
  const shortages = shoppingNeeds(recipe.ingredients, pantry);
  const stock = pantry.map(item => ({ ...item }));
  for (const ingredient of recipe.ingredients) {
    let remaining = ingredient.quantity;
    const key = ingredientKey(ingredient.name, ingredient.unit);
    for (const item of stock) {
      if (ingredientKey(item.name, item.unit) !== key || !Number.isFinite(item.qty) || item.qty <= 0) continue;
      const used = Math.min(remaining, item.qty);
      item.qty -= used;
      remaining -= used;
      if (remaining <= 0) break;
    }
  }
  return {
    pantry: stock.filter(item => item.qty !== 0),
    logs: { ...logs, [key]: { status: 'cooked', actual: recipe.name, at, servings: recipe.servings } },
    shortages
  };
}

export function syncDecision(local, remote, baseline) {
  if (local === remote) return 'equal';
  if (baseline === remote) return 'push';
  if (baseline === local) return 'pull';
  return 'conflict';
}
