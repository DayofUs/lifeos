import { kitchenStorageKey, writeCloudSnapshot } from './cloud-sync.mjs';
import { confirmCooking, dinnerServings, ingredientKey, isRecipe, linkedLunchSource, shoppingNeeds, syncDecision } from './kitchen.mjs';
'use strict';
const STORE='lifeos-kitchen-state-v2';const DAY=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const RECIPES=[
{id:'salmon',name:'Teriyaki salmon bowls',minutes:25,ingredients:[['Salmon',400,'g'],['Rice',150,'g'],['Edamame',100,'g'],['Cucumber',150,'g'],['Teriyaki sauce',50,'ml']]},
{id:'peri',name:'Peri-peri chicken & wedges',minutes:40,ingredients:[['Chicken breast',400,'g'],['Potatoes',500,'g'],['Salad mix',100,'g'],['Peri-peri sauce',50,'ml'],['Greek yoghurt',80,'g']]},
{id:'beef',name:'Korean beef bowls',minutes:25,ingredients:[['Beef mince',400,'g'],['Rice',150,'g'],['Cucumber',150,'g'],['Soy sauce',40,'ml'],['Honey',20,'g'],['Garlic',2,'cloves']]},
{id:'marry',name:'Marry me chicken',minutes:35,ingredients:[['Chicken breast',400,'g'],['Sun-dried tomatoes',80,'g'],['Cooking cream',150,'ml'],['Spinach',70,'g'],['Rice',150,'g'],['Garlic',2,'cloves']]},
{id:'pizza',name:'Homemade pizzas',minutes:50,ingredients:[['Plain flour',300,'g'],['Greek yoghurt',150,'g'],['Yeast',1,'sachet'],['Pizza sauce',150,'g'],['Mozzarella',200,'g'],['Chicken breast',200,'g']]},
{id:'tacos',name:'Chipotle beef tacos',minutes:30,ingredients:[['Beef mince',400,'g'],['Tortillas',6,'pieces'],['Black beans',1,'tin'],['Tomatoes',2,'pieces'],['Cheddar',80,'g'],['Lime',1,'pieces'],['Chipotle seasoning',1,'sachet']]},
{id:'parmi',name:'Chicken parmi & wedges',minutes:45,ingredients:[['Chicken breast',400,'g'],['Breadcrumbs',70,'g'],['Eggs',1,'pieces'],['Passata',150,'ml'],['Mozzarella',150,'g'],['Potatoes',500,'g']]},
{id:'tuna',name:'Tuna mayo pasta',minutes:20,ingredients:[['Pasta',250,'g'],['Tinned tuna',3,'tins'],['Cucumber',150,'g'],['Sweetcorn',100,'g'],['Mayonnaise',80,'g']]},
{id:'butter',name:'Butter chicken',minutes:35,ingredients:[['Chicken breast',400,'g'],['Butter chicken sauce',1,'jar'],['Rice',150,'g'],['Greek yoghurt',100,'g']]},
{id:'tuscan',name:'Tuscan chicken',minutes:35,ingredients:[['Chicken breast',400,'g'],['Spinach',70,'g'],['Sun-dried tomatoes',80,'g'],['Cooking cream',150,'ml'],['Rice',150,'g'],['Garlic',2,'cloves']]}
];
const initial=()=>({version:1,pantry:[],plan:['salmon','peri','beef','marry','pizza','tacos','parmi'],cooked:[],breakfast:'mix',lunch:'mix',extras:[],checked:[],history:[],settings:{budget:170,servings:2},lastUpdated:null,likes:[],dislikes:[],equipment:['Oven','Hob / stovetop','Microwave','Slow cooker','Blender / food processor','Ninja CREAMi'],swaps:[],aiSessions:[],weeklyChoices:{},mealLogs:{},mealDetails:{},snackShelf:[],snackLogs:[],prepLinks:{},reminders:{evening:'19:00',breakfast:true,lunch:true,defrost:true},cloud:{enabled:false}});
let S;
function readKitchen(key){
 let S;
 try{S={...initial(),...JSON.parse(localStorage.getItem(key)||'null')}}catch{S=initial()}
 if(!Array.isArray(S.pantry))S=initial();if(!Array.isArray(S.aiSessions))S.aiSessions=[];for(const k of ['weeklyChoices','mealLogs','mealDetails','prepLinks'])if(!S[k]||typeof S[k]!=='object'||Array.isArray(S[k]))S[k]={};for(const k of ['likes','dislikes','equipment','swaps'])if(!Array.isArray(S[k]))S[k]=initial()[k];if(!Array.isArray(S.snackShelf))S.snackShelf=[];if(!Array.isArray(S.snackLogs))S.snackLogs=[];if(!S.recommendedSnackBatches||typeof S.recommendedSnackBatches!=='object')S.recommendedSnackBatches={};if(!Array.isArray(S.selectedSnacks))S.selectedSnacks=[];if(!S.snackBatches||typeof S.snackBatches!=='object'||Array.isArray(S.snackBatches))S.snackBatches={};if(S.weeklyChoices?.days?.length&&!S.snackShelf.length){const old=S.weeklyChoices.days.flatMap(d=>(d.snacks?.options||[]));S.snackShelf=[...new Map(old.filter(o=>o?.name).map(o=>[slug(o.name),{...o,name:o.name}])).values()].slice(0,6)}S.reminders={...initial().reminders,...(S.reminders||{})};S.cloud={...initial().cloud,...(S.cloud||{})};
 return S;
}
function activeKitchenKey(){return kitchenStorageKey(STORE,CONFIG.supabaseUrl,session?.user?.id)}
let page='Home',toastTimer, cooking=null;
const $=s=>document.querySelector(s),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug=x=>String(x).trim().toLowerCase();const nfmt=n=>Number.isInteger(n)?String(n):Number(n).toFixed(1).replace(/\.0$/,'');
// Local writes are immediate; cloud writes are debounced and require an initial reconciliation.
function save(){S.lastUpdated=new Date().toISOString();localStorage.setItem(activeKitchenKey(),JSON.stringify(S));render();scheduleCloudSync()}
function storeCloudCopy(data){const key=activeKitchenKey();localStorage.setItem(key,JSON.stringify(data));S=readKitchen(key);cooking=null;render()}

