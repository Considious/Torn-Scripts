import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

for(const path of ['./src/00-ranked-gear-panel.part']){
 const scope={URL,URLSearchParams};
 runInNewContext(readFileSync(new URL(path,import.meta.url),'utf8'),scope);
 const {bazaarLink,highlightBazaar,rankedConfirmationMatches}=scope.SLINK_RANKED_GEAR;
 test(path+' narrows Item Market search and marks only the opened exact roll',()=>{
  const {itemMarketSearchLink,highlightMarketInfo}=scope.SLINK_RANKED_GEAR;
  const listing={source:'item_market',category:'melee',itemId:245,uid:'20931340887',price:46000000};
  const link=itemMarketSearchLink({...listing,bonuses:[{name:'Assassinate'},{name:'Warlord'}]});
  const url=new URL(link);
  const filters=new URLSearchParams(url.hash.slice('#/market/'.length));
  assert.equal(filters.get('categoryName'),'Melee');
  assert.equal(filters.get('priceFrom'),'45999999');
  assert.equal(filters.get('priceTo'),'46000001');
  assert.equal(filters.get('bonuses[0]'),'72');
  assert.equal(filters.get('bonuses[1]'),'81');
  const single=new URLSearchParams(new URL(itemMarketSearchLink({...listing,bonuses:[{name:'Unknown'},{name:' Double-Edged '}]})).hash.slice('#/market/'.length));
  assert.equal(single.get('bonuses[0]'),'74');
  assert.equal(single.has('bonuses[1]'),false);
  const search=entry=>new URLSearchParams(new URL(itemMarketSearchLink({...listing,...entry})).hash.slice('#/market/'.length));
  const primary=search({category:'primary',itemId:487,bonuses:[{name:'Wither'},{name:'Quicken'}]});
  assert.equal(primary.get('categoryName'),'Primary');
  assert.equal(primary.get('bonuses[0]'),'42');
  assert.equal(primary.get('bonuses[1]'),'88');
  const riot=search({category:'armor',itemName:'Riot Gloves',itemId:659,price:85799999,armor:46.35,bonuses:[{name:'Wither'}]});
  assert.equal(riot.get('categoryName'),'Defensive');
  assert.equal(riot.get('armourySet'),'riot');
  assert.equal(riot.get('armorFrom'),'46');
  assert.equal(riot.get('armorTo'),'47');
  assert.equal(riot.has('bonuses[0]'),false);
  const unknownArmor=search({category:'armor',itemName:'Other Gloves',armor:null});
  assert.equal(unknownArmor.has('armourySet'),false);
  assert.equal(unknownArmor.has('armorFrom'),false);
  const panel={marked:false,hasAttribute(){return this.marked;},setAttribute(){this.marked=true;},removeAttribute(){this.marked=false;}};
  const doc={getElementById:id=>id==='wai-itemInfo-245-20931340887'?panel:null,querySelectorAll:()=>panel.marked?[panel]:[]};
  highlightMarketInfo(doc,link);
  assert.equal(panel.marked,true);
  url.searchParams.set('slinkRankedMarket','245-20931340888');
  highlightMarketInfo(doc,url.href);
  assert.equal(panel.marked,false);
 });
 test(path+' highlights only a unique matching roll',()=>{
  const link=bazaarLink({uid:'21540674336',source:'bazaar',sellerId:2114675,itemId:16,price:29000000,rarity:'yellow',damage:52.39,accuracy:61.33,bonuses:[{name:'Deadeye',value:28}]});
  const fixture=(value=28)=>({
   querySelector:s=>s==='img.glow-yellow'?{}:{nextElementSibling:{textContent:s.includes('damage')?'52.39':'61.33'}},
   querySelectorAll:()=>[{dataset:{bonusAttachmentTitle:'Deadeye',bonusAttachmentDescription:value+'% increased critical hit damage'}}],
   getAttribute(){return this.uid;},
   setAttribute(name,uid){assert.equal(name,'data-slink-ranked-bazaar-match');this.uid=uid;this.marked=true;},
   removeAttribute(){this.uid=null;this.marked=false;}
  });
  const correct=fixture(),wrong=fixture(27),duplicate=fixture();
  const readers={itemId:()=>16,price:()=>29000000,available:()=>true};
  highlightBazaar([correct,wrong],readers,link);
  assert.equal(correct.marked,true);assert.equal(wrong.marked,false);
  highlightBazaar([correct,wrong,duplicate],readers,link);
  assert.equal(correct.marked,false);assert.equal(duplicate.marked,false);
  highlightBazaar([correct],{...readers,price:()=>30000000},link);
  assert.equal(correct.marked,false);
 });
 test(path+' verifies exact ranked confirmation and rejects mismatches',()=>{
  const id='buy-confirmation-msg-16-21540674336';
  const flow={itemId:16,rankedUid:'21540674336',price:29000000,quantity:1};
  const fixture=({name='Buy 1 x USP',total='$29,000,000',yesId=id}={})=>({querySelector:s=>s==='[id="'+id+'"]'
   ? {querySelector:q=>({textContent:q.includes('name___')?name:total})}
   : s==='button[aria-label="Yes"]'?{getAttribute:()=>yesId}:null});
  assert.equal(rankedConfirmationMatches(fixture(),flow),true);
  for(const patch of [{rankedUid:'21540674337'},{quantity:2},{itemId:17},{price:30000000}])assert.equal(rankedConfirmationMatches(fixture(),{...flow,...patch}),false);
  for(const patch of [{name:'Buy 2 x USP'},{total:''},{total:'$30,000,000'},{yesId:'another-listing'}])assert.equal(rankedConfirmationMatches(fixture(patch),flow),false);
 });
}
