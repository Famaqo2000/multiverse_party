import {shuffle,pick,makeAuction,buy,auctionDone,makeUndercover,undercoverGroups,victory,makeTop,place,topCards} from './engine.js';
const app=document.querySelector('#app'),modal=document.querySelector('#modal');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
let data, session=null, selectedU=null,selectedG=null, spinning=false, resume=null;
let settings={names:['Joueur 1','Joueur 2','Joueur 3','Joueur 4','Joueur 5','Joueur 6'],universes:[],games:[],slots:5,uc:1,white:1};
let rotations={universe:0,game:0};
function storageSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{toast('Sauvegarde locale indisponible ; gardez cet onglet ouvert.');}}
function read(k){try{return JSON.parse(localStorage.getItem(k));}catch{return null;}}
function toast(message){const t=$('#toast');t.textContent=message;t.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.style.display='none',4500);}
function persist(){storageSet('mv-settings',settings);if(session)storageSet('mv-session',session);}
function clearSession(){session=null;resume=null;try{localStorage.removeItem('mv-session');}catch{}}
function button(label,action,cls=''){return `<button class="${cls}" data-action="${action}">${label}</button>`;}
function showModal(html){modal.innerHTML=html+button('Fermer','close','full ghost');modal.showModal();}
function currentU(){return data.universes.find(u=>u.id===session.universe);}
function card(c,compact=false){return `<figure class="card ${compact?'compact':''}">${c.image?`<img src="${esc(c.image)}" alt="${esc(c.name)}" loading="lazy">`:`<div class="portrait" aria-hidden="true">${esc(c.name.split(/[ -]/).map(w=>w[0]).slice(0,2).join(''))}</div>`}<figcaption>${esc(c.name)}</figcaption>${c.demo?'<small>CARTE DÉMO · PHOTO À AJOUTER</small>':''}</figure>`;}
function nameInputs(){return settings.names.map((n,i)=>`<label>JOUEUR ${i+1}<input maxlength="24" aria-label="Nom du joueur ${i+1}" data-name="${i}" value="${esc(n)}"></label>`).join('');}
function enabledUniverses(){return data.universes.filter(u=>settings.universes.includes(u.id));}
function usable(u,g){return g==='auction'?u.cards.filter(c=>c.kind==='characters').length>=settings.slots*2:g==='undercover'?undercoverGroups(u.groups,u.cards).length>0:topCards(u.cards).length>=10;}
function eligibleGames(u){return data.games.filter(g=>settings.games.includes(g.id)&&(!u||usable(u,g.id)));}
function wheel(items,type){
 const n=items.length;if(!n)return '<p class="muted">Aucun choix disponible</p>';
 let svg='';
 items.forEach((x,i)=>{
  const a=(i/n)*2*Math.PI-Math.PI/2,b=((i+1)/n)*2*Math.PI-Math.PI/2,m=(a+b)/2;
  const px=t=>150+144*Math.cos(t),py=t=>150+144*Math.sin(t);
  const path=n===1?'M150 6 A144 144 0 1 1 149.999 6 Z':`M150 150 L${px(a)} ${py(a)} A144 144 0 ${n>1&&b-a>Math.PI?1:0} 1 ${px(b)} ${py(b)} Z`;
  const id=`clip-${type}-${i}`;const color=x.color||['#b4a0ff','#ffb66d','#8acbff'][i%3];
  svg+=`<defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs><path d="${path}" fill="${color}"/>`;
  if(x.cover)svg+=`<image href="${esc(x.cover)}" x="6" y="6" width="288" height="288" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`;
  svg+=`<path d="${path}" fill="#11132235" stroke="#111322" stroke-width="3"/><text x="${150+94*Math.cos(m)}" y="${150+94*Math.sin(m)}" fill="white" font-size="${n>4?10:12}" font-weight="800" text-anchor="middle" dominant-baseline="middle" stroke="#111322" stroke-width="3" paint-order="stroke">${esc(x.name)}</text>`;
 });
 return `<div class="wheel-shell"><svg class="wheel" id="wheel-${type}" viewBox="0 0 300 300" role="img" aria-label="Roulette ${type==='game'?'des jeux':'des univers'}" style="transform:rotate(${rotations[type]}deg)">${svg}</svg><span class="wheel-center">${type==='game'?'✦':'M'}</span></div>`;
}
function home(){
 const us=enabledUniverses().filter(u=>eligibleGames(u).length>0),u=data.universes.find(x=>x.id===selectedU),gs=eligibleGames(u);
 app.innerHTML=`<a class="panel" style="display:block;text-decoration:none;margin-bottom:20px" href="lol-duel.html"><strong>⚔ Duel LoL · Forge ton champion</strong><p>1 contre 1 · sorts aux enchères · pouvoirs spéciaux →</p></a><section class="hero"><div><p class="eyebrow">LE MULTIVERS S’INVITE À TABLE</p><h1>Un téléphone.<br><em>Toutes vos légendes.</em></h1><p class="muted">Réunissez la bande, choisissez vos univers et laissez le hasard lancer la soirée.</p></div><div class="hero-stamp"><strong>3 × 3</strong>UNIVERS & JEUX<br>UNE SEULE SOIRÉE</div></section>
 ${resume?`<div class="notice section-head"><span>Une partie est en cours sur ce téléphone.</span>${button('Reprendre','resume','small primary')}</div>`:''}
 <div class="layout"><aside><section class="panel setup"><div class="section-head"><h2><span class="number">01</span> La bande</h2><span class="pill">4–16</span></div><label class="field">Nombre de joueurs<select id="count">${Array.from({length:13},(_,i)=>i+4).map(n=>`<option ${settings.names.length===n?'selected':''}>${n}</option>`).join('')}</select></label><div class="names">${nameInputs()}</div></section>
 <section class="panel packs-panel"><div class="section-head"><h2><span class="number">02</span> Vos univers</h2></div>${data.universes.map(u=>`<label class="pack">${u.cover?`<img src="${esc(u.cover)}" alt="">`:`<div class="mini" style="--tone:${u.color}">${esc(u.name[0])}</div>`}<span><strong>${esc(u.name)}</strong><small>${esc(u.tagline)}${u.demo?' · DÉMO':''}</small></span><input type="checkbox" data-universe="${u.id}" ${settings.universes.includes(u.id)?'checked':''}></label>`).join('')}<p class="note">Décochez les univers que certains ne connaissent pas. Les images pourront être ajoutées plus tard.</p></section>
 <section class="panel offline-panel"><h3>Prêts pour le voyage ?</h3><p class="muted" style="font-size:13px">Téléchargez les images des packs cochés en Wi-Fi, puis testez en mode avion.</p>${button('↓ Préparer le mode hors ligne','offline','full ghost')}<p id="offline-status" class="note">${esc(read('mv-offline-label')||'Aucun téléchargement confirmé pour cette installation.')}</p></section></aside>
 <section class="panel play-panel"><div class="section-head"><h2><span class="number">03</span> Le destin décide</h2><span class="pill">LET’S PLAY</span></div><div class="wheels"><div class="wheel-column"><p class="eyebrow">L’UNIVERS</p>${wheel(us,'universe')}<div class="wheel-result" id="result-universe">${esc(u?.name||'À vous de tourner')}</div>${button('Tourner l’univers','spin-universe','ghost')}</div><div class="wheel-column"><p class="eyebrow">LE JEU</p>${wheel(gs,'game')}<div class="wheel-result" id="result-game">${esc(gs.find(g=>g.id===selectedG)?.name||'Que le sort décide')}</div>${button('Tourner le jeu','spin-game','ghost')}</div></div>
 <div class="game-list">${data.games.map(g=>`<label class="game-toggle"><input type="checkbox" data-game="${g.id}" ${settings.games.includes(g.id)?'checked':''}>${esc(g.name)}</label>`).join('')}</div>
 ${button('✦ Tirer les deux & jouer','spin-both','primary launch')}${button('Jouer avec les résultats affichés','launch','full ghost small')}
 <details class="settings"><summary>Réglages des parties</summary><p class="note">Chaque équipe démarre avec 500 $. Les mises se font par tranches de 10 $.</p><div class="row"><label class="field">Cartes par équipe<select id="slots">${[3,4,5,6,7,8].map(n=>`<option ${settings.slots===n?'selected':''}>${n}</option>`).join('')}</select></label><label class="field">Undercover<input id="uc" type="number" min="0" max="7" value="${settings.uc}"></label><label class="field">Mr. White<input id="white" type="number" min="0" max="7" value="${settings.white}"></label></div><p class="note">Top 10 : choisissez ensemble un critère, puis placez dix cartes de 1 à 10 sans connaître les suivantes. À la fin, vous jugez le résultat.</p></details></section></div>`;
}
function validPlayers(){const names=settings.names.map(n=>n.trim());if(names.some(n=>!n)||new Set(names.map(n=>n.toLowerCase())).size!==names.length)throw Error('Donnez un nom différent et non vide à chaque joueur.');return names;}
function setBusy(on){spinning=on;app.querySelectorAll('button,input,select').forEach(el=>el.disabled=on);}
async function spin(type){
 let items=type==='universe'?enabledUniverses().filter(u=>eligibleGames(u).length>0):eligibleGames(data.universes.find(u=>u.id===selectedU));
 if(!items.length)throw Error('Cochez au moins un choix compatible. Ajoutez des groupes / classements si nécessaire.');
 const index=Math.floor(Math.random()*items.length),item=items[index];
 const target=((360-(index+.5)*360/items.length)%360+360)%360;
 rotations[type]+=1800+((target-rotations[type]%360+360)%360);
 const el=$(`#wheel-${type}`);if(el){el.getBoundingClientRect();el.style.transform=`rotate(${rotations[type]}deg)`;}
 await new Promise(r=>setTimeout(r,matchMedia('(prefers-reduced-motion: reduce)').matches?80:3400));
 if(type==='universe'){selectedU=item.id;selectedG=null;rotations.game=0;}else selectedG=item.id;
 const result=$(`#result-${type}`);if(result)result.textContent=item.name;
 return item;
}
async function spinAction(which){if(spinning)return;validPlayers();setBusy(true);try{
 if(which==='both'){
  if(!enabledUniverses().length||!settings.games.length)throw Error('Sélectionnez au moins un univers et un jeu.');
  if(!enabledUniverses().some(u=>eligibleGames(u).length))throw Error('Un univers coché ne possède aucun jeu compatible. Ajoutez ses données ou décochez-le.');
  await spin('universe');home();setBusy(true);await spin('game');setBusy(false);launch();
 }else{await spin(which);setBusy(false);home();}
 }finally{setBusy(false);}}
