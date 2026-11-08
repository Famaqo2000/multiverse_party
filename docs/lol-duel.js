import {SLOTS,LABELS,createDuel,roll,buy,skip,bonusReady,drawBonus,resolveBonus,targets,megaTargets,startMega,chooseMega,finish} from './lol-duel-engine.js';
const root=document.querySelector('#duel'),dialog=document.querySelector('#power'),key='mv-lol-duel-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pools={},state=null;
function notify(text){if(dialog.open){let error=dialog.querySelector('.dialog-error');if(!error){error=document.createElement('p');error.className='dialog-error';error.setAttribute('role','alert');dialog.append(error);}error.textContent=text;}document.querySelector('#notice').textContent=text;clearTimeout(notify.timer);notify.timer=setTimeout(()=>document.querySelector('#notice').textContent='',6000);}
function save(){try{if(state)localStorage.setItem(key,JSON.stringify(state));else localStorage.removeItem(key);}catch{notify('Sauvegarde indisponible : gardez cette page ouverte.');}}
function art(c){return c?.image?`<img src="${esc(c.image)}" alt="${esc(c.name)}">`:'';}
const rules=`<details class="panel rules"><summary>Règles et pouvoirs</summary><p>500 $ chacun. Choisissez une catégorie et tirez une carte gratuitement. Enchérissez à voix haute, puis indiquez l’acheteur et le prix, par tranches de 10 $. Un achat remplace la carte de cette case sans remboursement. Vous pouvez passer un lot. Les cartes déjà équipées ne sont pas tirées.</p><p>Un tirage coûte 80 $, même sans gain. Il faut au moins trois cases principales remplies par joueur. Une chance sur quatre ne donne rien ; sinon un effet disponible est tiré au hasard : Vision du futur (4 cartes pour vous, verrou facultatif), Sabotage du futur (4 cartes pour l’adversaire, verrou automatique), ou voler un champion ou un sort adverse (la case adverse devient vide), verrouiller une case adverse remplie (elle ne pourra plus être remplacée ni volée), ou tirer un bonus aléatoire qui remplace votre bonus précédent. Une case verrouillée ne peut plus être modifiée, par aucun joueur.</p><p>Les effets des bonus sont interprétés par vous : les images ne contiennent pas de règles automatisées. Terminez quand vous voulez, puis débattez pour décider du vainqueur.</p></details>`;
function setup(){const missing=SLOTS.slice(0,5).filter(k=>!pools[k]?.length);root.innerHTML=`<p class="eyebrow">L’arène des combinaisons impossibles</p><h1>Forge ton champion.</h1><p>Un champion. Quatre sorts. Un bonus. Deux rivaux et 500 $ chacun.</p><section class="panel"><h2>Les deux adversaires</h2><div class="row"><label>Joueur 1<input id="p0" maxlength="30" value="Joueur 1"></label><label>Joueur 2<input id="p1" maxlength="30" value="Joueur 2"></label></div><p>${SLOTS.map(k=>`${LABELS[k]} : ${pools[k]?.length||0}`).join(' · ')}</p>${missing.length?`<p>Ajoute des images dans les catégories manquantes : ${missing.map(k=>esc(LABELS[k])).join(', ')}. Relance ensuite le serveur.</p>`:''}<button class="primary" data-duel="start" ${missing.length?'disabled':''}>Entrer dans l’arène</button></section>${rules}`;}
function render(){if(!state){if(dialog.open)dialog.close();setup();return;}const s=state;
 root.innerHTML=`<p class="eyebrow">Duel LoL · enchères libres</p><h1>${s.ended?'Vos créations sont prêtes.':'Composez l’impossible.'}</h1>${s.ended?'<section class="panel end"><h2>Qui gagne ce duel ?</h2><p>Comparez vos champions, vos sorts et vos bonus. Le verdict vous appartient.</p></section>':''}<div class="heads">${head(0)}<span class="eyebrow">VS</span>${head(1)}</div>${SLOTS.map(k=>`<div class="board-row">${cell(0,k)}${k==='Bonus'?'<span class="hint">Bonus<br>80 $</span>':`<button class="roll" data-duel="roll" data-slot="${k}" ${s.ended||s.pending||s.reward||!s.players.some(p=>!p.slots[k].locked&&p.money>=10)?'disabled':''}><span>⟳</span>Roll new one</button>`}${cell(1,k)}</div>`).join('')}<div class="row">${!s.ended?`<button class="primary" data-duel="finish" ${s.pending||s.reward?'disabled':''}>Terminer et comparer</button>`:''}<button data-duel="reset">Nouvelle partie</button></div><p class="hint">Bonus : 3 cases principales minimum par joueur · 80 $ · 25 % de chance de ne rien gagner</p>${rules}<details class="panel"><summary>Historique · ${s.log.length} actions</summary><ol class="log">${s.log.map(l=>`<li>${esc(l)}</li>`).join('')}</ol></details>`;
 syncDialog();
}
function head(i){const p=state.players[i];return `<div><strong>${esc(p.name)}</strong><span class="money">${p.money} $</span><button data-duel="powers" data-player="${i}" ${!bonusReady(state,i)?'disabled':''}>Bonus · 80 $</button></div>`;}
function cell(i,k){const t=state.players[i].slots[k];return `<div class="slot ${t.locked?'locked':''}"><small>${LABELS[k]} ${t.locked?'🔒':''}</small>${t.card?`${art(t.card)}<strong>${esc(t.card.name)}</strong>`:'<div class="empty">＋</div><strong>À construire</strong>'}</div>`;}
function auction(){const p=state.pending;return `<section class="panel auction" id="auction"><p class="eyebrow">Enchère en cours · ${LABELS[p.key]}</p><div class="lot">${art(p.card)}<h2>${esc(p.card.name)}</h2></div><div class="row"><label>Acheteur<select id="buyer">${state.players.map((x,i)=>`<option value="${i}" ${x.slots[p.key].locked||x.money<10?'disabled':''}>${esc(x.name)} · ${x.money} $</option>`).join('')}</select></label><label>Montant<input id="bid" type="number" min="10" max="500" step="10" value="10" inputmode="numeric"></label><button class="primary" data-duel="buy">Adjugé</button><button data-duel="skip">Passer ce lot</button></div><p>La carte achetée remplace celle de la même case. Aucun remboursement.</p></section>`;}
function openDialog(html){dialog.innerHTML=html;if(!dialog.open)dialog.showModal();}
function syncDialog(){
 if(state.pending){openDialog(auction());return;}
 if(state.reward){
  const r=state.reward,p=state.players[r.id];
  if(['vision','sabotage'].includes(r.type)){megaDialog(r);return;}
  const titles={none:'Pas de chance…',bonus:'Un bonus pour toi !',steal:'Tu gagnes un vol !',lock:'Tu gagnes un verrouillage !'};
  const targeted=['steal','lock'].includes(r.type);
  const options=targeted?targets(state,r.id,r.type).map(k=>`<option value="${k}">${LABELS[k]} · ${esc(state.players[1-r.id].slots[k].card.name)}</option>`).join(''):'';
  openDialog(`<p class="eyebrow">${esc(p.name)} · tirage à 80 $</p><h2>${titles[r.type]}</h2>${r.type==='none'?'<p>Aucun effet cette fois. Les 80 $ ont été dépensés ; tes cartes restent inchangées.</p>':''}${r.type==='bonus'?`<div class="lot">${art(r.card)}<strong>${esc(r.card.name)}</strong></div><p>Ce bonus remplace ton précédent bonus. Appliquez son effet entre vous.</p>`:''}${targeted?`<p>Choisis uniquement la cible du pouvoir tiré. Aucun coût supplémentaire.</p><label>Case adverse<select id="reward-target">${options}</select></label>`:''}<p><button class="primary" data-duel="resolve">${targeted?'Appliquer le pouvoir':'Continuer'}</button></p>`);return;
 }
 if(dialog.open)dialog.close();
}
function megaDialog(r){
 const own=r.type==='vision',recipient=state.players[own?r.id:1-r.id];
 const title=own?'Vision du futur':'Sabotage du futur';
 if(!r.offers){
  const options=megaTargets(state,r.id,r.type,pools).map(k=>`<option value="${k}">${LABELS[k]}${recipient.slots[k].card?' · '+esc(recipient.slots[k].card.name):' · case vide'}</option>`).join('');
  openDialog(`<p class="eyebrow">${esc(state.players[r.id].name)} · pouvoir obtenu</p><h2>${title}</h2><p>Choisis une case de ${esc(recipient.name)}, puis découvre quatre cartes. Tu en imposeras une gratuitement.${own?' Tu pourras la verrouiller.':' Elle sera automatiquement verrouillée.'}</p><label>Catégorie<select id="mega-slot">${options}</select></label><p class="note">Seules les cases non verrouillées avec au moins 4 nouvelles cartes sont proposées. Après le tirage, la catégorie et les quatre cartes sont définitives.</p><button class="primary" data-duel="mega-roll">Méga roll · 4 cartes</button>`);return;
 }
 openDialog(`<p class="eyebrow">${title} · ${LABELS[r.key]}</p><h2>Une carte pour ${esc(recipient.name)}</h2><p>Choisis ta carte ci-dessous. Aucun paiement supplémentaire.</p>${own?'<label class="mega-lock"><input type="checkbox" id="mega-lock"> Verrouiller ma carte après le choix</label>':'<p>🔒 La carte choisie sera verrouillée chez ton adversaire.</p>'}<div class="mega-grid">${r.offers.map((c,i)=>`<button data-duel="mega-pick" data-index="${i}" class="mega-card">${art(c)}<strong>${esc(c.name)}</strong><span>Choisir</span></button>`).join('')}</div>`);
}
function powers(i){
 if(!bonusReady(state,i))throw Error('Il faut 80 $ et au moins 3 cases principales remplies par joueur.');
 openDialog(`<h2>Tenter un bonus ?</h2><p>${esc(state.players[i].name)} dépense 80 $. Une chance sur quatre de ne rien gagner. Sinon : vol, verrouillage, carte Bonus, Vision du futur ou Sabotage du futur, au hasard parmi les effets disponibles.</p><div class="row"><button class="primary" data-duel="draw-bonus" data-player="${i}">Tirer · 80 $</button><button data-duel="close">Annuler</button></div>`);
}
// Escape cannot discard a paid reward or an unresolved auction.
dialog.addEventListener('cancel',e=>{if(state?.pending||state?.reward)e.preventDefault();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-duel]');if(!b||b.disabled)return;try{const a=b.dataset.duel;
 if(a==='close'){if(!state?.pending&&!state?.reward)dialog.close();return;}
 if(a==='start')state=createDuel([document.querySelector('#p0').value,document.querySelector('#p1').value]);
 if(a==='roll')roll(state,b.dataset.slot,pools);
 if(a==='buy')buy(state,Number(document.querySelector('#buyer').value),Number(document.querySelector('#bid').value));
 if(a==='skip')skip(state);
 if(a==='powers'){powers(Number(b.dataset.player));return;}
 if(a==='draw-bonus')drawBonus(state,Number(b.dataset.player),pools);
 if(a==='mega-roll')startMega(state,document.querySelector('#mega-slot').value,pools);
 if(a==='mega-pick')chooseMega(state,Number(b.dataset.index),document.querySelector('#mega-lock')?.checked===true);
 if(a==='resolve')resolveBonus(state,document.querySelector('#reward-target')?.value);
 if(a==='finish'){if(!confirm('Terminer le duel et comparer vos créations ?'))return;finish(state);}
 if(a==='reset'){if(!confirm('Effacer ce duel et repartir avec 500 $ chacun ?'))return;state=null;}
 save();const scroll=window.scrollY;render();window.scrollTo(0,scroll);
 }catch(error){notify(error.message);}});
try{const response=await fetch('data.json');if(!response.ok)throw Error('Catalogue introuvable.');const data=await response.json();if(!data.lolDuel)throw Error('Remplace build.py puis relance py -u serve.py pour préparer le Duel LoL.');pools=data.lolDuel.pools;try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.version===1&&saved.players?.length===2&&saved.players.every(p=>SLOTS.every(k=>p.slots?.[k])&&Number.isFinite(p.money)))state=saved;}catch{}render();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});}catch(error){root.innerHTML=`<section class="panel"><h1>Arène indisponible</h1><p>${esc(error.message)}</p><a href="./">Retour au salon</a></section>`;}