function notify(msg){document.querySelector('.toast')?.remove();let t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.append(t);clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.remove(),2800)}
function needed(){if(S.weeklyChoices?.active)return neededForSelectedAI();let tally=new Map();function add(name,qty,unit){const key=slug(name)+'|'+unit;const entry=tally.get(key)||{name,qty:0,unit};entry.qty+=qty;tally.set(key,entry)}const factor=Number(S.settings.servings)/2;S.plan.forEach((id,i)=>{if(S.cooked.includes(i))return;let r=RECIPES.find(r=>r.id===id);r?.ingredients.forEach(([name,q,u])=>add(name,q*factor,u))});if(S.breakfast==='mix'||S.breakfast==='oats'){add('Oats',S.breakfast==='oats'?560:320,'g');add('Milk',S.breakfast==='oats'?1400:800,'ml');add('Bananas',S.breakfast==='oats'?7:4,'pieces')};if(S.breakfast==='mix'||S.breakfast==='weetbix'){add('Weet-Bix',S.breakfast==='weetbix'?70:30,'pieces');add('Milk',S.breakfast==='weetbix'?1400:600,'ml')};if(S.lunch==='mix'||S.lunch==='tuna'){let f=S.lunch==='tuna'?5/3:1;add('Pasta',Math.ceil(450*f),'g');add('Tinned tuna',Math.ceil(6*f),'tins');add('Mayonnaise',Math.ceil(100*f),'g');add('Cucumber',Math.ceil(200*f),'g')};if(S.lunch==='mix'||S.lunch==='wraps'){let f=S.lunch==='wraps'?5/2:1;add('Chicken breast',Math.ceil(400*f),'g');add('Wraps',Math.ceil(4*f),'pieces');add('Salad mix',Math.ceil(150*f),'g')};S.extras.forEach(x=>add(x.name,x.qty,x.unit));return [...tally.values()].map(r=>{const owned=S.pantry.filter(p=>slug(p.name)===slug(r.name)&&p.unit===r.unit).reduce((a,p)=>a+p.qty,0);return {...r,owned,missing:Math.max(0,Math.round((r.qty-owned)*10)/10)}}).filter(x=>x.missing>0).sort((a,b)=>a.name.localeCompare(b.name))}
function icon(name){const icons={Home:'⌂',Pantry:'▤',Meals:'◫',Ideas:'✦','AI Studio':'✧',Snacks:'◈',Equipment:'⚒',Shopping:'▣',Reminders:'◷','Smart Swaps':'↔',Cloud:'☁',Settings:'⚙'};return icons[name]||'•'}
function navigate(p){page=(p==='Ideas'||p==='AI Studio')?'Meals':p;render();window.scrollTo({top:0,behavior:'instant'})}
function render(){let needs=needed();const nav=['Home','Meals','Pantry','Shopping','Cloud','Settings','Equipment','Reminders','Smart Swaps'];const primary=nav.slice(0,4);$('#app').innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand">Life<span>OS</span><span style="font-weight:400"> / Kitchen</span></div><div class="sub">YOUR PERSONAL FOOD SYSTEM</div><nav class="nav">${nav.map(x=>`<button class="${x===page?'active':''}" data-page="${x}">${icon(x)} &nbsp; ${x}</button>`).join('')}</nav><div class="sidebar-footer">● Saved on this device<br>Cloud sync: ${esc(syncLabel())}<br>Keep a backup in Settings</div></aside><main class="main"><header class="top"><div class="eyebrow">LifeOS / ${esc(page)}</div><button class="button ghost" id="export-short">↓ Backup</button><span class="detail" aria-live="polite">☁ ${esc(syncLabel())}</span></header>${page==='Cook'?cookingView():page==='Home'?home(needs):page==='Pantry'?pantry():page==='Meals'?meals():page==='Shopping'?shopping(needs):page==='Snacks'?snacks():page==='Equipment'?equipment():page==='Reminders'?reminders():page==='Smart Swaps'?swaps():page==='Cloud'?cloudPage():settings()}<div class="footer">LifeOS Kitchen v2 · Local mode available · Secure cloud requires setup</div></main></div><nav class="mobile-nav hide-desktop">${primary.map(x=>`<button class="${x===page?'active':''}" data-page="${x}"><span class="nav-icon" aria-hidden="true">${icon(x)}</span>${x==='Home'?'Today':x}</button>`).join('')}<button data-page="Settings"><span class="nav-icon" aria-hidden="true">···</span>More</button></nav>`;bind()}
function heading(t,s){return `<h1 class="title">${t}</h1><div class="lead">${s}</div>`}
function home(needs){
 const day=(new Date().getDay()+6)%7;
 const active=S.weeklyChoices?.active;
 const meal=active?selectedMeal(day,'dinner'):RECIPES.find(recipe=>recipe.id===S.plan[day])?.name;
 const key=choiceKey(day,'dinner');
 const detail=S.mealDetails[key];
 const dateLabel=new Intl.DateTimeFormat('en-AU',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
 return `<div class="today-heading"><h1 class="title">Today</h1><p>${esc(dateLabel)}</p></div>`
  + `<section class="card today-card"><div class="eyebrow">Tonight’s dinner</div>
  <h2>${esc(meal||'Dinner is open')}</h2><div class="buttons">
  ${active&&S.mealLogs[key]?.status?`<p>${esc(S.mealLogs[key].status==='cooked'?'Cooked':S.mealLogs[key].status)}</p>`:active&&isRecipe(detail)?`<button class="button primary" data-open-recipe="${key}">Cook with me</button>`
    :active&&meal?`<button class="button primary" data-meal-detail="${key}">Get tonight’s recipe</button>`:''}
  ${!active&&meal?`<button class="button" data-cook="${day}" ${S.cooked.includes(day)?'disabled':''}>${S.cooked.includes(day)?'Already cooked':'Mark as cooked'}</button>`:''}
  <button class="button" data-page="Meals">Plan my week</button></div></section>
  <div class="today-shortcuts section">
   <button class="card today-link" data-page="Pantry"><span><strong>Pantry</strong><small>${S.pantry.length} recorded items</small></span><span aria-hidden="true">→</span></button>
   <button class="card today-link" data-page="Shopping"><span><strong>Shopping</strong><small>${needs.length} ingredients to buy</small></span><span aria-hidden="true">→</span></button>
  </div>`;
}

function cookingView(){
 const recipe=cooking?.recipe;
 if(!recipe)return `<button class="button" data-page="Meals">Back to meals</button>`;
 const step=cooking.step;
 return `<section class="card cook-card"><button class="button ghost" data-page="Meals">Back to meals</button>
 <h1>${esc(recipe.name)}</h1><p>${recipe.servings} servings · about ${esc(recipe.minutes||'—')} minutes</p>
 ${step<0?`<h2>Ingredients</h2><ul>${recipe.ingredients.map(item=>`<li>${nfmt(item.quantity)} ${esc(item.unit)} ${esc(item.name)}</li>`).join('')}</ul>
 <button class="button primary" id="advance-cook">Cook with me</button>`
 :step<recipe.steps.length?`<h2 tabindex="-1" id="cook-step">Step ${step+1} of ${recipe.steps.length}</h2>
 <progress class="cook-progress" value="${step+1}" max="${recipe.steps.length}" aria-label="Cooking progress"></progress><p class="cook-instruction">${esc(recipe.steps[step])}</p>
 <div class="buttons"><button class="button" id="previous-cook">Back</button><button class="button primary" id="advance-cook">${step+1===recipe.steps.length?'Review and finish':'Next step'}</button></div>`
 :`<h2 tabindex="-1" id="cook-step">Confirm cooking</h2><p>This records the meal and deducts the listed quantities from matching pantry stock.</p>
 ${cooking.key.endsWith('|dinner')&&hasLinkedLunch(Number(cooking.key.split('|')[0])+1)?'<p><label><input id="leftovers-stored" type="checkbox"> I set aside the planned extra servings and cooled and refrigerated them safely.</label></p>':''}
 <div class="buttons"><button class="button" id="previous-cook">Back</button><button class="button primary" id="finish-cook">Confirm cooked</button></div>`}</section>`;
}

function pantry(){return `${heading('Your pantry','Add what is actually in your fridge, freezer and cupboards. We only count confirmed quantities.')}<div class="card section"><h3>+ Add ingredient</h3><form id="add-pantry" class="form-grid"><div><label class="label">Ingredient</label><input class="field" name="name" required placeholder="e.g. Chicken breast"></div><div><label class="label">Quantity</label><input class="field" name="qty" type="number" min="0" step="0.1" required placeholder="500"></div><div><label class="label">Unit</label><select class="field" name="unit">${['g','ml','pieces','tins','cloves','sachet','jar'].map(u=>`<option>${u}</option>`).join('')}</select></div><button class="button primary" type="submit">Add</button></form><div class="detail" style="margin-top:12px">Use the same units as the recipes (e.g. g for chicken, ml for milk) for accurate matching.</div></div><div class="card section"><div class="row"><h3>Confirmed stock · ${S.pantry.length}</h3><span class="pill">Live inventory</span></div>${S.pantry.length?S.pantry.map((p,i)=>`<div class="line row"><div><strong>${esc(p.name)}</strong><div class="qty">${nfmt(p.qty)} ${esc(p.unit)}</div></div><div class="buttons"><button class="button tiny" data-edit="${i}">Edit</button><button class="button tiny ghost" data-remove="${i}">Remove</button></div></div>`).join(''):`<div class="empty">Nothing added yet. Add your current ingredients when you're ready.</div>`}</div>`}
function normaliseMealName(v){return typeof v==='string'?v:typeof v?.name==='string'?v.name:''}
const SLOT_NAMES=['breakfast','lunch','dinner'];
const MAX_WEEKLY_LEFTOVERS=2;
function pickIndependentLunch(i){
 const entry=S.weeklyChoices?.days?.[i]?.lunch;
 if(!entry)return;
 const alt=(entry.options||[]).find(x=>x?.name&&!/leftover|last night|previous night|yesterday/i.test(x.name));
 entry.selected=alt?.name||'';
}
function normaliseLeftoverPlan(days){
 let linked=0;
 days.forEach((day,i)=>{
  const wants=linkedLunchSource(i)!==null&&day.lunchFromPreviousDinner===true&&linked<MAX_WEEKLY_LEFTOVERS;
  if(wants){linkLunch(i);linked++;}
  else if(/leftover|last night|previous night|yesterday/i.test(S.weeklyChoices.days[i]?.lunch?.selected||''))pickIndependentLunch(i);
 });
}
function rebalanceCurrentLeftovers(){
 let count=0;
 for(let i=1;i<7;i++){
  if(hasLinkedLunch(i)){
   if(linkedLunchSource(i)!==null&&count<MAX_WEEKLY_LEFTOVERS){count++;continue;}
   unlinkLunch(i);pickIndependentLunch(i);
  }else if(/leftover|last night|previous night|yesterday/i.test(S.weeklyChoices?.days?.[i]?.lunch?.selected||''))pickIndependentLunch(i);
 }
 return count;
}
function requestedSnackCount(text){const s=String(text||'').toLowerCase();const m=s.match(/\b([2-5]|two|three|four|five)\s+(?:different\s+)?(?:ninja\s*)?(?:creami|ice\s*cream|flavo[u]?rs?|snacks?|desserts?|tubs?)/);return m?({'two':2,'three':3,'four':4,'five':5}[m[1]]||Number(m[1])):1;}

function choiceKey(i,slot){return i+'|'+slot}
function selectedMeal(i,slot){
 const link=slot==='lunch'?S.prepLinks?.[choiceKey(i,'lunch')]:null;
 if(link&&Number.isInteger(link.source)&&link.source>=0&&link.source<i){
  const dinner=S.weeklyChoices?.days?.[link.source]?.dinner?.selected;
  return dinner?'Leftover '+dinner:'No dinner selected to save for lunch';
 }
 return S.weeklyChoices?.days?.[i]?.[slot]?.selected||'';
}
function hasLinkedLunch(i){return !!S.prepLinks?.[choiceKey(i,'lunch')]}
function unlinkLunch(i){delete S.prepLinks[choiceKey(i,'lunch')];delete S.mealDetails[choiceKey(i,'lunch')]}
function linkLunch(i){const source=linkedLunchSource(i);if(source===null)return;S.prepLinks[choiceKey(i,'lunch')]={source};delete S.mealDetails[choiceKey(i,'lunch')];delete S.mealDetails[choiceKey(i-1,'dinner')]}
function snackBatch(name){const b=S.snackBatches[name]||{};return {prepared:Math.max(0,Number(b.prepared)||0),eaten:Math.max(0,Number(b.eaten)||0),unit:String(b.unit||(/creami|ice cream|sorbet|gelato/i.test(name)?'tubs':'portions'))}}

function mealPlanner(){
 const plan=S.weeklyChoices?.days;const shelf=S.snackShelf||[];
 const last=S.aiSessions?.find(s=>s.type==='weekly_full');
 const header=`${heading('Your weekly meals','LifeOS chooses your default meals, leftover lunches and weekly snacks. You can change any recommendation.')}<div class="card"><div class="row"><h3>Budget-smart AI weekly planner</h3><span class="pill">7 days · shared snack shelf</span></div><p class="detail">Approx. AUD $${esc(S.settings.budget)} weekly grocery target for two. LifeOS aims for repeat ingredients, planned leftovers, a few core breakfasts and lunches, and fresh dinner variety without requiring a separate shopping basket for every day. Prices are not live or guaranteed.</p><div class="buttons"><button class="button primary" id="generate-full-week">${plan?'Generate a different week':'Generate personalised week'}</button><button class="button ghost" id="keep-classic-plan">${plan?'View classic meals':'Classic planner'}</button>${plan?'<button class="button tiny" id="rebalance-leftovers">Limit leftover lunches to two</button>':''}</div><p id="full-week-status" class="detail">${last?'Last generated '+esc(new Date(last.date).toLocaleString('en-AU')):'New plans require a LifeOS Cloud login and configured AI backend'}</p></div>`;
 if(!plan)return header+`<div class="notice">Your old fixed-menu plan is preserved until you generate an AI week.</div>`+classicMeals();
 const week=`<div class="notice">Detailed recipes and ingredient quantities are required before the shopping list can count AI meals. Nutrition and costs remain estimates until verified. You can reuse a meal on multiple days; changes will not force another purchase.</div><div class="stack section">${DAY.map((d,i)=>`<div class="day"><div class="row"><h3 style="margin:0">${d}</h3><span class="pill">${i<5?'Packed lunch day':'Flexible day'}</span></div>${SLOT_NAMES.map(slot=>{const entry=plan[i]?.[slot]||{};const choices=Array.isArray(entry.options)?entry.options:[];const key=choiceKey(i,slot);const log=S.mealLogs[key];const current=selectedMeal(i,slot);const linked=slot==='lunch'&&hasLinkedLunch(i);const details=linked?null:S.mealDetails[key];return `<div class="section" style="border-top:1px solid var(--line, #ddd);padding-top:12px"><div class="row"><strong style="text-transform:capitalize">${esc(slot)}</strong><span class="detail">${linked?(S.mealLogs[choiceKey(i-1,'dinner')]?.leftoversStored?'Leftovers confirmed':'Leftovers planned · storage unconfirmed'):log?'Logged: '+esc(log.status):'Planned'}</span></div><select class="field" aria-label="${d} ${slot}" data-choice="${key}" ${log?.status==='cooked'?'disabled':''}><option value="">Choose a meal…</option>${choices.map((o,j)=>`<option value="${j}" ${o.name===current?'selected':''}>${esc(o.name)}</option>`).join('')}${linked?`<option value="linked" selected>↳ Leftover from ${DAY[i-1]} dinner: ${esc(current)}</option>`:current&&!choices.some(o=>o.name===current)?`<option value="custom" selected>${esc(current)}</option>`:''}</select><div class="row" style="margin-top:6px"><span class="detail">${esc(choices.find(o=>o.name===current)?.reason||'Choose, log or change this meal')}</span><div class="buttons"><button class="button tiny" data-custom="${key}" ${log?.status==='cooked'?'disabled':''}>Change</button>${slot==='lunch'&&(linked||linkedLunchSource(i)!==null)?`<button class="button tiny" data-link-lunch="${i}">${linked?'✓ Linked to dinner':'Use yesterday’s dinner'}</button>`:''}<button class="button tiny" data-meal-detail="${key}" ${!current||linked?'disabled':''}>Recipe</button></div></div><div class="buttons" style="margin-top:8px"><button class="button tiny" data-fav-slot="${key}" ${!current?'disabled':''}>♥ Favourite</button><button class="button tiny" data-reject-slot="${key}" ${!current?'disabled':''}>Not for me</button><button class="button tiny" data-log-slot="${key}">Log / ate out</button></div>${log?`<p class="detail">Actual: ${esc(log.actual||current)} · ${esc(log.status)} <button class="button tiny ghost" data-clear-log="${key}" ${log.status==='cooked'?'hidden':''}>Clear</button></p>`:''}${details?`<div class="notice good"><strong>${esc(details.name)}</strong> · ${esc(details.servings)} portions · ${esc(details.minutes||'?')} min<div class="detail">${(details.ingredients||[]).map(x=>esc(x.name+' '+x.quantity+' '+x.unit)).join(' · ')}</div><div class="buttons"><button class="button tiny" data-open-recipe="${key}">Open recipe</button>${details.shoppingApproved?'':`<button class="button tiny" data-add-recipe="${key}">Add ingredients to shopping</button>`}</div><p class="detail">Check actual product labels, especially carbohydrate content.</p></div>`:''}</div>`}).join('')}</div>`).join('')}</div>`;
 const snacks=`<div class="card section"><div class="row"><h3>Weekly snack cupboard</h3><span class="pill">Eat whenever you fancy</span></div><p class="detail">LifeOS chooses a practical selection for your week. Tell it what you are craving to get a personalised recommendation, or edit any choice. Prepare batches, and record what remains. For example, prepare three Ninja CREAMi tubs and use them on any night. Snack choices are not assigned to specific days.</p>
 <p class="detail">Want three CREAMi flavours? Ask for three and LifeOS will list them separately, with an individual checkbox, recipe and Not for me button for each.</p><form id="ask-snack-craving" class="gap" style="margin:12px 0"><input class="field" name="craving" maxlength="110" required placeholder="What are you craving? e.g. chocolate CREAMi or cookies"><button class="button tiny primary">Let AI pick a snack</button></form><details class="section"><summary class="detail">Or add a specific snack manually</summary><form id="add-snack-custom" class="gap" style="margin:12px 0"><input class="field" name="snackName" maxlength="110" required placeholder="Add your own snack, e.g. vanilla CREAMi"><button class="button tiny">Add snack</button></form></details>
 ${shelf.length?shelf.map((s,i)=>{const key='snack|'+i;const detail=S.mealDetails[key];const batch=snackBatch(s.name);const left=Math.max(0,batch.prepared-batch.eaten);return `<div class="line"><label class="gap"><input type="checkbox" data-select-snack="${i}" ${S.selectedSnacks.includes(s.name)?'checked':''}><strong>${esc(s.name)}</strong></label><div class="detail">${esc(s.reason||'')} ${s.batchServings?' · Recipe yields '+esc(s.batchServings):''} ${S.recommendedSnackBatches?.[s.name]?' · AI recommends preparing '+esc(S.recommendedSnackBatches[s.name])+' '+esc(batch.unit):''}</div><div class="row" style="margin-top:8px"><span class="detail">Prepared: ${batch.prepared} ${esc(batch.unit)} · Remaining: <strong>${left}</strong></span><button class="button tiny" data-snack-prep="${i}">+ Prepare batch</button></div><div class="buttons" style="margin-top:8px"><button class="button tiny" data-snack-eaten="${i}" ${left<1?'disabled':''}>Had one</button><button class="button tiny" data-snack-fav="${i}">♥ Favourite</button><button class="button tiny" data-snack-dislike="${i}">Not for me</button><button class="button tiny" data-snack-refresh="${i}">New suggestion</button><button class="button tiny" data-snack-recipe="${i}">${detail?'Regenerate recipe':'Generate recipe'}</button></div>${detail?`<div class="notice good"><div class="detail">${(detail.ingredients||[]).map(x=>esc(x.name+' '+x.quantity+' '+x.unit)).join(' · ')}</div><div class="buttons"><button class="button tiny" data-snack-open="${i}">Instructions</button><span class="detail">${S.selectedSnacks.includes(s.name)?'✓ Selected · ingredients included in shopping':'Select above to add recipe ingredients to shopping'}</span></div></div>`:''}</div>`}).join(''):'<p class="detail">Generate a personalised week or add snacks you already like.</p>'}<p class="detail">LifeOS preselects the weekly snacks and recommends preparation quantities; change anything you don't fancy. Snack batches only count as prepared after you confirm making them.</p><p class="detail">${S.selectedSnacks.length} selected for this week. Only selected snacks with generated recipes add ingredients to shopping. Keep recipes and shopping quantities aligned with how many batches you actually plan to prepare.</p></div>`;
 return header+week+snacks+`<div class="card section"><h3>Flexible planning</h3><p class="detail">Use “Log / ate out” when plans change, and choose leftover dinners for lunch. Future updates will calculate extra servings automatically; for now, double-check recipe portions before shopping.</p></div>`;
}
function meals(){return mealPlanner()}
function classicMeals(){return `<div class="card section"><h3>Original dinner planner (legacy)</h3><div class="detail">This older planner is retained for existing recipes and shopping, but will be replaced by the AI planner.</div>${DAY.map((d,i)=>`<div class="line">${d} · ${esc(RECIPES.find(r=>r.id===S.plan[i])?.name||'')}</div>`).join('')}</div>`}
function neededForSelectedAI(){
 const ingredients=S.extras.map(item=>({...item,quantity:item.qty}));
 for(const [key,detail] of Object.entries(S.mealDetails)){
  if(!detail?.shoppingApproved)continue;
  const [day,slot]=key.split('|');
  if(day==='snack'){
   if(!S.selectedSnacks.includes(detail.name))continue;
  }else{
   if(S.mealLogs[key]?.status)continue;
   if(slot==='lunch'&&hasLinkedLunch(Number(day)))continue;
   if(selectedMeal(Number(day),slot)!==detail.name)continue;
  }
  if(Array.isArray(detail.ingredients))ingredients.push(...detail.ingredients);
 }
 return shoppingNeeds(ingredients,S.pantry);
}
async function askLifeOSAI(type, extra, target){const status=document.querySelector('#full-week-status');if(status)status.textContent='Generating securely…';if(!session?.user){notify('Please sign in under Cloud first');return}
 const scope=activeKitchenKey();
 try{const bearer=await token();const context={likes:S.likes.slice(0,40),dislikes:S.dislikes.slice(0,40),equipment:S.equipment.slice(0,40),pantry:S.pantry.slice(0,70),budget:S.settings.budget,servings:S.settings.servings,history:S.history.filter(item=>item.type!=='archived-week').slice(0,12).map(({recipe,status})=>({recipe,status})),recentSnackIdeas:S.snackShelf.map(x=>x.name),schedule:{tuesday:'run club when attended',wednesday:'5-a-side football',weekdays:'packed lunches for two',weekend:'flexible'},goals:['build muscle','gradual fat loss','return to running'],extra};const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+bearer},body:JSON.stringify({type,context})});const body=await res.json();if(!res.ok)throw Error(body.error||'AI request failed');const data=body.data;
 if(scope!==activeKitchenKey())return;
 if(type==='snack_choices'){
  const ideas=Array.isArray(data.ideas)?data.ideas:[];
  const count=Math.max(2,Math.min(5,Number(extra?.count)||3));
  if(ideas.length!==count)throw Error('AI returned an incomplete group of snack choices');
  const seen=new Set(S.snackShelf.map(s=>slug(s.name)));
  let added=0;
  for(const idea of ideas){
   if(!idea?.name||seen.has(slug(idea.name)))continue;
   const snack={name:String(idea.name).slice(0,120),reason:String(idea.reason||'').slice(0,450),batchServings:Math.max(1,Number(idea.batchServings)||1),plannedBatches:Math.max(1,Number(idea.plannedBatches)||1),recommended:true};
   S.snackShelf.push(snack);S.selectedSnacks=[...new Set([...S.selectedSnacks,snack.name])];S.recommendedSnackBatches[snack.name]=Math.min(8,snack.plannedBatches);seen.add(slug(snack.name));added++;
  }
  if(!added)throw Error('No distinct new snack choices returned; try a more specific request');
 }else if(type==='snack_one'){
  const idx=Number(target);const incoming=data.idea;if(!incoming?.name||(target!=='append'&&!S.snackShelf[idx]))throw Error('Incomplete snack recommendation');
  if(target==='append'){
   if(!S.snackShelf.some(s=>slug(s.name)===slug(incoming.name))){S.snackShelf.push(incoming);S.selectedSnacks=[...new Set([...S.selectedSnacks,incoming.name])];}
  }else{const previous=S.snackShelf[idx].name;S.snackShelf[idx]=incoming;S.selectedSnacks=S.selectedSnacks.filter(n=>n!==previous);delete S.mealDetails['snack|'+idx];}
 }else if(type==='weekly_full'){
  const days=data.days;if(!Array.isArray(days)||days.length!==7)throw Error('Incomplete AI week');
  if(S.weeklyChoices?.days){
   S.history.unshift({type:'archived-week',at:new Date().toISOString(),plan:S.weeklyChoices,
    mealLogs:S.mealLogs,mealDetails:S.mealDetails,prepLinks:S.prepLinks,snackShelf:S.snackShelf});
  }
  S.weeklyChoices={active:true,days:days.map(day=>Object.fromEntries(SLOT_NAMES.map(slot=>{const options=(day[slot]||[]).map(o=>typeof o==='string'?{name:o,reason:''}:o).filter(o=>o&&typeof o.name==='string').slice(0,3);return [slot,{options,selected:options[0]?.name||''}]})))};S.snackShelf=(Array.isArray(data.snacks)?data.snacks:[]).filter(x=>x?.name).slice(0,8);S.selectedSnacks=S.snackShelf.filter(s=>s.recommended!==false).slice(0,4).map(s=>s.name);
  S.prepLinks={};S.recommendedSnackBatches={};
  for(const s of S.snackShelf){if(S.selectedSnacks.includes(s.name))S.recommendedSnackBatches[s.name]=Math.min(12,Math.max(1,Number(s.plannedBatches)||(/creami/i.test(s.name)?3:1)));}
  normaliseLeftoverPlan(days);
  S.mealDetails={};S.mealLogs={};S.checked=[];
 }else if(type==='recipe'){
  const key=target;if(!isRecipe(data,extra.servings))throw Error('The recipe did not include usable quantities and steps for the requested portions. Try again.');
  const [i,slot]=key.split('|');const current=slot==='snack'?S.snackShelf[Number(i)]?.name:selectedMeal(Number(i),slot);
  if(current!==extra.meal||(slot==='dinner'&&dinnerServings(Number(S.settings.servings),hasLinkedLunch(Number(i)+1))!==extra.servings))throw Error('Selection changed during recipe generation. Try again');
  S.mealDetails[key]={...data,name:current,shoppingApproved:slot==='snack'?S.selectedSnacks.includes(current):!(slot==='lunch'&&hasLinkedLunch(Number(i)))};
 }
 S.aiSessions=[{type,date:new Date().toISOString(),result:data},...S.aiSessions].slice(0,6);save();if(type==='recipe'&&!target.startsWith('snack|')){cooking={key:target,recipe:S.mealDetails[target],step:-1};navigate('Cook')}else navigate('Meals');notify(type==='recipe'?'Recipe ready':type==='snack_choices'?'Individual snack choices added':'Your personalised suggestions are ready');
 }catch(e){notify(e.message);if(status)status.textContent='AI error: '+e.message}}

