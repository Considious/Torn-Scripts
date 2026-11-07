(function(g){
  'use strict';
  const id=v=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):0;
  const label=(value,fallback)=>typeof value==='string'&&value.trim()?value.trim().replace(/\s+/g,' ').slice(0,100):fallback;
  const identity=session=>{
    const user=id(session?.userId??session?.user_id),faction=id(session?.factionId??session?.faction_id);
    return user&&faction?user+':'+faction:'';
  };
  function summarize(crimes,items,members){
    const active=(Array.isArray(crimes)?crimes:[]).filter(c=>['Recruiting','Planning'].includes(c?.status));
    const lines=[];
    for(const crime of active.slice(0,50)){
      const slots=Array.isArray(crime.slots)?crime.slots:[];
      lines.push(label(crime.name,'Organized Crime')+' — '+crime.status+(id(crime.id)?' (#'+id(crime.id)+')':''));
      if(!slots.length)lines.push('  Slot details unavailable');
      for(const slot of slots.slice(0,16)){
        if(!slot||typeof slot!=='object')continue;
        const user=id(slot.user?.id),role=label(slot.position_info?.label??slot.position,'Role');
        const who=user?label(members.get(user)??slot.user?.name,'Player '+user)+' ['+user+']':slot.user===null?'Open':'Assignment unavailable';
        const req=slot.item_requirement,item=id(req?.id);
        lines.push('  '+role+': '+who+(user&&item&&req.is_available===false?' · Missing '+label(items.get(item),'Item '+item):''));
      }
      if(slots.length>16)lines.push('  Additional slots not shown');
      lines.push('');
    }
    if(active.length>50)lines.push('Showing the first 50 active crimes.');
    return lines.join('\n').trim();
  }
  g.SLINK_OC_PARTICIPANTS=Object.freeze({identity,summarize});
})(globalThis);
