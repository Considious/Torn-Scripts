(function(g){
  'use strict';
  function cell(value){
    let s=String(value??'');
    if(typeof value!=='number'&&/^(?:\s*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]|[\t\r\n])/.test(s))s="'"+s;
    return '"'+s.replaceAll('"','""')+'"';
  }
  const csv=(headers,rows)=>[headers,...rows].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
  function native(root,war){
    const selectors=war?'.members-list > li':'.table-body > li';
    const order=Array.from(root.querySelectorAll(selectors)).filter(r=>r.getClientRects().length&&getComputedStyle(r).visibility!=='hidden'&&!r.closest('[aria-hidden="true"],[hidden]')).map(r=>({r,top:r.getBoundingClientRect().top}));
    if(!war)order.sort((a,b)=>a.top-b.top);
    const rows=[];
    for(const {r} of order.slice(0,300)){
      const links=Array.from(r.querySelectorAll('a[href*="profiles.php?XID="]'));
      const a=links.find(n=>n.textContent.trim())||links[0];
      const id=a?.getAttribute('href')?.match(/[?&]XID=(\d+)/i)?.[1];if(!id)continue;
      const text=s=>r.querySelector(s)?.textContent.trim()||'';
      rows.push([id,a.textContent.trim()||a.title, text('.lvl,.level'),text('.status .ellipsis')||text('.status'),
        war?(r.classList.contains('enemy')?'Opponent':r.classList.contains('your')?'Your faction':''):text('.position .ellipsis')||text('.position'),
        'https://www.torn.com/profiles.php?XID='+id]);
    }
    return rows.length?csv(['Player ID','Name','Level','Status',war?'Side':'Role','Profile'],rows):'';
  }
  function officer(kind,rows,at,error){
    if(!Array.isArray(rows)||!rows.length)return '';
    const stamp=Number.isFinite(at)&&at>0?new Date(at).toISOString():'',fresh=error?'Latest check failed; last available results':'Last successful check';
    return kind==='missing'?csv(['Crime ID','Crime','Role','Player ID','Player','Item ID','Missing item','Checked UTC','Result status'],
      rows.slice(0,800).map(r=>[r.crimeId,r.crimeName,r.position,r.userId,r.userName,r.itemId,r.itemName,stamp,fresh])):
      csv(['Item','Current','Target','Shortage','Checked UTC','Result status'],rows.slice(0,800).map(r=>[r.name,r.current,r.target,Math.max(0,r.target-r.current),stamp,fresh]));
  }
  function attach(host,{name,file,produce}){
    const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
    const area=el('div'),build=el('button',name),status=el('span'),manual=el('textarea'),copy=el('button','Copy CSV'),download=el('button','Download CSV');
    build.type=copy.type=download.type='button';status.setAttribute('role','status');
    manual.readOnly=true;manual.rows=4;manual.style.cssText='display:block;width:100%;box-sizing:border-box';manual.setAttribute('aria-label',name+' text');
    const controls=el('div');controls.hidden=true;controls.append(copy,download,manual);
    area.append(build,status,controls);host.append(area);
    function current(){
      const text=produce();
      if(!text){controls.hidden=true;manual.value='';status.textContent=' No rows available to export.';return '';}
      controls.hidden=false;manual.value=text;status.textContent='';return text;
    }
    build.onclick=current;
    copy.onclick=async()=>{
      const text=current();if(!text)return;
      try{await navigator.clipboard.writeText(text);status.textContent=' CSV copied.';}
      catch{manual.focus();manual.select();status.textContent=' Select and copy the CSV below.';}
    };
    download.onclick=()=>{
      const text=current();if(!text)return;
      try{
        const url=URL.createObjectURL(new Blob(['\uFEFF',text],{type:'text/csv;charset=utf-8'})),a=el('a');
        a.href=url;a.download=file;area.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
        status.textContent=' If your browser didn’t save the file, use Copy CSV.';
      }catch{status.textContent=' Download unavailable. Use Copy CSV.';}
    };
    return area;
  }
  g.SLINK_FACTION_CSV=Object.freeze({csv,native,officer,attach});
})(globalThis);