function shopping(needs){let total=S.checked.length;return `${heading('Smart shopping','Requirements are aggregated by ingredient and adjusted for stock, plan changes and cooked meals.')}<div class="grid"><div class="card"><div class="muted">To buy</div><div class="stat">${needs.length}</div><div class="stat-detail">Ingredient lines</div></div><div class="card"><div class="muted">Checked</div><div class="stat">${needs.filter(x=>S.checked.includes(ingredientKey(x.name,x.unit))).length}</div><div class="stat-detail">Ready to add to pantry</div></div><div class="card"><div class="muted">Weekly budget</div><div class="stat">$${esc(S.settings.budget)}</div><div class="stat-detail">Target, not live price</div></div></div>${S.weeklyChoices?.active?'<p class="detail">Only meals with a recipe contribute ingredients. Open your planned meals to fill out this list.</p>':''}<div class="notice">Quantities are calculated, but prices and Woolworths stock are not live. Some packs or recipe assumptions may require adjustment before checkout.</div><div class="card"><div class="row"><h3>Ingredients to buy</h3><div class="buttons"><button class="button tiny" id="copy-list">Copy list</button><button class="button tiny primary" id="purchased" ${!total?'disabled':''}>Add checked as bought</button></div></div>${needs.length?needs.map(x=>{let key=ingredientKey(x.name,x.unit);return `<label class="shopping-entry"><span class="gap"><input type="checkbox" data-check="${esc(key)}" ${S.checked.includes(key)?'checked':''}><span class="${S.checked.includes(key)?'done':''}">${esc(x.name)}</span></span><strong>${nfmt(x.missing)} ${esc(x.unit)}</strong></label>`}).join(''):'<div class="empty">No missing ingredients — or all planned dinners have been cooked.</div>'}</div><div class="card section"><h3>Add snacks or household shopping</h3><form id="add-extra" class="form-grid"><div><label class="label">Item</label><input class="field" name="name" placeholder="Coffee, KitKats, snacks..." required></div><div><label class="label">Quantity</label><input class="field" type="number" name="qty" min="0.1" step="0.1" value="1" required></div><div><label class="label">Unit</label><select class="field" name="unit">${['pieces','g','ml','tins','jar','sachet'].map(x=>`<option>${x}</option>`).join('')}</select></div><button class="button primary">Add</button></form>${S.extras.length?`<div class="section">${S.extras.map((x,i)=>`<div class="line row"><span>${esc(x.name)} (${nfmt(x.qty)} ${esc(x.unit)})</span><button class="button tiny" data-remove-extra="${i}">Remove</button></div>`).join('')}</div>`:''}</div>`}
function settings(){return `<div class="buttons section">${['Cloud','Equipment','Reminders','Smart Swaps'].map(name=>`<button class="button" data-page="${name}">${name}</button>`).join('')}</div>${heading('Settings & backup','Your data currently lives in this browser. Use backups until cloud accounts are configured.')}<div class="card section"><h3>Kitchen preferences</h3><label class="label">Weekly shopping budget (AUD)</label><input class="field" id="budget" type="number" min="0" value="${esc(S.settings.budget)}" style="max-width:170px"><div class="detail" style="margin-top:8px">Budget is displayed as a target; shopping prices are not yet connected.</div></div><div class="card section"><h3>Backup and restore</h3><p class="lead">Download your complete Kitchen data as a JSON file. You can import it later on another device or after clearing your browser.</p><div class="buttons"><button class="button primary" id="export">Download backup</button><label class="button" for="import-file">Import backup</label><input id="import-file" type="file" accept="application/json,.json" hidden></div><div class="notice">This prototype saves to browser local storage, not to an online account. Clearing browser data, reinstalling or switching devices can remove local records. Automatic cross-device updates and secure cloud persistence are not enabled yet.</div></div><div class="card section"><h3>Data controls</h3><button class="button ghost" id="clear-all">Reset all Kitchen data</button><p class="detail">Only use reset if you really want to remove all locally saved Pantry and Kitchen information.</p></div>`}
function download(){let blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='lifeos-kitchen-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);notify('Backup downloaded')}
function cook(i){if(S.cooked.includes(i))return;const r=RECIPES.find(x=>x.id===S.plan[i]);if(!r)return;let shortages=[];for(const [name,qty,unit] of r.ingredients){let remaining=qty*Number(S.settings.servings)/2;for(const p of S.pantry.filter(x=>slug(x.name)===slug(name)&&x.unit===unit)){const used=Math.min(p.qty,remaining);p.qty=Math.max(0,Math.round((p.qty-used)*10)/10);remaining-=used;if(remaining<=0)break}if(remaining>0)shortages.push(`${name} (${nfmt(remaining)} ${unit})`)}S.pantry=S.pantry.filter(x=>x.qty>0);S.cooked.push(i);S.history.unshift({day:DAY[i],recipe:r.name,at:new Date().toISOString(),shortages});save();notify(shortages.length?'Meal logged; some ingredients were not in your pantry':'Meal logged; pantry updated')}

const IDEA_POOL=[
['Sticky sesame chicken bowls','Asian','Chicken breast','35 min'],['Lemon oregano chicken flatbreads','Mediterranean','Chicken breast','30 min'],['Cajun salmon & corn rice','American','Salmon','30 min'],['Garlic beef & broccoli noodles','Asian','Beef mince','25 min'],['Chicken shawarma plates','Middle Eastern','Chicken breast','40 min'],['Creamy paprika turkey meatballs','European','Turkey mince','35 min'],['Miso salmon with cucumber rice','Japanese','Salmon','25 min'],['Chipotle chicken burrito bowls','Mexican','Chicken breast','35 min'],['Honey soy pork stir-fry','Asian','Pork','25 min'],['Pesto chicken gnocchi','Italian','Chicken breast','25 min'],['Greek turkey kofta bowls','Mediterranean','Turkey mince','35 min'],['Baked harissa fish & couscous','North African','White fish','30 min'],['Korean beef lettuce wraps','Korean','Beef mince','25 min'],['Creamy garlic mushroom chicken','Italian','Chicken breast','35 min'],['Thai basil chicken rice','Thai','Chicken mince','25 min'],['Tandoori chicken and roasted cauliflower','Indian','Chicken breast','40 min'],['Lemon dill salmon with potatoes','European','Salmon','35 min'],['Beef fajita loaded sweet potatoes','Mexican','Beef mince','40 min'],['Satay chicken noodle bowls','Asian','Chicken breast','35 min'],['Crispy tofu rice bowls','Asian','Tofu','30 min'],['BBQ pulled chicken wraps','American','Chicken breast','45 min'],['Prawn chilli garlic pasta','Italian','Prawns','25 min'],['Gochujang turkey bowls','Korean','Turkey mince','30 min'],['Spinach & ricotta stuffed chicken','Italian','Chicken breast','45 min']];
const SNACK_POOL=[
['Chocolate peanut butter protein ice cream','Ninja CREAMi','Freeze base in advance; follow the model instructions'],['Mango frozen yoghurt','Ninja CREAMi','Use frozen mango and yoghurt; choose a compatible CREAMi function'],['Strawberry cheesecake frozen yoghurt','Ninja CREAMi','Prepare base ahead of time'],['Cinnamon baked oat bars','Oven','Good batch-prep alternative to packaged snack bars'],['Dark chocolate banana muffins','Oven','Bake a batch for packed lunches'],['Crispy paprika chickpeas','Oven','A crunchy alternative to crisps'],['Peanut butter oat bites','No-cook','Make a small batch and chill'],['Chocolate yoghurt bark','Freezer','Frozen yoghurt, berries and a little dark chocolate'],['Air-fried potato chips','Air fryer','Season with paprika and a little oil'],['Homemade sourdough discard crackers','Oven','Use discard only from a maintained starter'],['Berry baked oats','Oven','Breakfast or dessert'],['Homemade savoury popcorn','Hob / stovetop','Season lightly; portion after popping']];
const EQUIPMENT=['Oven','Hob / stovetop','Microwave','Slow cooker','Blender / food processor','Ninja CREAMi','Air fryer','Sandwich press','Rice cooker','Food processor','Digital kitchen scales','Stand mixer','Toaster'];
const SWAPS=[['Plain Greek yoghurt','Compare protein, added sugar, ingredients and price per 100g; plain Chobani may already be a good choice.'],['Packaged bread','Compare fibre-rich wholegrain loaves and homemade sourdough; sourdough is not automatically healthier.'],['Flavoured yoghurt','Try plain yoghurt with berries and cinnamon if it suits your tastes.'],['Sweet biscuits','Try homemade oat cookies or baked yoghurt bars; compare portions and total sugar.'],['Potato crisps','Compare baked crisps, popcorn and homemade versions by serving.'],['Ice cream','Use your Ninja CREAMi for an option with tailored protein and sugar.'],['Snack bars','Compare label claims with homemade oat, nut and seed bars.'],['Granola','Prepare a batch with oats and nuts to control extras and cost.']];
function weekIdeas(){const d=new Date();const week=Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(2025,0,1))/604800000);let seed=week+S.likes.length*19+S.dislikes.length*23;function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}const options=IDEA_POOL.filter(x=>!S.dislikes.includes(x[0]));return DAY.map((_,i)=>{const order=[...options].sort(()=>rnd()-.5);return order.slice(0,3)})}
function ideas(){return `${heading('Fresh meal inspiration','Three possibilities per day, influenced by preferences. These are rotating local suggestions, NOT live AI research.')}<div class="notice">To generate truly new recipes and research current sources automatically, connect the secure AI service in the deployment setup. Nothing in the app claims to have researched recipes yet.</div><div class="card"><h3>Current favourites</h3><div class="detail">${S.likes.length?S.likes.map(esc).join(' · '):'Tap a heart below to start training your preferences.'}</div><h3>Do not suggest</h3><div class="detail">${S.dislikes.length?S.dislikes.map(esc).join(' · '):'None yet'}</div></div>${weekIdeas().map((options,i)=>`<div class="card section"><div class="row"><h3>${DAY[i]} · three ideas</h3><span class="pill">Suggestions</span></div>${options.map(x=>`<div class="line"><strong>${esc(x[0])}</strong><div class="detail">${esc(x[1])} · ${esc(x[3])} · ${esc(x[2])}</div><div class="buttons" style="margin-top:8px"><button class="button tiny" data-like="${esc(x[0])}">♥ Favourite</button><button class="button tiny ghost" data-dislike="${esc(x[0])}">Not for me</button></div></div>`).join('')}</div>`).join('')}<div class="card section"><h3>Ask AI for truly original ideas</h3><p class="lead">Copy a detailed prompt incorporating preferences, equipment and pantry for now. When the cloud AI endpoint is connected, this step can happen directly in LifeOS.</p><button class="button primary" id="ask-ideas">Copy personalised AI prompt</button></div>`}
function snacks(){let visible=SNACK_POOL.filter(x=>x[1]==='No-cook'||x[1]==='Freezer'||S.equipment.includes(x[1]));return `${heading('Snack Lab','Homemade sweet and savoury snacks, traybakes and Ninja CREAMi inspiration.')}<div class="grid"><div class="card"><div class="muted">Ideas matching equipment</div><div class="stat">${visible.length}</div></div><div class="card"><div class="muted">Favourite snacks</div><div class="stat">${S.likes.filter(x=>SNACK_POOL.some(y=>y[0]===x)).length}</div></div></div><div class="notice">Ideas here are not verified nutritional recipes or automatic AI generations. Check exact ingredient quantities and carbohydrate information before relying on them.</div>${visible.map(x=>`<div class="card section"><h3>${esc(x[0])}</h3><div class="detail">${esc(x[1])} · ${esc(x[2])}</div><div class="buttons" style="margin-top:10px"><button class="button tiny" data-like="${esc(x[0])}">♥ Favourite</button><button class="button tiny ghost" data-dislike="${esc(x[0])}">Don't suggest</button></div></div>`).join('')}<div class="card section"><h3>Create a full snack recipe with AI</h3><button class="button primary" id="ask-snacks">Copy personalised snack prompt</button></div>`}
function equipment(){return `${heading('Kitchen equipment','The app should suggest recipes you can actually make.')}<div class="card"><h3>Confirm what you own</h3>${EQUIPMENT.map(x=>`<label class="shopping-entry"><span class="gap"><input type="checkbox" data-equip="${esc(x)}" ${S.equipment.includes(x)?'checked':''}>${esc(x)}</span></label>`).join('')}</div><div class="card section"><h3>Add another tool</h3><form id="equipment-form" class="gap"><input class="field" name="equipment" required placeholder="e.g. Ninja CREAMi Deluxe"><button class="button primary">Add</button></form>${S.equipment.filter(x=>!EQUIPMENT.includes(x)).map(x=>`<div class="detail" style="margin-top:6px">✓ ${esc(x)}</div>`).join('')}</div>`}
function reminders(){const index=(new Date().getDay()+6)%7,next=(index+1)%7;const tomorrow=RECIPES.find(r=>r.id===S.plan[next]);const chicken=tomorrow?.ingredients.some(x=>/chicken/i.test(x[0]));return `${heading('Evening reminders','Preparation tasks are linked to tomorrow’s meal plan. These are in-app prompts only until push notifications are configured.')}<div class="card"><label class="label">Evening prep time</label><input class="field" type="time" id="r-time" value="${esc(S.reminders.evening)}"><div class="section">${[['breakfast','Prepare tomorrow’s breakfast'],['lunch','Make packed lunches for tomorrow'],['defrost','Check whether frozen ingredients need defrosting']].map(([k,n])=>`<label class="shopping-entry"><span class="gap"><input id="r-${k}" type="checkbox" ${S.reminders[k]?'checked':''}>${n}</span></label>`).join('')}</div></div><div class="card section"><h3>Tonight’s suggested checklist</h3><div class="line">${S.reminders.breakfast?'☐ Prepare tomorrow’s breakfast':'Breakfast prep disabled'}</div><div class="line">${S.reminders.lunch&&next<5?'☐ Prepare tomorrow’s packed lunch':'No packed-lunch reminder tomorrow'}</div><div class="line">${S.reminders.defrost&&chicken?'☐ Check chicken for tomorrow’s dinner; thaw safely in the fridge if frozen':'Check tomorrow’s planned ingredients'}</div><div class="detail">Tomorrow’s planned dinner: ${esc(tomorrow?.name||'Unplanned')}. Never thaw poultry overnight on the countertop.</div></div>`}
function swaps(){return `${heading('Smart Supermarket','Food swaps should be evidence-based and worth the effort, not based on scary headlines.')}<div class="notice">Live product listings, prices and nutrition panels are NOT connected. These are general comparison opportunities—not verified price or health rankings.</div>${SWAPS.map(([name,desc])=>`<div class="card section"><h3>${esc(name)}</h3><p class="lead">${esc(desc)}</p><button class="button tiny" data-swap="${esc(name)}">${S.swaps.includes(name)?'✓ Saved to compare':'Save for comparison'}</button></div>`).join('')}`}

function aiStudio(){
 const last=S.aiSessions?.[0];
 const format=(s)=>{if(!s)return '';if(s.type==='weekly')return `<div class="stack">${(s.result.days||[]).map((d,i)=>`<div class="card"><h3>${esc(d.day||DAY[i]||'Day')}</h3>${(d.options||[]).slice(0,3).map((v,j)=>`<div class="line"><strong>${esc(v.name)}</strong><div class="detail">${esc(v.description||'')} · ${esc(v.minutes||'?')} min</div><div class="buttons"><button class="button tiny" data-ai-like="${esc(v.name)}">♥ Favourite</button><button class="button tiny ghost" data-ai-dislike="${esc(v.name)}">Not for me</button></div></div>`).join('')}</div>`).join('')}</div>`;
 return `<div class="stack">${(s.result.ideas||[]).map(v=>`<div class="card"><h3>${esc(v.name)}</h3><div class="detail">${esc(v.description||'')} · ${esc(v.equipment||'')}</div><div class="buttons"><button class="button tiny" data-ai-like="${esc(v.name)}">♥ Favourite</button><button class="button tiny ghost" data-ai-dislike="${esc(v.name)}">Not for me</button></div></div>`).join('')}</div>`;
 };
 return `<h2>AI meal inspiration</h2><p class="lead">Generate fresh dinner choices and homemade snacks from your preferences, pantry and kitchen equipment.</p><div class="notice">AI suggestions are generated on request—not automatically researched against live supermarkets. Check allergies, cooking temperatures and nutrition details before relying on them. The AI endpoint needs secure server configuration and a separate paid API account.</div><div class="card"><h3>What should LifeOS create?</h3><div class="buttons"><button class="button primary" data-ai-type="weekly">Generate 3 dinners per day</button><button class="button" data-ai-type="snacks">Suggest homemade snacks & CREAMi treats</button></div><p class="detail" id="ai-status">Sign into Cloud before using AI. You can save favourites and dislikes from suggestions below.</p></div>${last?`<div class="card section"><div class="row"><h3>Latest ${last.type==='weekly'?'weekly meal ideas':'snack ideas'}</h3><span class="pill">${esc(new Date(last.date).toLocaleDateString('en-AU'))}</span></div></div>${format(last)}`:''}`;
}
async function generateLifeOSAI(type){
 const status=document.querySelector('#ai-status');if(status)status.textContent='Generating ideas securely…';
 if(!session?.user){if(status)status.textContent='Please sign in under Cloud first.';return}
 try{
  const bearer=await token();
  const payload={type,context:{likes:S.likes.slice(0,50),dislikes:S.dislikes.slice(0,50),equipment:S.equipment.slice(0,40),pantry:S.pantry.slice(0,80).map(x=>({name:x.name,qty:x.qty,unit:x.unit})),history:S.history.slice(-18),budget:S.settings.budget,servings:S.settings.servings}};
  const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+bearer},body:JSON.stringify(payload)});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'AI request unsuccessful');
  S.aiSessions=[{type,date:new Date().toISOString(),result:result.data},...S.aiSessions].slice(0,6);
  save();navigate('Meals');notify('Fresh suggestions are ready');
 }catch(e){if(status)status.textContent='Could not generate: '+e.message;notify('AI: '+e.message)}
}
function buildPrompt(which){const stock=S.pantry.map(p=>`${p.name}: ${p.qty} ${p.unit}`).join(', ')||'Not yet entered';return which==='meals'?`Suggest 3 ORIGINAL dinner options for each of 7 days for two adults in Perth. Prefer high protein and varied cuisine, include familiar favourites and genuinely novel meals; do not repeat across days. Budget approximately AUD $150-180/week groceries including breakfasts and work lunches. Favourites: ${S.likes.join(', ')||'teriyaki salmon, peri-peri chicken, Tuscan chicken, Korean beef, tacos'}. Dislikes: ${S.dislikes.join(', ')||'none recorded'}. Pantry: ${stock}. Equipment: ${S.equipment.join(', ')}. Provide meal names and short explanations only, not recipes until I choose. When I choose, build a detailed safe recipe with ingredients and exact quantities, shopping gaps, realistic nutrition including carbs, and preparations/reminders. Don't imply live supermarket prices unless verified.`:`Suggest 8 varied homemade snacks including healthier alternatives to biscuits, crisps, cakes, traybakes and Ninja CREAMi recipes. Consider high-protein options, taste, reasonable portions, true nutrition and carbs. Pantry: ${stock}. Available equipment: ${S.equipment.join(', ')}. Favourites: ${S.likes.join(', ')}. Dislikes: ${S.dislikes.join(', ')}. Include make-ahead time and safety precautions, especially CREAMi freezing instructions for the correct model.`}
let session=null;try{session=JSON.parse(localStorage.getItem('lifeos_session')||'null')}catch{}
// Configuration is provided by the deployment owner. Do not put service-role or AI secret keys here.
const CONFIG={...(window.LIFEOS_CONFIG||{})};
try { const savedConfig=JSON.parse(localStorage.getItem('lifeos_supabase_settings')||'null'); if(savedConfig?.supabaseUrl&&savedConfig?.supabaseAnonKey)Object.assign(CONFIG,savedConfig); }catch{}
function saveCloudConfig(e){
 e.preventDefault();
 if(session?.user)return notify('Sign out before changing the cloud connection.');
 const url=document.querySelector('#supabase-url').value.trim().replace(/\/+$/,'');
 const key=document.querySelector('#supabase-key').value.trim();
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url))return notify('Enter your exact https://...supabase.co project URL');
 if(!/^(sb_publishable_|eyJ)[A-Za-z0-9_.-]+$/.test(key))return notify('Use your publishable key, not a secret key');
 CONFIG.supabaseUrl=url;CONFIG.supabaseAnonKey=key;
 localStorage.setItem('lifeos_supabase_settings',JSON.stringify({supabaseUrl:url,supabaseAnonKey:key}));
 notify('Supabase connection settings saved on this device');render();
}

