export const SLOTS=['Champion','Q_Spell','W_Spell','E_Spell','Ulti','Bonus'];
export const LABELS={Champion:'Champion',Q_Spell:'Q Spell',W_Spell:'W Spell',E_Spell:'E Spell',Ulti:'Ulti',Bonus:'Bonus'};
const fail=message=>{throw Error(message);};
const choose=(pool,rng)=>pool[Math.floor(rng()*pool.length)];
export function createDuel(names){
 if(names.length!==2||names.some(n=>!n.trim())||names[0].trim()===names[1].trim())fail('Choisissez deux noms différents.');
 return {version:1,players:names.map(name=>({name:name.trim().slice(0,30),money:500,slots:Object.fromEntries(SLOTS.map(k=>[k,{card:null,locked:false}]))})),pending:null,ended:false,log:[]};
}
function active(s){if(s.ended)fail('La partie est terminée.');if(s.reward)fail('Résolvez le bonus en cours.');}
function player(s,id){if(![0,1].includes(id))fail('Joueur invalide.');return s.players[id];}
function slot(p,key){if(!SLOTS.includes(key))fail('Case invalide.');return p.slots[key];}
function spend(p,amount){if(p.money<amount)fail('Budget insuffisant.');p.money-=amount;}
export function roll(s,key,pools,rng=Math.random){
 active(s);if(s.pending)fail('Terminez ou passez l’enchère en cours.');
 if(!SLOTS.slice(0,5).includes(key))fail('Aucun tirage direct de bonus.');
 if(!s.players.some(p=>!p.slots[key].locked&&p.money>=10))fail('Aucun joueur ne peut acheter cette case.');
 const occupied=new Set(s.players.map(p=>p.slots[key].card?.name).filter(Boolean));
 const pool=(pools[key]||[]).filter(c=>!occupied.has(c.name));
 if(!pool.length)fail('Aucune nouvelle carte disponible dans cette catégorie.');
 s.pending={key,card:{...choose(pool,rng)}};
}
export function buy(s,id,amount){
 active(s);const p=player(s,id);if(!s.pending)fail('Aucune enchère en cours.');
 if(!Number.isInteger(amount)||amount<10||amount%10)fail('Misez au moins 10 $, par tranches de 10 $.');
 const target=slot(p,s.pending.key);if(target.locked)fail('Cette case est verrouillée.');
 spend(p,amount);target.card=s.pending.card;
 s.log.push(`${p.name} achète ${target.card.name} pour ${amount} $.`);s.pending=null;
}
export function skip(s){active(s);if(!s.pending)fail('Aucune enchère en cours.');s.pending=null;}
export function targets(s,id,type){
 const p=player(s,id),other=s.players[1-id];
 return SLOTS.filter(k=>type==='lock'?other.slots[k].card&&!other.slots[k].locked:k!=='Bonus'&&other.slots[k].card&&!other.slots[k].locked&&!p.slots[k].locked);
}
export function bonusReady(s,id){
 return !s.ended&&!s.pending&&!s.reward&&player(s,id).money>=80&&s.players.every(p=>SLOTS.slice(0,5).filter(k=>p.slots[k].card).length>=3);
}
function megaPool(s,key,pools){
 const occupied=new Set(s.players.map(p=>p.slots[key].card?.name).filter(Boolean));
 return [...new Map((pools[key]||[]).filter(c=>!occupied.has(c.name)).map(c=>[c.name,c])).values()];
}
export function megaTargets(s,id,type,pools){
 const recipient=player(s,type==='vision'?id:1-id);
 return SLOTS.filter(k=>!recipient.slots[k].locked&&megaPool(s,k,pools).length>=4);
}
export function startMega(s,key,pools,rng=Math.random){
 const r=s.reward;
 if(!r||!['vision','sabotage'].includes(r.type))fail('Aucun méga roll disponible.');
 if(r.offers)fail('Les quatre cartes ont déjà été tirées.');
 if(!megaTargets(s,r.id,r.type,pools).includes(key))fail('Choisissez une case non verrouillée avec au moins quatre nouvelles cartes.');
 const pool=megaPool(s,key,pools);
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 r.key=key;r.offers=pool.slice(0,4).map(c=>({...c}));
}
export function chooseMega(s,index,lock=false){
 const r=s.reward;
 if(!r||!['vision','sabotage'].includes(r.type)||!r.offers)fail('Tirez les quatre cartes avant de choisir.');
 if(!Number.isInteger(index)||index<0||index>=r.offers.length)fail('Carte invalide.');
 const recipient=player(s,r.type==='vision'?r.id:1-r.id),target=slot(recipient,r.key);
 if(target.locked)fail('Cette case est verrouillée.');
 target.card={...r.offers[index]};target.locked=r.type==='sabotage'||lock===true;
 s.log.push(`${s.players[r.id].name} utilise ${r.type==='vision'?'Vision du futur':'Sabotage du futur'} : ${target.card.name} pour ${recipient.name}${target.locked?' (verrouillé)':''}.`);
 s.reward=null;
}
export function drawBonus(s,id,pools,rng=Math.random){
 active(s);const p=player(s,id);
 if(!bonusReady(s,id))fail('Il faut 80 $ et au moins 3 cases principales remplies par joueur, sans enchère en cours.');
 const occupied=new Set(s.players.map(x=>x.slots.Bonus.card?.name).filter(Boolean));
 const cards=(pools.Bonus||[]).filter(c=>!occupied.has(c.name));
 const available=[];
 if(targets(s,id,'steal').length)available.push('steal');
 if(targets(s,id,'lock').length)available.push('lock');
 if(!p.slots.Bonus.locked&&cards.length)available.push('bonus');
 if(megaTargets(s,id,'vision',pools).length)available.push('vision');
 if(megaTargets(s,id,'sabotage',pools).length)available.push('sabotage');
 if(!available.length)fail('Aucun effet disponible : cases verrouillées ou aucun nouveau bonus.');
 // Exactly 25% empty; split the other 75% evenly among possible effects.
 const value=rng();
 const type=value<0.25?'none':available[Math.min(available.length-1,Math.floor((value-0.25)/0.75*available.length))];
 spend(p,80);s.reward={id,type};
 s.log.push(`${p.name} dépense 80 $ : ${ {none:'aucun bonus',steal:'vol',lock:'verrouillage',bonus:'bonus aléatoire',vision:'Vision du futur',sabotage:'Sabotage du futur'}[type] }.`);
 if(type==='bonus'){
  const card={...choose(cards,rng)};p.slots.Bonus.card=card;s.reward.card=card;
  s.log.push(`${p.name} reçoit ${card.name}.`);
 }
}
export function resolveBonus(s,key){
 const r=s.reward;if(!r)fail('Aucun bonus en cours.');
 if(['vision','sabotage'].includes(r.type))fail('Choisissez votre carte parmi les quatre proposées.');
 const p=player(s,r.id),other=s.players[1-r.id];
 if(r.type==='steal'||r.type==='lock'){
  if(!targets(s,r.id,r.type).includes(key))fail('Cible invalide.');
  const source=other.slots[key];
  if(r.type==='steal'){p.slots[key].card=source.card;source.card=null;s.log.push(`${p.name} vole ${p.slots[key].card.name}.`);}
  else{source.locked=true;s.log.push(`${p.name} verrouille ${LABELS[key]} de ${other.name}.`);}
 }
 s.reward=null;
}
export function finish(s){active(s);if(s.pending)fail('Terminez l’enchère avant de conclure.');s.ended=true;}
