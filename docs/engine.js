export function shuffle(items, rng=Math.random) {
 const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;
}
export function pick(items){if(!items.length)throw Error('Liste vide');return items[Math.floor(Math.random()*items.length)];}
export function makeTeams(players){const p=shuffle(players);return [p.filter((_,i)=>i%2===0),p.filter((_,i)=>i%2===1)];}
export function makeAuction(players,cards,slots){
 if(players.length<4||cards.length<2*slots)throw Error('Pas assez de joueurs ou de personnages.');
 const teams=makeTeams(players);let schedule=[];
 for(let k=0;k<cards.length;k++)schedule.push({team:k%2,name:teams[k%2][Math.floor(k/2)%teams[k%2].length]});
 return {teams,budgets:[500,500],rosters:[[],[]],deck:shuffle(cards),index:0,schedule,slots,log:[],phase:'handoff'};
}
export function buy(s,team,price){
 if(![0,1].includes(team)||!Number.isInteger(price)||price<10||price%10||price>s.budgets[team])throw Error('Montant invalide : multiple de 10 $, dans le budget disponible.');
 if(s.rosters[team].length>=s.slots)throw Error('Cette équipe est complète.');
 if(!s.deck[s.index])throw Error('Pioche épuisée.');
 s.rosters[team].push({card:s.deck[s.index],price});s.budgets[team]-=price;
 s.log.push({team,price,card:s.deck[s.index]});s.index++;s.phase='handoff';
}
export function auctionDone(s){return s.index>=s.deck.length||s.rosters.every((r,i)=>r.length>=s.slots||s.budgets[i]<10);}
// Each eligible pair includes a character from the selected universe.
export function undercoverGroups(groups, cards) {
 const native = new Set(cards.filter(c => c.kind === 'characters').map(c => c.name));
 const available = new Set(cards.filter(c => ['characters', 'undercover_only'].includes(c.kind)).map(c => c.name));
 return groups.map(group => {
  const members = [...new Set(group.members)].filter(name => available.has(name));
  const pairs = [];
  for (let i = 0; i < members.length; i++) {
   for (let j = i + 1; j < members.length; j++) {
    if (native.has(members[i]) || native.has(members[j])) pairs.push([members[i], members[j]]);
   }
  }
  return pairs;
 }).filter(pairs => pairs.length);
}
export function makeUndercover(players, groups, undercover, white, cards) {
 const n = players.length;
 if (!Number.isInteger(undercover) || !Number.isInteger(white) || undercover < 0 || white < 0 || undercover + white < 1 || n - undercover - white <= undercover + white) {
  throw Error('Il faut au moins un intrus et une majorité stricte de civils au départ.');
 }
 const eligible = undercoverGroups(groups, cards);
 if (!eligible.length) throw Error('Aucun groupe compatible : deux noms avec une photo sont nécessaires, dont au moins un dans characters de cet univers.');
 let [civil, intruder] = shuffle(pick(pick(eligible)));
 const native = new Set(cards.filter(c => c.kind === 'characters').map(c => c.name));
 // With only Mr. White, the civil word is the only word actually dealt.
 if (undercover === 0 && !native.has(civil)) [civil, intruder] = [intruder, civil];
 const roles = shuffle([...Array(n-undercover-white).fill('civil'), ...Array(undercover).fill('undercover'), ...Array(white).fill('white')]);
 return {players:players.map((name,i)=>({name,role:roles[i],alive:true})), civil, intruder, index:0, phase:'handoff', round:1, first:pick(players), winner:null};
}
export function victory(players){
 const c=players.filter(p=>p.alive&&p.role==='civil').length;
 const intruders=players.filter(p=>p.alive&&p.role!=='civil').length;
 if(!intruders)return 'Les civils';if(intruders>=c)return 'Les intrus';return null;
}
export function topCards(cards) {
 return cards.filter(c => ['characters', 'locations', 'groups', 'objects'].includes(c.kind));
}
export function makeTop(cards, criterion = '') {
 const deck = shuffle(topCards(cards)).slice(0, 10);
 if (deck.length !== 10) throw Error('Dix cartes minimum dans cet univers, hors Undercover uniquement.');
 return {criterion: String(criterion).trim().slice(0, 200), deck, slots:Array(10).fill(null), index:0, phase:'playing'};
}
export function place(s,index){if(!Number.isInteger(index)||index<0||index>=10||s.slots[index]||s.index>=10)throw Error('Place indisponible.');s.slots[index]=s.deck[s.index++];if(s.index===10)s.phase='end';}