async function authRequest(path,body){const r=await fetch(`${CONFIG.supabaseUrl}/auth/v1/${path}`,{method:'POST',headers:{'Content-Type':'application/json',apikey:CONFIG.supabaseAnonKey},body:JSON.stringify(body)});const out=await r.json();if(!r.ok)throw Error(out.msg||out.error_description||out.message||'Auth error');return out}
async function login(email,password){if(!CONFIG.supabaseUrl)throw Error('Configure the cloud endpoint first');if(session?.user)return;const authenticated=await authRequest('token?grant_type=password',{email,password});if(session?.user)return;session=authenticated;localStorage.setItem('lifeos_session',JSON.stringify(session));S=readKitchen(activeKitchenKey());cooking=null}
async function signup(email,password){if(!CONFIG.supabaseUrl)throw Error('Configure the cloud endpoint first');await authRequest('signup',{email,password})}
async function token(){if(!session?.access_token)throw Error('Sign in first');const expire=session.expires_at||0;if(expire&&Date.now()/1000>expire-90){const previous=session;const refreshed=await authRequest('token?grant_type=refresh_token',{refresh_token:session.refresh_token});if(session!==previous)throw Error('The active session changed');session=refreshed;localStorage.setItem('lifeos_session',JSON.stringify(session))}return session.access_token}
// Per-account baseline: a local edit is not a conflict if the cloud still has the
// version last successfully saved/loaded by this browser.
let syncMode='checking', syncTimer=null, syncBusy=false, syncPending=false;
let cloudBaseline=null;
function syncLabel(){if(!session?.user)return 'sign in to enable';return ({checking:'checking cloud',ready:'up to date',pending:'saving…',offline:'offline · saved locally',conflict:'different versions · action needed',error:'sync failed · retry',idle:'not started'})[syncMode]||syncMode}
function setSyncMode(mode){syncMode=mode;const line=document.querySelector('[aria-live="polite"]');if(line)line.textContent='☁ '+syncLabel();const status=document.querySelector('#cloud-sync-status');if(status)status.textContent='Sync status: '+syncLabel()+'. Changes auto-save if cloud has not changed independently.'}
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>k!=='lastUpdated'&&k!=='cloud').map(k=>[k,canonical(v[k])]));return v}
function signature(data){return JSON.stringify(canonical(data))}
function baselineKey(){return 'lifeos_sync_baseline_v2:'+CONFIG.supabaseUrl+':'+session.user.id}
function getBaseline(){try{return JSON.parse(localStorage.getItem(baselineKey())||'null')}catch{return null}}
function rememberBaseline(snapshot,updatedAt){cloudBaseline={signature:signature(snapshot),updatedAt:updatedAt||null};localStorage.setItem(baselineKey(),JSON.stringify(cloudBaseline))}
function cloudHeaders(bearer,extra={}){return {apikey:CONFIG.supabaseAnonKey,Authorization:'Bearer '+bearer,...extra}}
async function fetchCloudRow(){const bearer=await token();const r=await fetch(`${CONFIG.supabaseUrl}/rest/v1/kitchen_state?user_id=eq.${encodeURIComponent(session.user.id)}&select=data,updated_at`,{headers:cloudHeaders(bearer),cache:'no-store'});if(!r.ok)throw Error((await r.text()).slice(0,200));return (await r.json())[0]||null}
async function safeCloudUpload(snapshot,observedRevision){
 const bearer=await token();
 const updatedAt=await writeCloudSnapshot({
  endpoint:CONFIG.supabaseUrl,userId:session.user.id,headers:cloudHeaders(bearer),snapshot,observedRevision
 });
 if(!updatedAt){setSyncMode('conflict');notify('Cloud changed elsewhere. Review which version to keep.');}
 return updatedAt;
}
function scheduleCloudSync(){if(!session?.user||!CONFIG.supabaseUrl)return;syncPending=true;if(syncMode==='checking'||syncMode==='conflict'||syncMode==='idle')return;setSyncMode(navigator.onLine?'pending':'offline');clearTimeout(syncTimer);syncTimer=setTimeout(flushCloudSync,1100)}
async function flushCloudSync(){
 if(!session?.user||!syncPending||syncBusy||syncMode==='conflict'||syncMode==='checking')return;
 if(!navigator.onLine){setSyncMode('offline');return}
 syncBusy=true;syncPending=false;setSyncMode('pending');
 try{
  const snapshot=JSON.parse(JSON.stringify(S));const current=signature(snapshot);
  const base=cloudBaseline||getBaseline();
  if(!base?.updatedAt){syncPending=true;setSyncMode('conflict');return}
  if(current===base.signature){setSyncMode('ready');return}
  const updatedAt=await safeCloudUpload(snapshot,base.updatedAt);
  if(!updatedAt){syncPending=true;return}
  rememberBaseline(snapshot,updatedAt);
  if(signature(S)!==current){syncPending=true;setSyncMode('pending')}else setSyncMode('ready');
 }catch(e){syncPending=true;setSyncMode(navigator.onLine?'error':'offline');console.warn('LifeOS sync failure',e)}
 finally{syncBusy=false;if(syncPending&&navigator.onLine&&syncMode!=='conflict'&&syncMode!=='checking'){clearTimeout(syncTimer);syncTimer=setTimeout(flushCloudSync,5000)}}
}
async function initialiseCloudSync(){
 if(!session?.user||!CONFIG.supabaseUrl){setSyncMode('idle');return}
 if(syncBusy||syncMode==='checking')return;
 clearTimeout(syncTimer);setSyncMode('checking');
 try{
  const row=await fetchCloudRow();const base=getBaseline();cloudBaseline=base;
  if(!row){syncPending=true;setSyncMode('conflict');notify('No cloud copy yet. Use Save to cloud to start syncing.');return}
  const remoteSig=signature(row.data),localSig=signature(S);
  const decision=localStorage.getItem(activeKitchenKey())===null?'pull':syncDecision(localSig,remoteSig,base?.signature);
  if(decision==='equal'){rememberBaseline(row.data,row.updated_at);syncPending=false;setSyncMode('ready');return}
  if(decision==='push'){
    // Only this device has changed. Cloud has not changed since our last sync.
    cloudBaseline={signature:remoteSig,updatedAt:row.updated_at};syncPending=true;setSyncMode('pending');syncTimer=setTimeout(flushCloudSync,200);return;
  }
  if(decision==='pull'){
    // Only the cloud has changed, e.g. from another device.
    storeCloudCopy(row.data);rememberBaseline(row.data,row.updated_at);syncPending=false;setSyncMode('ready');notify('Updated Kitchen from cloud');return;
  }
  // No known common ancestor, or both sides changed: require explicit choice.
  syncPending=true;setSyncMode('conflict');notify('Local and cloud copies differ. Choose which one to keep in Cloud.');
 }catch(e){syncPending=true;setSyncMode(navigator.onLine?'error':'offline');console.warn('LifeOS cloud startup failed',e)}
}
async function cloudDownload(){
 if(syncBusy||syncMode==='checking'){notify('Wait for the current sync to finish.');return false;}
 syncBusy=true;
 try{
  const row=await fetchCloudRow();if(!row)throw Error('No cloud backup yet');
  if(!confirm('Replace local changes with this saved cloud version?'))return false;
  clearTimeout(syncTimer);syncPending=false;
  storeCloudCopy(row.data);rememberBaseline(row.data,row.updated_at);setSyncMode('ready');return true;
 }finally{syncBusy=false;}
}
async function manualCloudUpload(){
 if(syncBusy||syncMode==='checking'){notify('Wait for the current sync to finish.');return false;}
 syncBusy=true;
 try{
  const row=await fetchCloudRow();
  const snapshot=JSON.parse(JSON.stringify(S));
  const current=signature(snapshot);
  const remote=row?signature(row.data):null;
  const baseline=cloudBaseline||getBaseline();
  if(row&&remote!==current&&remote!==baseline?.signature&&
   !confirm('Replace the latest cloud copy with the data on this device?'))return false;
  clearTimeout(syncTimer);syncPending=false;setSyncMode('pending');
  const updatedAt=remote===current?row.updated_at:await safeCloudUpload(snapshot,row?.updated_at??null);
  if(!updatedAt){syncPending=true;return false;}
  rememberBaseline(snapshot,updatedAt);
  if(signature(S)!==current){syncPending=true;setSyncMode('pending');syncTimer=setTimeout(flushCloudSync,300)}
  else setSyncMode('ready');
  return true;
 }finally{syncBusy=false;}
}
window.addEventListener('online',()=>{if(session?.user){if(syncPending&&syncMode!=='conflict'&&syncMode!=='checking')flushCloudSync();else initialiseCloudSync()}});
window.addEventListener('visibilitychange',()=>{if(!document.hidden&&session?.user){if(syncMode==='offline'||syncMode==='error')initialiseCloudSync();else if(syncPending&&syncMode!=='conflict')flushCloudSync()}});
function cloudPage(){return `${heading('Cloud account & backup','Connect your own Supabase project and securely save your Kitchen data.')}<div class="notice">${CONFIG.supabaseUrl?'Connection settings saved on this device. Sign in to enable automatic saves and cloud backups.':'First enter your Supabase Project URL and publishable key below. Do not enter a secret or service-role key.'}</div><div class="card"><h3>Connect Supabase</h3><form id="cloud-config-form" class="stack"><label class="label">Project URL</label><input class="field" id="supabase-url" type="url" required placeholder="https://your-project.supabase.co" value="${esc(CONFIG.supabaseUrl||'')}" autocomplete="off" spellcheck="false"><label class="label">Publishable key (sb_publishable_...)</label><input class="field" id="supabase-key" type="text" required placeholder="sb_publishable_..." value="${esc(CONFIG.supabaseAnonKey||'')}" autocomplete="off" spellcheck="false"><div class="buttons"><button class="button primary" type="submit">Save connection</button></div></form><p class="detail">Only use a publishable or legacy anon key. These settings stay in this browser and do not create a database account.</p></div>${session?.user?`<div class="card section"><h3>Signed in</h3><p class="lead">${esc(session.user.email||'Your account')}</p><div class="notice" id="cloud-sync-status">Sync status: ${esc(syncLabel())}. Changes auto-save if cloud has not changed independently.</div><div class="buttons"><button class="button primary" id="save-cloud">Save to cloud</button><button class="button" id="load-cloud">Load cloud backup</button><button class="button ghost" id="cloud-out">Sign out</button>${localStorage.getItem(STORE)?'<button class="button" id="import-local-kitchen">Copy device-only Kitchen data</button>':''}</div></div>`:`<div class="card section"><h3>Account access</h3><form id="cloud-login" class="stack"><label class="label">Email</label><input id="cloud-email" class="field" name="email" type="email" required autocomplete="email"><label class="label">Password</label><input id="cloud-password" class="field" name="password" type="password" minlength="8" required autocomplete="current-password"><div class="buttons"><button class="button primary">Sign in</button><button type="button" class="button" id="cloud-signup">Create account</button></div></form></div>`}<div class="card section"><h3>Before you save personal information</h3><div class="detail">Changes automatically save to your cloud account after you sign in and resolve any version differences. This is basic single-account syncing, not simultaneous multi-device editing. Each account can access only its own record using the RLS policies. Household sharing is not implemented. Do not put private medical or banking information in this prototype.</div></div>`}

