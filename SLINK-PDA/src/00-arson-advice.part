// Advisory-only Arson rules. No DOM, network, timers, or gameplay actions.
// Material categories and ordinary consumption: https://wiki.torn.com/wiki/Arson
(function installArsonAdvice(global) {
  'use strict';
  const families = Object.freeze({
    liquid:['Gasoline','Diesel','Kerosene'],
    solid:['Potassium Nitrate','Magnesium Shavings','Thermite'],
    gas:['Oxygen Tank','Methane Tank','Hydrogen Tank'],
    igniter:['Lighter','Windproof Lighter','Molotov Cocktail','Flamethrower'],
    dampener:['Blanket','Sand','Fire Extinguisher']
  });
  const reusable = new Set(['Lighter','Windproof Lighter','Flamethrower','Blanket']);
  const materials = Object.freeze(Object.fromEntries(Object.entries(families).flatMap(([family,names]) =>
    names.map(name=>[name,Object.freeze({name,family,consumed:!reusable.has(name),evidence:'documented'})]))));
  const phases = Object.freeze({
    preparation:Object.freeze({place:['liquid','solid','gas'],ignite:['igniter']}),
    burning:Object.freeze({stoke:['liquid','solid','gas'],dampen:['dampener']})
  });
  const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
  // Qualitative exclusions from the Arson material reference; not a numeric
  // insurance threshold or a prediction of the job's accumulated suspicion.
  const highSuspicion=new Set(['Gasoline','Magnesium Shavings','Flamethrower']);
  // Community estimates from the implementation spec, used only to order
  // provisional single placements. They cannot certify a complete formula.
  const lowSuspicionStarters=new Map([['Methane Tank',-3],['Oxygen Tank',1],['Kerosene',3],['Potassium Nitrate',3]]);
  const isInsurance=requirements=>requirements?.some(row=>row?.kind==='insurance')===true;
  const isAccidental=requirements=>requirements?.some(row=>row?.kind==='accidental')===true;
  const suspicionBlocks=(name,requirements)=>(isInsurance(requirements)||isAccidental(requirements))&&highSuspicion.has(name);
  function suspicionPass(candidate,assessment){
    return assessment?.status==='pass'&&assessment.evidence==='validated'&&Number.isFinite(assessment.suspicion)&&
      !candidate.steps?.some(step=>highSuspicion.has(step.name));
  }
  function visibilityLevels(requirements){
    return [...new Set((requirements||[]).filter(row=>row?.kind==='visibility').map(row=>row.level))];
  }
  function visibilityPass(candidate,levels){
    const assessment=candidate.visibilityAssessment;
    return levels.length===1&&['high','low'].includes(levels[0])&&assessment?.level===levels[0]&&
      assessment.status==='pass'&&assessment.evidence==='validated'&&Number.isFinite(assessment.visibility);
  }
  function damagePass(candidate,limits){
    const result=candidate.damageAssessment;
    if(result?.evidence!=='validated'||result.status!=='pass'||
      !Number.isFinite(result.min)||!Number.isFinite(result.max)||result.min<0||result.max>100||result.min>result.max)return false;
    return limits.every(limit=>{
      if(limit?.kind==='total')return result.min===100&&result.max===100;
      if(limit?.kind==='maximum')return Number.isFinite(limit.max)&&result.max<limit.max;
      if(limit?.kind==='minimum')return Number.isFinite(limit.min)&&result.min>limit.min;
      // Until Torn's endpoints are verified, require the whole estimate
      // to fall strictly inside a displayed range.
      return limit?.kind==='range'&&Number.isFinite(limit.min)&&Number.isFinite(limit.max)&&result.min>limit.min&&result.max<limit.max;
    });
  }
  function describe(observation, snapshot) {
    const material=Object.hasOwn(materials,observation?.name)?materials[observation.name]:null;
    const owned=count(observation?.ownedQty);
    const result=(status,reason)=>({material,owned,status,reason});
    if(!material)return result('unknown','Unrecognized material.');
    if(!snapshot?.jobId || snapshot.complete!==true || snapshot.revision==null || observation.revision!==snapshot.revision)
      return result('unknown','The current job or material state could not be confirmed.');
    if(observation.usableNow===false || observation.unlocked===false || owned===0)
      return result('unavailable',observation.disabledReason || 'Torn does not currently show this material as usable.');
    if(observation.usableNow!==true || owned===null)
      return result('unknown','Availability or inventory is not confirmed.');
    const actions=Object.hasOwn(phases,snapshot.phase)?phases[snapshot.phase]:null;
    const allowed=actions&&Object.hasOwn(actions,observation.action)?actions[observation.action]:null;
    if(!allowed || !allowed.includes(material.family))
      return result('unknown','The material and current action could not be matched.');
    if(!Array.isArray(snapshot.requirements))return result('unknown','Job requirements were not observed.');
    if(suspicionBlocks(material.name,snapshot.requirements))
      return result('incompatible',material.name+' is excluded from low-suspicion advice for this job.');
    const accelerant=['liquid','solid','gas'].includes(material.family);
    for(const requirement of snapshot.requirements) {
      if(requirement?.kind==='family' && accelerant && ['liquid','solid','gas'].includes(requirement.family)
          && requirement.family!==material.family)
        return result('incompatible','This job requires '+requirement.family+' accelerants.');
    }
    if(snapshot.requirements.some(row=>row?.kind!=='family' || !['liquid','solid','gas'].includes(row.family)))
      return result('conditional','An additional job requirement still needs evaluation.');
    if(count(snapshot.currentNerve)===null || count(observation.nerveCost)===null)
      return result('conditional','Current nerve or action cost is not confirmed.');
    if(snapshot.currentNerve<observation.nerveCost)return result('unavailable','Not enough nerve for the observed action.');
    return result('compatible','Matches the observed material, phase, and supported requirements. This is not a success prediction.');
  }
  function remainingCost(steps, observations, quotes) {
    if(!Array.isArray(steps)||!steps.length)return {nerve:null,materials:null,stock:'unknown'};
    const used=new Map();
    let nerve=0,total=0,stock='confirmed',knownNerve=true,knownCost=true;
    for(const step of steps){
      const quantity=count(step.quantity),cost=count(step.nerveCost);
      if(!quantity || cost===null)knownNerve=false;
      else nerve+=cost*quantity;
      if(!step.name)continue;
      const item=Object.hasOwn(materials,step.name)?materials[step.name]:null;
      if(!item||!quantity){knownCost=false;if(stock!=='insufficient')stock='unknown';continue;}
      const required=item.consumed?(used.get(step.name)||0)+quantity:1;
      used.set(step.name,required);
      const owned=count(observations.get(step.name)?.ownedQty);
      if(owned!==null&&owned<required)stock='insufficient';
      else if(owned===null&&stock!=='insufficient')stock='unknown';
      if(!item.consumed)continue;
      const quote=quotes.get(step.name);
      if(quote?.stale!==false || !quote.source || !Number.isFinite(quote.fetchedAt) || quote.fetchedAt<=0 ||
        !Number.isFinite(quote.unitPrice) || quote.unitPrice<0)knownCost=false;
      else total+=quote.unitPrice*quantity;
    }
    return {nerve:knownNerve?nerve:null,materials:knownCost?total:null,stock};
  }
  // Inventory is shared for comparison, not reserved across competing jobs.
  // Each candidate is a separate what-if. Future steps must be checked by
  // the candidate generator; a selectable item alone is not a valid formula.
  function rankJobs(jobs,inventory,quotes,objective='profit'){
    if(!['profit','skillPerNerve'].includes(objective))throw new RangeError('Unknown Arson objective.');
    return jobs.map(job=>{
      const rankable=[];
      const insurance=isInsurance(job.requirements);
      const accidental=isAccidental(job.requirements);
      const visibility=visibilityLevels(job.requirements);
      const damage=(job.requirements||[]).filter(row=>row?.kind==='damage').map(row=>row.limit);
      for(const candidate of job.candidates||[]){
        if(!job.jobId||!job.complete||job.revision==null||candidate.jobId!==job.jobId||candidate.revision!==job.revision||candidate.compatibility!=='confirmed')continue;
        if(insurance&&!suspicionPass(candidate,candidate.insuranceAssessment))continue;
        if(accidental&&!suspicionPass(candidate,candidate.accidentalAssessment))continue;
        if(visibility.length&&!visibilityPass(candidate,visibility))continue;
        if(damage.length&&!damagePass(candidate,damage))continue;
        const cost=remainingCost(candidate.steps,inventory,quotes);
        if(cost.stock!=='confirmed'||!(cost.nerve>0))continue;
        const totalNerve=count(candidate.totalNerve);
        const score=objective==='profit'
          ? Number.isFinite(candidate.estimatedPayout)&&candidate.estimatedPayout>=0&&cost.materials!==null
            ? candidate.estimatedPayout-cost.materials : null
          : Number.isFinite(candidate.estimatedSkill)&&candidate.estimatedSkill>=0&&totalNerve>=cost.nerve
            ? candidate.estimatedSkill/totalNerve : null;
        const consumed=candidate.steps.reduce((sum,step)=>sum+(Object.hasOwn(materials,step.name)&&materials[step.name].consumed?step.quantity:0),0);
        if(score!==null||insurance||accidental||visibility.length||damage.length)rankable.push({candidate,cost,score,consumed});
      }
      rankable.sort((a,b)=>(insurance?a.candidate.insuranceAssessment.suspicion-b.candidate.insuranceAssessment.suspicion:0)||
        (accidental?a.candidate.accidentalAssessment.suspicion-b.candidate.accidentalAssessment.suspicion:0)||
        (visibility.length?(a.candidate.visibilityAssessment.visibility-b.candidate.visibilityAssessment.visibility)*(visibility[0]==='high'?-1:1):0)||
        (b.score??-Infinity)-(a.score??-Infinity)||(objective==='skillPerNerve'?a.consumed-b.consumed:0)||a.cost.nerve-b.cost.nerve||
        (a.cost.materials??Infinity)-(b.cost.materials??Infinity));
      const recommended=rankable[0]||null;
      // A fallback is a complete, independently validated formula supplied
      // by the generator, never a blind swap based on matching item families.
      const replaced=recommended?.candidate.replaces;
      const preferred=replaced&&(job.candidates||[]).find(row=>row.id===replaced&&row.jobId===job.jobId&&row.revision===job.revision);
      const substitution=preferred&&preferred.compatibility==='confirmed'&&remainingCost(preferred.steps,inventory,quotes).stock==='insufficient'
        ? {preferredId:preferred.id,fallbackId:recommended.candidate.id,reason:'The preferred formula needs more stock than is available.'}:null;
      return {jobId:job.jobId,objective,recommended,alternative:rankable[1]||null,substitution,
        reason:rankable.length?null:damage.length?'Skip this job for now: no available formula is confirmed to meet its damage and other job requirements.':
          visibility.length?'Skip this job for now: no available formula is confirmed to meet its visibility and other job requirements.':
          insurance?'Skip this job for now: no available formula is confirmed to meet its Insurance Claim requirements.':
          accidental?'Skip this job for now: no available formula is confirmed to meet its Accidental Cause requirements.':
          'Skip this job for now: no available formula is confirmed to meet its requirements and support the selected objective.'};
    });
  }
  function requirementKey(requirement){
    if(requirement?.kind==='family'&&['liquid','solid','gas'].includes(requirement.family))return 'family:'+requirement.family;
    if(requirement?.kind==='visibility'&&['high','low'].includes(requirement.level))return 'visibility:'+requirement.level;
    if(['accidental','insurance'].includes(requirement?.kind))return requirement.kind;
    if(requirement?.kind==='damage'&&requirement.limit?.label)return 'damage:'+requirement.limit.label.toLowerCase();
    return null;
  }
  function generateJobFormulas(jobs,inventory,quotes,{objective='profit',templates=[]}={}){
    const prepared=jobs.map(job=>{
      const candidates=[],starters=[];
      if(job.complete!==true||!job.jobId||job.revision==null||!Array.isArray(job.requirements))return {...job,candidates,starters};
      const keys=job.requirements.map(requirementKey);
      const requiredFamilies=new Set(job.requirements.filter(row=>row?.kind==='family').map(row=>row.family));
      if(requiredFamilies.size>1)return {...job,candidates,starters};
      const allowedFamily=requiredFamilies.values().next().value;
      const materialAllowed=name=>!suspicionBlocks(name,job.requirements)&&
        (!allowedFamily||!['liquid','solid','gas'].includes(materials[name]?.family)||materials[name].family===allowedFamily);
      // Only externally validated target-specific templates are eligible for
      // completion scoring. Shared inventory never certifies action availability.
      for(const template of templates){
        if(!job.targetKey||template.targetKey!==job.targetKey||template.phase!==job.phase||
          template.evidence!=='validated'||keys.includes(null)||!Array.isArray(template.requirements)||
          [...new Set(keys)].sort().join('|')!==[...new Set(template.requirements)].sort().join('|')||
          !Array.isArray(template.steps)||!template.steps.length)continue;
        const steps=template.steps.map(step=>({...step}));
        const first=steps[0];
        if(first.action!==job.action||count(job.currentNerve)===null||count(job.actionNerveCost)===null||
          first.nerveCost!==job.actionNerveCost||job.currentNerve<first.nerveCost||
          (first.name ? !job.usableMaterials?.includes(first.name) : job.actionUsable!==true))continue;
        if(steps.some(step=>step.name&&(!Object.hasOwn(materials,step.name)||!materialAllowed(step.name))))continue;
        if(steps.at(-1).action!=='collect'||(job.phase==='preparation'&&!steps.some(step=>step.action==='ignite')))continue;
        candidates.push({...template,steps,jobId:job.jobId,revision:job.revision,compatibility:'confirmed'});
      }
      if(job.phase==='preparation'&&job.action==='place'&&count(job.currentNerve)!==null&&count(job.actionNerveCost)>0&&job.currentNerve>=job.actionNerveCost){
        for(const [name,observation] of inventory){
          if(!['liquid','solid','gas'].includes(materials[name]?.family)||!materialAllowed(name)||
            !(count(observation?.ownedQty)>0)||!job.usableMaterials?.includes(name)||
            ((isInsurance(job.requirements)||isAccidental(job.requirements))&&!lowSuspicionStarters.has(name)))continue;
          const steps=[{action:'place',name,quantity:1,nerveCost:job.actionNerveCost}];
          starters.push({steps,cost:remainingCost(steps,inventory,quotes),status:'conditional',
            reason:'Selectable placement only. Remaining requirements and the full recipe are not validated.'});
        }
        starters.sort((a,b)=>((isInsurance(job.requirements)||isAccidental(job.requirements))?lowSuspicionStarters.get(a.steps[0].name)-lowSuspicionStarters.get(b.steps[0].name):0)||
          (objective==='profit'?(a.cost.materials??Infinity)-(b.cost.materials??Infinity):0));
      }
      return {...job,candidates,starters};
    });
    return rankJobs(prepared,inventory,quotes,objective).map((row,index)=>({...row,
      starters:(isInsurance(prepared[index].requirements)||isAccidental(prepared[index].requirements)||visibilityLevels(prepared[index].requirements).length||
        prepared[index].requirements?.some(requirement=>requirement?.kind==='damage'))&&!row.recommended?[]:prepared[index].starters}));
  }
  function observedFormula(job,inventory,records,starter=[],building={}){
    if(!inventory.size)return {reason:'Open the material picker to check what you have unlocked and in stock.'};
    const requirements=job.requirements||[];
    if(requirements.some(row=>!requirementKey(row)))return {reason:'No formula can be checked against all of this job’s requirements.'};
    if(job.phase==='burning'||job.phase==='collection')return {reason:'A full recipe starts before ignition. Use the current damage and fire guidance below.'};
    const choices=[];
    function fits(record){
      if(!record.steps?.length||!record.steps.some(step=>step.action==='ignite'))return false;
      const used=new Map();let valid=true;
      for(const step of record.steps){
        const item=materials[step.item],stock=inventory.get(step.item);
        if(!item||!stock||stock.locked!==false||suspicionBlocks(step.item,requirements)){valid=false;break;}
        if(['liquid','solid','gas'].includes(item.family)&&requirements.some(row=>row.kind==='family'&&row.family!==item.family)){valid=false;break;}
        const quantity=item.consumed?(used.get(step.item)||0)+1:1;
        const owned=stock.ownedQty??(!item.consumed&&stock.locked===false&&/ is unavailable at this stage$/.test(stock.disabledReason||'')?1:null);
        if(!Number.isSafeInteger(owned)||owned<quantity){valid=false;break;}
        used.set(step.item,quantity);
      }
      if(!valid)return false;
      if(job.action==='place'){
        const first=record.steps[0];
        if(first.action!=='place'||inventory.get(first.item)?.selectable===false)return false;
      }
      return true;
    }
    const remaining=steps=>job.action==='ignite'?steps.slice(steps.findIndex(step=>step.action==='ignite')):steps;
    for(const record of records||[]){const candidate={...record,steps:remaining(record.steps||[])};if(fits(candidate))choices.push(candidate);}
    const recipe=remaining(starter);
    // Keep the scenario's original sequence and timing for modified jobs.
    // It is a starting point, not proof of a damage or visibility outcome.
    if(!choices.length&&fits({steps:recipe}))return {record:{steps:recipe},provisional:true,modified:requirements.some(row=>row.kind!=='family')};
    // A single-area total burn has no upper damage limit. Replace the
    // high-unlock tool with separate ignition and fuel actions, not a
    // one-for-one material swap across incompatible actions.
    if(!choices.length&&building.areas===1&&requirements.some(row=>row.kind==='damage'&&row.limit.kind==='total')&&
      requirements.every(row=>row.kind==='family'||row.kind==='damage'&&row.limit.kind==='total')&&
      recipe.some(step=>step.item==='Flamethrower'&&step.action==='ignite')&&
      recipe.every(step=>step.item!=='Flamethrower'||['ignite','stoke'].includes(step.action))){
      const fuel=starter.find(step=>step.action==='place'&&['liquid','solid','gas'].includes(materials[step.item]?.family))?.item;
      for(const igniter of ['Windproof Lighter','Lighter']){
        const steps=recipe.map(step=>step.item!=='Flamethrower'?step:step.action==='ignite'?{...step,item:igniter}:{...step,item:fuel,timing:'Only if damage stalls below 100% and the fire is still burning'});
        if(fits({steps}))return {record:{steps},provisional:true,modified:true,substitution:true};
      }
    }
    if(!choices.length&&requirements.every(row=>row.kind==='family')){
      const ignitions=recipe.filter(step=>step.action==='ignite');
      if(ignitions.length===1&&!recipe.some(step=>step.action!=='ignite'&&materials[step.item]?.family==='igniter')){
        for(const item of ['Windproof Lighter','Lighter','Molotov Cocktail','Flamethrower']){
          if(item===ignitions[0].item)continue;
          const steps=recipe.map(step=>step.action==='ignite'?{...step,item}:step);
          if(fits({steps}))return {record:{steps},provisional:true,substitution:true};
        }
      }
    }
    if(!choices.length)return {reason:'No successful recipe is confirmed for this job with the materials you have. Don’t start it based on an unverified substitution.'};
    choices.sort((a,b)=>b.successes-a.successes||a.steps.length-b.steps.length);
    return {record:choices[0]};
  }
  const api=Object.freeze({materials,describe,remainingCost,rankJobs,generateJobFormulas,observedFormula});
  if(global.SLINK_EXTENSION?.define)global.SLINK_EXTENSION.define('core','arsonAdvice',api);
  else global.SLINK_ARSON_ADVICE=api;
})(globalThis);