function launch(){
 const names=validPlayers(),u=data.universes.find(u=>u.id===selectedU),g=data.games.find(g=>g.id===selectedG);
 if(!u||!g)throw Error('Faites tourner les deux roulettes avant de lancer.');
 if(!usable(u,g.id))throw Error('Données insuffisantes pour ce jeu dans ce pack.');
 let state;
 if(g.id==='auction')state=makeAuction(names,u.cards.filter(c=>c.kind==='characters'),settings.slots);
 if(g.id==='undercover'){state=makeUndercover(names,u.groups,settings.uc,settings.white,u.cards);state.cards=u.cards;}
 if(g.id==='top10')state={phase:'choose'};
 session={universe:u.id,game:g.id,state};resume=null;persist();renderGame();
}
function shell(content){const u=currentU(),g=data.games.find(g=>g.id===session.game);app.innerHTML=`<div class="screen"><div class="game-top"><div><p class="eyebrow">${esc(u.name)}</p><h1>${esc(g.name)}</h1></div>${button('Quitter','quit','small ghost')}</div>${u.demo?'<p class="notice">Mode démo : cartes sans photos. Ajoutez vos images pour personnaliser le pack.</p>':''}${content}</div>`;window.scrollTo({top:0});}
function handoff(name,label='CARTE SECRÈTE'){return `<section class="panel secret center"><p class="eyebrow">${label}</p><div class="secret-icon">◈</div><p class="muted">Donne le téléphone à</p><h2>${esc(name)}</h2><p class="muted">Les autres, détournez le regard.</p>${button('Je suis '+esc(name)+' · Découvrir','reveal','primary')}</section>`;}
function teamHTML(s,full=false){return `<div class="scoreboard">${s.teams.map((t,i)=>`<section class="team"><h3>Équipe ${i===0?'Nova':'Solar'}</h3><p>${t.map(esc).join(' · ')}</p><strong class="money">${s.budgets[i]} $</strong><small>${s.rosters[i].length} / ${s.slots} recrues</small>${full?`<div class="cards-grid">${s.rosters[i].map(x=>`<div>${card(x.card,true)}<small>${x.price} $</small></div>`).join('')}</div>`:''}</section>`).join('')}</div>`;}
function renderAuction(){const s=session.state;
 if(auctionDone(s))s.phase='end';
 if(s.phase==='end'){shell(`<section class="panel center"><p class="eyebrow">LES ÉQUIPES SONT PRÊTES</p><h2>À vous de trancher.</h2><p class="muted">Comparez les pouvoirs, les synergies… et défendez vos achats.</p>${teamHTML(s,true)}<p class="note">Fin si les équipes sont complètes, ne peuvent plus acheter ou si la pioche est épuisée.</p>${button('Retour au salon','finish','primary full')}</section>`);return;}
 const recipient=s.schedule[s.index];
 if(s.phase==='handoff'){shell(`${teamHTML(s)}${handoff(recipient.name,`LOT ${s.index+1} · ÉQUIPE ${recipient.team===0?'NOVA':'SOLAR'}`)}${button('Budgets & équipes','budget','ghost full')}`);return;}
 if(s.phase==='reveal'){shell(`<section class="panel center"><p class="eyebrow">${esc(recipient.name)} · POUR TES YEUX SEULEMENT</p>${card(s.deck[s.index])}<p class="muted">Mémorise cette carte sans la montrer aux autres.</p>${button('Masquer & ouvrir les enchères','auction-hide','primary full')}</section>`);return;}
 shell(`<section class="panel"><div class="center"><p class="eyebrow">LOT ${s.index+1} · ENCHÈRES OUVERTES</p><h2>Qui mise sur l’inconnu ?</h2><p class="muted">${esc(recipient.name)} connaît la carte. Négociez à voix haute, puis enregistrez l’achat.</p></div>${teamHTML(s)}<div class="row" style="margin-top:20px"><label class="field">Équipe acheteuse<select id="buyer">${[0,1].map(i=>`<option value="${i}" ${s.rosters[i].length>=s.slots||s.budgets[i]<10?'disabled':''}>${i===0?'Nova':'Solar'}</option>`).join('')}</select></label><label class="field">Prix en dollars<input id="price" type="number" min="10" step="10" max="500" inputmode="numeric" value="10"></label></div>${button('Adjugé · enregistrer l’achat','buy','primary full')}<div class="row" style="margin-top:12px">${button('Personne n’achète · passer','skip','ghost small')}${button('Voir les équipes','budget','ghost small')}</div><p class="note">L’ordre alterne les équipes et les joueurs qui découvrent les cartes. Une carte passée sort de la pioche.</p></section>`);
 const available=[0,1].find(i=>s.rosters[i].length<s.slots&&s.budgets[i]>=10);if(available!==undefined)$('#buyer').value=available;
}
function underEnd(s){return `<section class="panel center"><p class="eyebrow">FIN DE PARTIE</p><h2>${esc(s.winner)} gagnent !</h2><p>Mot des civils : <strong>${esc(s.civil)}</strong><br>Mot Undercover : <strong>${esc(s.intruder)}</strong></p><div class="stack">${s.players.map(p=>`<div class="rank-reveal">${esc(p.name)} · ${roleName(p.role)} ${p.alive?'':'· éliminé'}</div>`).join('')}</div>${button('Retour au salon','finish','primary full')}</section>`;}
function roleName(r){return ({civil:'Civil',undercover:'Undercover',white:'Mr. White'})[r];}
function renderUnder(){const s=session.state;
 if(s.phase==='end'){shell(underEnd(s));return;}
 if(s.phase==='handoff'){shell(handoff(s.players[s.index].name,`DISTRIBUTION ${s.index+1} / ${s.players.length}`));return;}
 if(s.phase==='reveal'){
 const p=s.players[s.index],c=(s.cards||currentU().cards).find(c=>c.name===(p.role==='civil'?s.civil:s.intruder));
 shell(`<section class="panel center"><p class="eyebrow">${esc(p.name)} · MÉMORISE TON MOT</p>${p.role==='white'?'<div class="secret-icon">?</div><h2>Tu es Mr. White.</h2><p>Tu n’as pas de mot. Écoute les indices et fonds-toi dans le groupe.</p>':card(c)}<p class="note">Civils et Undercover voient leur mot, mais pas leur rôle.</p>${button('Masquer & passer le téléphone','under-next','primary full')}</section>`);return;
 }
 if(s.phase==='white-guess'){shell(`<section class="panel center"><p class="eyebrow">DERNIÈRE CHANCE</p><h2>${esc(s.players[s.eliminated].name)} est Mr. White.</h2><p>Il doit annoncer le mot des civils à voix haute, avant de toucher le téléphone.</p>${button('Le mot a été annoncé · vérifier','white-check','primary full')}<p class="note">Un civil vérifie ensuite discrètement. Si le mot est juste, Mr. White gagne immédiatement.</p></section>`);return;}
 if(s.phase==='white-check'){shell(`<section class="panel center"><p class="eyebrow">RÉSERVÉ À UN CIVIL · CACHEZ L’ÉCRAN</p><h2>Mot attendu : ${esc(s.civil)}</h2><p>Le mot annoncé par Mr. White correspond-il ?</p><div class="row">${button('Oui · Mr. White gagne','white-yes','primary')}${button('Non · continuer','white-no','ghost')}</div></section>`);return;}
 if(s.phase==='eliminated'){const p=s.players[s.eliminated];shell(`<section class="panel center"><p class="eyebrow">VERDICT</p><h2>${esc(p.name)}</h2><p style="font-size:24px">${roleName(p.role)}</p><p class="muted">${p.role==='civil'?'Un civil a été éliminé.':'Un intrus a été démasqué.'}</p>${button('Continuer','under-continue','primary full')}</section>`);return;}
 shell(`<section class="panel"><p class="eyebrow">TOUR ${s.round} · ${s.players.filter(p=>p.alive).length} EN JEU</p><h2>Un indice. Pas un aveu.</h2><p class="muted">${esc(s.first)} commence, puis faites le tour. Après les indices, débattez et votez à voix haute.</p><p>Qui a obtenu le plus de voix ?</p><div class="stack">${s.players.map((p,i)=>p.alive?`<button class="vote" data-action="vote" data-index="${i}"><span>${esc(p.name)}</span><span class="muted">Éliminer →</span></button>`:'').join('')}</div>${button('Égalité · personne éliminé','tie','ghost full')}<details class="settings"><summary>Rappel des règles</summary><p class="note">Les civils gagnent quand tous les intrus sont éliminés. Les intrus gagnent lorsqu’ils sont aussi nombreux que les civils restants. Mr. White peut gagner seul en trouvant le mot civil lors de son élimination. Les votes se font à voix haute ; ce téléphone enregistre le résultat collectif.</p></details></section>`);
}
function renderTop(){const s=session.state;
 if(s.phase==='choose'){
  shell(`<section class="panel"><p class="eyebrow">LE DÉFI COLLECTIF</p><h2>Choisissez votre critère</h2><p class="muted">Dix cartes de cet univers apparaîtront une par une. Décidez ensemble du critère et de ce que représente la première place.</p><label class="field">Votre critère (facultatif)<input id="top-criterion" maxlength="200" placeholder="Ex. : du plus puissant au moins puissant"></label><p class="note">Vous pouvez simplement annoncer le critère à voix haute. Chaque placement est définitif ; vous jugerez ensemble le résultat.</p>${button('Commencer le Top 10','top-start','primary full')}</section>`);return;
 }
 const criterion=s.criterion||'Votre critère choisi ensemble';
 if(s.phase==='end'){
  shell(`<section class="panel center"><p class="eyebrow">${esc(criterion)}</p><h2>Votre Top 10 est complet !</h2><p class="muted">Est-ce que cet ordre vous convient ? Discutez-en et décidez ensemble si le défi est réussi.</p><div class="cards-grid">${s.slots.map((c,i)=>`<div><h3>Place ${i+1}</h3>${card(c,true)}</div>`).join('')}</div>${button('Retour au salon','finish','primary full')}</section>`);return;
 }
 shell(`<section class="panel"><p class="eyebrow">CARTE ${s.index+1} / 10</p><h2>Quelle place lui réservez-vous ?</h2><p class="muted">${esc(criterion)}</p><div class="progress"><span style="width:${s.index*10}%"></span></div><div class="rank-layout"><div>${card(s.deck[s.index])}<p class="note">Concertez-vous. Les prochaines cartes restent cachées.</p></div><div>${s.slots.map((c,i)=>`<button class="rank-slot ${c?'filled':''}" data-action="place" data-index="${i}" ${c?'disabled':''}><b>${String(i+1).padStart(2,'0')}</b><span>${c?esc(c.name):'Placer ici'}</span></button>`).join('')}</div></div></section>`);
}
function renderGame(){if(session.game==='auction')renderAuction();else if(session.game==='undercover')renderUnder();else renderTop();persist();}
function nextUnder(){const s=session.state;s.winner=victory(s.players);if(s.winner)s.phase='end';else{s.phase='discussion';s.round++;s.first=pick(s.players.filter(p=>p.alive)).name;}}
async function offline(){
 if(!('serviceWorker'in navigator))throw Error('Mode hors ligne non pris en charge dans ce navigateur.');
 if(!enabledUniverses().length)throw Error('Cochez un univers à télécharger.');
 const label=$('#offline-status');label.textContent='Préparation…';
 const reg=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Service worker indisponible. Utilisez HTTPS ou localhost et rechargez la page.')),12000))]);
 const paths=[...new Set([...enabledUniverses().flatMap(u=>[u.cover,...u.cards.map(c=>c.image)]),...data.games.map(g=>g.cover),...Object.values(data.lolDuel?.pools||{}).flat().map(c=>c.image)].filter(Boolean))];
 const channel=new MessageChannel();let timer;
 await new Promise((resolve,reject)=>{
  const timeout=()=>{clearTimeout(timer);timer=setTimeout(()=>reject(Error('Téléchargement interrompu. Réessayez en Wi-Fi.')),60000);};timeout();
  channel.port1.onmessage=e=>{timeout();if(e.data.error){clearTimeout(timer);reject(Error(e.data.error));}else if(e.data.complete){clearTimeout(timer);resolve();}else label.textContent=`Images prêtes : ${e.data.done} / ${e.data.total}`;};
  reg.active.postMessage({type:'CACHE_PACK',paths},[channel.port2]);
 });channel.port1.close();
 let kept=false;try{kept=await navigator.storage?.persist?.();}catch{}
 const msg=`Téléchargement terminé : ${enabledUniverses().map(u=>u.name).join(', ')}. Testez en mode avion ; le navigateur peut effacer son stockage.`;
 label.textContent=msg;storageSet('mv-offline-label',msg);toast('Packs téléchargés. Testez maintenant en mode avion.');
}
async function action(a,el){
 const s=session?.state;
 if(a==='close'){modal.close();return;}
 if(a==='spin-both')return spinAction('both');if(a==='spin-universe')return spinAction('universe');if(a==='spin-game')return spinAction('game');
 if(a==='launch'){launch();return;}if(a==='offline'){el.disabled=true;try{await offline();}finally{el.disabled=false;}return;}
 if(a==='resume'){session=resume;if(!data.universes.some(u=>u.id===session.universe))throw Error('Ce pack n’existe plus.');if(['reveal','white-check'].includes(session.state.phase))session.state.phase=session.state.phase==='white-check'?'white-guess':'handoff';resume=null;renderGame();return;}
 if(a==='quit'){showModal('<h2>Quitter la partie ?</h2><p>Les résultats et les cartes de cette partie seront effacés.</p>'+button('Quitter la partie','finish','danger full'));return;}
 if(a==='finish'){modal.close();clearSession();home();return;}
 if(a==='reveal')s.phase='reveal';
 if(a==='auction-hide')s.phase='bidding';
 if(a==='budget'){showModal('<h2>Budgets & recrutements</h2>'+teamHTML(s,true));return;}
 if(a==='buy'){buy(s,Number($('#buyer').value),Number($('#price').value));}
 if(a==='skip'){s.log.push({card:s.deck[s.index],skipped:true});s.index++;s.phase='handoff';}
 if(a==='under-next'){s.index++;s.phase=s.index===s.players.length?'discussion':'handoff';}
 if(a==='vote'){const i=Number(el.dataset.index);showModal(`<h2>Éliminer ${esc(s.players[i].name)} ?</h2><p>Confirmez le résultat du vote collectif.</p><button class="danger full" data-action="confirm-vote" data-index="${i}">Confirmer l’élimination</button>`);return;}
 if(a==='confirm-vote'){modal.close();const i=Number(el.dataset.index);if(!s.players[i].alive)throw Error('Joueur déjà éliminé.');s.eliminated=i;s.players[i].alive=false;s.phase=s.players[i].role==='white'?'white-guess':'eliminated';}
 if(a==='tie'){s.round++;s.first=pick(s.players.filter(p=>p.alive)).name;}
 if(a==='white-check')s.phase='white-check';
 if(a==='white-yes'){s.winner=s.players[s.eliminated].name+' (Mr. White)';s.phase='end';}
 if(a==='white-no'||a==='under-continue')nextUnder();
 if(a==='top-start'){session.state=makeTop(currentU().cards,$('#top-criterion').value);}
 if(a==='place')place(s,Number(el.dataset.index));
 renderGame();
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;Promise.resolve(action(b.dataset.action,b)).catch(err=>toast(err.message));});
app.addEventListener('input',e=>{if(e.target.dataset.name!==undefined){settings.names[Number(e.target.dataset.name)]=e.target.value;storageSet('mv-settings',settings);}});
app.addEventListener('change',e=>{const el=e.target;
 if(el.id==='count'){const n=Number(el.value);settings.names=Array.from({length:n},(_,i)=>settings.names[i]||`Joueur ${i+1}`);}
 if(el.dataset.universe){settings.universes=el.checked?[...settings.universes,el.dataset.universe]:settings.universes.filter(x=>x!==el.dataset.universe);selectedU=null;selectedG=null;rotations.universe=0;}
 if(el.dataset.game){settings.games=el.checked?[...settings.games,el.dataset.game]:settings.games.filter(x=>x!==el.dataset.game);selectedG=null;rotations.game=0;}
 if(el.id==='slots'){settings.slots=Number(el.value);selectedG=null;}
 if(el.id==='uc'||el.id==='white'){settings[el.id]=Number(el.value);storageSet('mv-settings',settings);return;}
 storageSet('mv-settings',settings);if(!session)home();
});
// Never leave a secret card visible after switching apps or locking the phone.
document.addEventListener('visibilitychange',()=>{if(document.hidden&&session){const s=session.state;if(s.phase==='reveal'){s.phase='handoff';renderGame();}else if(s.phase==='white-check'){s.phase='white-guess';renderGame();}}});
function online(){const t=$('#network');t.textContent=navigator.onLine?'UN TÉLÉPHONE · TOUS ENSEMBLE':'HORS LIGNE';}
window.addEventListener('online',online);window.addEventListener('offline',online);online();
try{
 const response=await fetch('data.json');if(!response.ok)throw Error('Catalogue introuvable.');data=await response.json();
 const old=read('mv-settings');if(old&&Array.isArray(old.names)&&old.names.length>=4&&old.names.length<=16){settings={...settings,...old};settings.universes=settings.universes.filter(id=>data.universes.some(u=>u.id===id));settings.games=settings.games.filter(id=>data.games.some(g=>g.id===id));}
 else{settings.universes=data.universes.map(u=>u.id);settings.games=data.games.map(g=>g.id);}
 resume=read('mv-session');home();
 if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>toast('Le mode hors ligne nécessite HTTPS ou localhost.'));
}catch(e){app.innerHTML=`<section class="panel"><h1>Chargement impossible</h1><p>${esc(e.message)}</p><p>Lancez <code>python serve.py</code> ou ouvrez le site GitHub Pages. Ne double-cliquez pas sur index.html.</p></section>`;}
