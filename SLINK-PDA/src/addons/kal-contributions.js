(function installKalContributions(global){
  'use strict';
  if(global.SLINK_KAL_CONTRIBUTIONS)return;
  const DESTINATION='https://kalends.dev/api/script/upload-loadout';
  const MAX_ATTEMPTS=4,MAX_AGE=24*60*60_000;
  const fields=new Set(['capture_id','payload_source','target_id','captured_at','fight_id','attack_status','show_enemy_items','travel_state','defender_items','ammo','log_id','master_log']);
  function valid(c){return c&&typeof c==='object'&&Object.keys(c).every(key=>fields.has(key))&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(c.capture_id||'')&&Number.isSafeInteger(c.target_id)&&c.target_id>0&&Number.isFinite(Date.parse(c.captured_at))&&['native','rewritten'].includes(c.payload_source)&&c.defender_items&&typeof c.defender_items==='object'&&!Array.isArray(c.defender_items)&&Object.keys(c.defender_items).length>0;}
  function create({store,auth,request,now=Date.now,schedule=()=>{},lock=work=>work()}){
    let running=null,queue=Promise.resolve();
    const serial=work=>{const p=queue.catch(()=>{}).then(work);queue=p;return p;};
    async function state(){const value=await store.get();if(value==null)return{schema:1,records:[],lastSuccess:null,lastFailure:null};if(value.schema!==1||!Array.isArray(value.records))throw Error('KAL pending storage is damaged or unsupported. Existing observations were preserved.');return value;}
    async function mutate(work){return serial(async()=>{const s=await state();const result=work(s);if(new TextEncoder().encode(JSON.stringify(s)).byteLength>256*1024)throw Error('KAL pending storage limit reached. Existing observations were preserved.');await store.set(s);return result;});}
    async function status(){const s=await state();return{pendingCount:s.records.filter(r=>['queued','retry','sending','uncertain'].includes(r.state)).length,lastSuccess:s.lastSuccess,lastFailure:s.lastFailure,uncertainCount:s.records.filter(r=>r.state==='uncertain'||r.state==='sending').length};}
    async function enqueue(capture){
      if(!valid(capture))throw Error('KAL observation failed validation.');
      const account=await auth();if(!account?.enabled)return{queued:false};
      const queued=await lock(()=>mutate(s=>{
        if(s.records.some(r=>r.id===capture.capture_id))return false;
        if(s.records.length>=100){s.records=s.records.filter(r=>r.state!=='accepted'&&now()-r.created<MAX_AGE);if(s.records.length>=100)throw Error('KAL pending queue is full.');}
        s.records.push({id:capture.capture_id,scope:account.scope,capture:structuredClone(capture),created:now(),attempts:0,state:'queued',nextAt:now()});return true;
      }));
      if(queued)void drain().catch(()=>{});return{queued};
    }
    function drain(){if(running)return running;running=lock(run).finally(()=>{running=null;});return running;}
    async function run(){
      const account=await auth();if(!account?.enabled)return;
      // A process that stopped after dispatch cannot know whether KAL accepted it.
      await mutate(s=>{for(const r of s.records)if(r.state==='sending'){r.state='uncertain';s.lastFailure='A previous submission has no acknowledgement; it will not be replayed automatically.';}});
      for(;;){
        let row;
        await mutate(s=>{
          for(const r of s.records)if(['queued','retry'].includes(r.state)&&(now()-r.created>MAX_AGE||r.attempts>=MAX_ATTEMPTS)){r.state='expired';s.lastFailure='A pending observation expired or reached its retry limit.';}
          row=s.records.find(r=>r.scope===account.scope&&['queued','retry'].includes(r.state)&&r.nextAt<=now());
          if(row){row.state='sending';row.attempts++;row=structuredClone(row);}
        });
        if(!row)break;
        const current=await auth();if(!current?.enabled||current.scope!==row.scope){await mutate(s=>{s.records.find(r=>r.id===row.id).state='queued';});break;}
        let response;try{response=await request(DESTINATION,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({key:current.key,version:'1.3.3',...row.capture}),credentials:'omit',redirect:'error'});}catch{response={status:0};}
        await mutate(s=>{
          const item=s.records.find(r=>r.id===row.id);if(!item)return;
          const status=Number(response.status)||0;
          if(status>=200&&status<300){item.state='accepted';delete item.capture;s.lastSuccess=now();s.lastFailure=null;return;}
          if(status===0){item.state='uncertain';s.lastFailure='No submission acknowledgement was received; automatic replay is stopped.';return;}
          let data;try{data=JSON.parse(response.text);}catch{}
          const retryable=status===408||status===429||status>=500;
          if(retryable&&item.attempts<MAX_ATTEMPTS){
            const seconds=Number(response.retryAfter),date=Date.parse(response.retryAfter);
            const guidance=response.retryAfter!=null&&Number.isFinite(seconds)?seconds*1000:Number.isFinite(date)?date-now():0;
            item.state='retry';item.nextAt=now()+Math.max([2000,5000,15000,30000][item.attempts-1],guidance);s.lastFailure='KAL temporarily rejected a submission; a bounded retry is pending.';
          }else{item.state='rejected';item.status=status;item.code=Number(data?.code)||null;s.lastFailure='KAL rejected a submission (HTTP '+status+').';}
        });
      }
      const s=await state(),next=s.records.filter(r=>r.scope===account.scope&&r.state==='retry').sort((a,b)=>a.nextAt-b.nextAt)[0];if(next)schedule(next.nextAt);
    }
    return Object.freeze({enqueue,drain,status});
  }
  global.SLINK_KAL_CONTRIBUTIONS=Object.freeze({create,valid,DESTINATION,MAX_ATTEMPTS});
})(globalThis);