function bind(){
 $('#rebalance-leftovers')?.addEventListener('click',()=>{if(!confirm('Keep at most two weekday leftover lunches and switch other linked lunches to a separate available option? Existing generated recipes will be retained.'))return;rebalanceCurrentLeftovers();save();notify('Leftovers limited to two; review any lunches needing a choice.');});
 $('#generate-full-week')?.addEventListener('click',()=>{if(S.weeklyChoices?.days&&!confirm('Generate new suggestions? This will replace your current AI week and detailed AI recipes; pantry remains unchanged.'))return;askLifeOSAI('weekly_full')});
 document.querySelectorAll('[data-choice]').forEach(el=>el.addEventListener('change',e=>{const [i,slot]=el.dataset.choice.split('|');const entry=S.weeklyChoices.days[Number(i)][slot];const idx=e.target.value;if(idx==='custom'||idx==='linked'||S.mealLogs[el.dataset.choice]?.status==='cooked')return;if(slot==='lunch')unlinkLunch(Number(i));entry.selected=entry.options[Number(idx)]?.name||'';delete S.mealDetails[el.dataset.choice];if(slot==='dinner'){delete S.mealDetails[choiceKey(+i,'dinner')]}save()}));
 document.querySelectorAll('[data-custom]').forEach(el=>el.onclick=()=>{const [i,slot]=el.dataset.custom.split('|');const entry=S.weeklyChoices.days[Number(i)][slot];if(S.mealLogs[el.dataset.custom]?.status==='cooked')return;const val=prompt('What would you rather have? Type a meal name, “Leftover dinner”, or “Eating out”.',entry.selected||'');if(!val?.trim())return;if(slot==='lunch')unlinkLunch(Number(i));entry.selected=val.trim().slice(0,120);delete S.mealDetails[el.dataset.custom];save()});
 document.querySelectorAll('[data-link-lunch]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.linkLunch);if(hasLinkedLunch(i))unlinkLunch(i);else{if(linkedLunchSource(i)===null||Object.keys(S.prepLinks).length>=MAX_WEEKLY_LEFTOVERS)return notify('Choose up to two weekday leftover lunches.');if(S.mealLogs[choiceKey(i-1,'dinner')]?.status==='cooked')return notify('That dinner has already been recorded.');linkLunch(i);}save();notify(hasLinkedLunch(i)?'Lunch linked to previous dinner. Prepare extra portions.':'Lunch unlinked')});
 document.querySelectorAll('[data-fav-slot]').forEach(el=>el.onclick=()=>{const [i,slot]=el.dataset.favSlot.split('|');const name=selectedMeal(Number(i),slot);if(name)S.likes=[...new Set([...S.likes,name])];save();notify('Added to favourites')});
 document.querySelectorAll('[data-reject-slot]').forEach(el=>el.onclick=()=>{const [i,slot]=el.dataset.rejectSlot.split('|');const name=selectedMeal(Number(i),slot);if(name){S.dislikes=[...new Set([...S.dislikes,name])];S.likes=S.likes.filter(x=>x!==name)}save();notify('Saved as not for me')});
 document.querySelectorAll('[data-log-slot]').forEach(el=>el.onclick=()=>{const key=el.dataset.logSlot;const [i,slot]=key.split('|');if(S.mealLogs[key]?.status==='cooked')return notify('This meal has already updated pantry stock.');const status=prompt('What happened? Enter: eaten, takeaway, restaurant, swapped, leftover, skipped','eaten');if(!status)return;const actual=prompt('What did you actually eat? (optional)',selectedMeal(+i,slot));if(actual===null)return;S.mealLogs[key]={status:status.trim().slice(0,40),actual:actual.trim().slice(0,120),at:new Date().toISOString()};S.history.unshift({day:DAY[+i],slot,recipe:actual,status,at:new Date().toISOString()});save()});
 document.querySelectorAll('[data-clear-log]').forEach(el=>el.onclick=()=>{if(S.mealLogs[el.dataset.clearLog]?.status==='cooked')return;delete S.mealLogs[el.dataset.clearLog];save()});
 document.querySelectorAll('[data-meal-detail]').forEach(el=>el.onclick=()=>{const key=el.dataset.mealDetail;const [i,slot]=key.split('|');const meal=selectedMeal(+i,slot);if(!meal)return;if(slot==='lunch'&&hasLinkedLunch(+i))return notify('Open the previous dinner recipe for this planned lunch.');const portions=dinnerServings(Number(S.settings.servings),slot==='dinner'&&hasLinkedLunch(+i+1));askLifeOSAI('recipe',{meal,slot,day:DAY[+i],servings:portions},key)});
 document.querySelectorAll('[data-open-recipe]').forEach(el=>el.onclick=()=>{
  const key=el.dataset.openRecipe, recipe=S.mealDetails[key];
  if(!isRecipe(recipe))return notify('Get a fresh recipe to start cooking.');
  cooking={key,recipe,step:-1};
  navigate('Cook');
 });
 for(const [selector,increment] of [['#advance-cook',1],['#previous-cook',-1]]){
  $(selector)?.addEventListener('click',()=>{cooking.step+=increment;render();($('#cook-step')||$('#advance-cook'))?.focus()});
 }
 $('#finish-cook')?.addEventListener('click',()=>{
  const {key,recipe}=cooking;
  if(S.mealDetails[key]!==recipe)return notify('The recipe changed. Open it again to finish.');
  const result=confirmCooking({pantry:S.pantry,logs:S.mealLogs,key,recipe,at:new Date().toISOString()});
  if(!result)return notify('This meal has already been recorded.');
  if($('#leftovers-stored')?.checked)result.logs[key].leftoversStored=true;
  S.pantry=result.pantry;S.mealLogs=result.logs;
  cooking=null;page='Home';save();
  notify(result.shortages.length?'Meal recorded. Some ingredients had no matching pantry stock.':'Meal recorded and pantry updated.');
 });
 document.querySelectorAll('[data-add-recipe]').forEach(el=>el.onclick=()=>{const d=S.mealDetails[el.dataset.addRecipe];if(!d)return;d.shoppingApproved=true;save();notify('Recipe ingredients included in shopping')});
 document.querySelectorAll('[data-select-snack]').forEach(el=>el.onchange=()=>{const snack=S.snackShelf[Number(el.dataset.selectSnack)];if(!snack)return;S.selectedSnacks=el.checked?[...new Set([...S.selectedSnacks,snack.name])]:S.selectedSnacks.filter(x=>x!==snack.name);const detail=S.mealDetails['snack|'+el.dataset.selectSnack];if(detail)detail.shoppingApproved=el.checked;save();notify(el.checked?(detail?'Snack selected; ingredients updated':'Snack selected. Generate its recipe to calculate shopping needs.'):'Snack removed from this week’s shopping');});
 document.querySelectorAll('[data-snack-prep]').forEach(el=>el.onclick=()=>{const snack=S.snackShelf[Number(el.dataset.snackPrep)];if(!snack)return;const batch=snackBatch(snack.name);const qty=Number(prompt('How many '+batch.unit+' have you prepared?',String(S.recommendedSnackBatches?.[snack.name]||(/creami/i.test(snack.name)?3:snack.batchServings||6))));if(!Number.isInteger(qty)||qty<1||qty>100)return;S.snackBatches[snack.name]={...batch,prepared:batch.prepared+qty};save();notify('Batch added to snack cupboard')});
 document.querySelectorAll('[data-snack-eaten]').forEach(el=>el.onclick=()=>{const snack=S.snackShelf[Number(el.dataset.snackEaten)];if(!snack)return;const batch=snackBatch(snack.name);if(batch.prepared<=batch.eaten)return notify('No prepared portions left');S.snackBatches[snack.name]={...batch,eaten:batch.eaten+1};S.snackLogs.unshift({name:snack.name,at:new Date().toISOString()});save();notify('One portion used')});
 document.querySelectorAll('[data-snack-dislike]').forEach(el=>el.onclick=()=>{const idx=Number(el.dataset.snackDislike),snack=S.snackShelf[idx];if(!snack)return;S.dislikes=[...new Set([...S.dislikes,snack.name])];S.selectedSnacks=S.selectedSnacks.filter(n=>n!==snack.name);delete S.mealDetails['snack|'+idx];S.snackShelf.splice(idx,1);save();notify('Removed and added to dislikes. Add a replacement or generate new ideas.')});
 document.querySelectorAll('[data-snack-refresh]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.snackRefresh);askLifeOSAI('snack_one',{avoid:S.snackShelf.map(x=>x.name),preferredType:S.snackShelf[i]?.name||''},String(i))});
 $('#ask-snack-craving')?.addEventListener('submit',e=>{e.preventDefault();const craving=String(new FormData(e.target).get('craving')||'').trim().slice(0,110);if(!craving)return;askLifeOSAI(requestedSnackCount(craving)>1?'snack_choices':'snack_one',{craving,count:requestedSnackCount(craving),avoid:S.snackShelf.map(x=>x.name),preferredType:craving},'append')});
 $('#add-snack-custom')?.addEventListener('submit',e=>{e.preventDefault();const name=String(new FormData(e.target).get('snackName')||'').trim().slice(0,110);if(!name||S.snackShelf.some(x=>slug(x.name)===slug(name)))return;S.snackShelf.push({name,reason:'Added by you'});save();notify('Snack added')});
 document.querySelectorAll('[data-snack-fav]').forEach(el=>el.onclick=()=>{const snack=S.snackShelf[Number(el.dataset.snackFav)];if(!snack)return;S.likes=[...new Set([...S.likes,snack.name])];save();notify('Added to favourites')});
 document.querySelectorAll('[data-snack-recipe]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.snackRecipe),snack=S.snackShelf[i];if(!snack)return;askLifeOSAI('recipe',{meal:snack.name,slot:'snack',day:'flexible',servings:S.settings.servings},'snack|'+i)});
 document.querySelectorAll('[data-snack-open]').forEach(el=>el.onclick=()=>{const d=S.mealDetails['snack|'+el.dataset.snackOpen];if(d)alert(d.name+'\n\nIngredients:\n'+d.ingredients.map(x=>x.name+' '+x.quantity+' '+x.unit).join('\n')+'\n\nSteps:\n'+d.steps.map((x,i)=>(i+1)+'. '+x).join('\n'))});
 document.querySelectorAll('[data-snack-shop]').forEach(el=>el.onclick=()=>{const d=S.mealDetails['snack|'+el.dataset.snackShop];if(!d)return;d.shoppingApproved=true;save();notify('Snack ingredients added to shopping')});
 $('#keep-classic-plan')?.addEventListener('click',()=>{if(S.weeklyChoices?.active){if(!confirm('Switch to the original fixed meal plan? AI choices stay saved but are hidden.'))return;S.weeklyChoices.active=false;save()}else notify('Generate an AI week to activate personalised planning')});
 
 $('#cloud-config-form')?.addEventListener('submit',saveCloudConfig);
 document.querySelectorAll('[data-like]').forEach(b=>b.onclick=()=>{let n=b.dataset.like;S.likes=[...new Set([...S.likes,n])];S.dislikes=S.dislikes.filter(x=>x!==n);save();});
 document.querySelectorAll('[data-dislike]').forEach(b=>b.onclick=()=>{let n=b.dataset.dislike;S.dislikes=[...new Set([...S.dislikes,n])];S.likes=S.likes.filter(x=>x!==n);save();});
 document.querySelectorAll('[data-equip]').forEach(b=>b.onchange=e=>{let n=e.target.dataset.equip;S.equipment=e.target.checked?[...new Set([...S.equipment,n])]:S.equipment.filter(x=>x!==n);save()});
 $('#equipment-form')?.addEventListener('submit',e=>{e.preventDefault();const n=e.target.elements.namedItem('equipment').value.trim();if(n)S.equipment=[...new Set([...S.equipment,n])];save()});
 document.querySelectorAll('[data-swap]').forEach(b=>b.onclick=()=>{const n=b.dataset.swap;S.swaps=[...new Set([...S.swaps,n])];save()});
 $('#r-time')?.addEventListener('change',e=>{S.reminders.evening=e.target.value;save()});
 for(const k of ['breakfast','lunch','defrost'])$('#r-'+k)?.addEventListener('change',e=>{S.reminders[k]=e.target.checked;save()});
 document.querySelectorAll('[data-ai-type]').forEach(b=>b.addEventListener('click',()=>generateLifeOSAI(b.dataset.aiType)));
 document.querySelectorAll('[data-ai-like]').forEach(b=>b.onclick=()=>{const n=b.dataset.aiLike;S.likes=[...new Set([...S.likes,n])];S.dislikes=S.dislikes.filter(x=>x!==n);save()});
 document.querySelectorAll('[data-ai-dislike]').forEach(b=>b.onclick=()=>{const n=b.dataset.aiDislike;S.dislikes=[...new Set([...S.dislikes,n])];S.likes=S.likes.filter(x=>x!==n);save()});
 $('#ask-ideas')?.addEventListener('click',()=>{let q=buildPrompt('meals');navigator.clipboard?.writeText(q).then(()=>notify('AI meal prompt copied')).catch(()=>prompt('Copy this prompt',q))});
 $('#ask-snacks')?.addEventListener('click',()=>{let q=buildPrompt('snacks');navigator.clipboard?.writeText(q).then(()=>notify('AI snack prompt copied')).catch(()=>prompt('Copy this prompt',q))});
 $('#save-cloud')?.addEventListener('click',async()=>{try{if(await manualCloudUpload()){notify('Cloud backup saved');render()}}catch(e){setSyncMode('error');notify('Cloud save failed: '+e.message)}});
 $('#load-cloud')?.addEventListener('click',async()=>{try{if(await cloudDownload())notify('Cloud backup loaded')}catch(e){notify('Cloud load failed: '+e.message)}});
 $('#cloud-login')?.addEventListener('submit',async e=>{e.preventDefault();let f=new FormData(e.target);try{await login(String(f.get('email')),String(f.get('password')));notify('Signed in');render();initialiseCloudSync()}catch(e){notify('Sign in failed: '+e.message)}});
 $('#cloud-signup')?.addEventListener('click',async()=>{let email=$('#cloud-email')?.value,password=$('#cloud-password')?.value;try{await signup(email,password);notify('Account requested; check your email to verify')}catch(e){notify('Sign up failed: '+e.message)}});
 $('#import-local-kitchen')?.addEventListener('click',()=>{
  if(!session?.user||syncBusy||syncMode==='checking')return;
  if(!confirm('Copy the device-only Kitchen into this account on this browser? This replaces the account’s current local copy. Download a backup first if you need both.'))return;
  clearTimeout(syncTimer);S=readKitchen(STORE);cooking=null;
  setSyncMode('conflict');save();
  notify('Device copy imported locally. Use Save to cloud when ready.');
 });
 $('#cloud-out')?.addEventListener('click',()=>{if(syncBusy||syncMode==='checking')return notify('Wait for the current sync to finish.');clearTimeout(syncTimer);session=null;syncPending=false;cloudBaseline=null;syncMode='idle';localStorage.removeItem('lifeos_session');S=readKitchen(activeKitchenKey());cooking=null;render()});
document.querySelectorAll('[data-page]').forEach(el=>el.onclick=()=>navigate(el.dataset.page));$('#export-short').onclick=download;
$('#add-pantry')?.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target),name=String(f.get('name')).trim(),qty=Number(f.get('qty')),unit=String(f.get('unit'));if(!name||!(qty>0))return;let p=S.pantry.find(x=>slug(x.name)===slug(name)&&x.unit===unit);if(p)p.qty+=qty;else S.pantry.push({name,qty,unit});save();notify('Pantry updated')});
document.querySelectorAll('[data-edit]').forEach(el=>el.onclick=()=>{let i=+el.dataset.edit,p=S.pantry[i];let next=prompt(`New quantity for ${p.name} (${p.unit})`,p.qty);if(next===null)return;let n=Number(next);if(!Number.isFinite(n)||n<0)return notify('Enter a valid non-negative quantity');p.qty=n;if(n===0)S.pantry.splice(i,1);save()});
document.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{S.pantry.splice(+el.dataset.remove,1);save()});
document.querySelectorAll('[data-meal]').forEach(el=>el.onchange=e=>{let i=+el.dataset.meal;S.plan[i]=e.target.value;S.cooked=S.cooked.filter(x=>x!==i);S.checked=[];save()});
document.querySelectorAll('[data-cook]').forEach(el=>el.onclick=()=>cook(+el.dataset.cook));
document.querySelectorAll('[data-undo]').forEach(el=>el.onclick=()=>{if(!confirm('Mark dinner as not cooked? Ingredients already deducted will NOT be restored automatically.'))return;S.cooked=S.cooked.filter(x=>x!==+el.dataset.undo);save()});
$('#servings')?.addEventListener('change',e=>{S.settings.servings=+e.target.value;S.checked=[];save()});$('#breakfast')?.addEventListener('change',e=>{S.breakfast=e.target.value;S.checked=[];save()});$('#lunch')?.addEventListener('change',e=>{S.lunch=e.target.value;S.checked=[];save()});$('#reset-week')?.addEventListener('click',()=>{if(!confirm('Start a new week? This clears cooked markers but keeps pantry and recipes.'))return;S.cooked=[];S.checked=[];save()});
document.querySelectorAll('[data-check]').forEach(el=>el.onchange=e=>{let k=e.target.dataset.check;S.checked=e.target.checked?[...new Set([...S.checked,k])]:S.checked.filter(x=>x!==k);save()});
$('#purchased')?.addEventListener('click',()=>{let items=needed().filter(x=>S.checked.includes(ingredientKey(x.name,x.unit)));if(!items.length)return;for(const r of items){let match=S.pantry.find(x=>slug(x.name)===slug(r.name)&&x.unit===r.unit);if(match)match.qty+=r.missing;else S.pantry.push({name:r.name,qty:r.missing,unit:r.unit})}S.checked=[];S.extras=S.extras.filter(x=>!items.some(r=>slug(r.name)===slug(x.name)&&r.unit===x.unit));save();notify(`${items.length} items added to pantry`)});
$('#copy-list')?.addEventListener('click',()=>{let text=needed().map(x=>`☐ ${x.name}: ${nfmt(x.missing)} ${x.unit}`).join('\n')||'No missing ingredients';navigator.clipboard?.writeText(text).then(()=>notify('Shopping list copied')).catch(()=>prompt('Copy your shopping list',text))||prompt('Copy your shopping list',text)});
$('#add-extra')?.addEventListener('submit',e=>{e.preventDefault();let f=new FormData(e.target);S.extras.push({name:String(f.get('name')).trim(),qty:+f.get('qty'),unit:String(f.get('unit'))});save()});document.querySelectorAll('[data-remove-extra]').forEach(el=>el.onclick=()=>{S.extras.splice(+el.dataset.removeExtra,1);save()});
$('#budget')?.addEventListener('change',e=>{S.settings.budget=Math.max(0,+e.target.value||0);save()});$('#export')?.addEventListener('click',download);
$('#import-file')?.addEventListener('change',async e=>{try{const data=JSON.parse(await e.target.files[0].text());if(!Array.isArray(data.pantry)||!Array.isArray(data.plan)||data.plan.length!==7||!Array.isArray(data.checked))throw Error('Invalid file');if(!confirm('Replace your current Kitchen data with this backup?'))return;S={...initial(),...data};save();notify('Backup imported')}catch{notify('Invalid backup file')}});
$('#clear-all')?.addEventListener('click',()=>{if(!confirm('Delete all local Kitchen data? Export a backup first.'))return;S=initial();save()})}
S=readKitchen(activeKitchenKey());
window.addEventListener('storage',event=>{
 if(event.key!=='lifeos_session')return;
 let account=null;try{account=JSON.parse(event.newValue)?.user?.id??null}catch{}
 if(account!==(session?.user?.id??null))location.reload();
});
render();if(session?.user&&CONFIG.supabaseUrl)initialiseCloudSync();if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
