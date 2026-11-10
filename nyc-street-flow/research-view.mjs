export const fmt=(v,d=1)=>v==null||!Number.isFinite(Number(v))?'Unavailable':Number(v).toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d});
export const sign=(v,d=1)=>v==null?'Unavailable':(v>0?'+':v<0?'−':'')+fmt(Math.abs(v),d);
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const link=(label,url)=>`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`;
export const dl=(label,file)=>`<a class="btn" href="research/${esc(file)}" download>${esc(label)}</a>`;
export const table=(heads,rows)=>`<div class="over-scroll"><table class="datatable research-table"><thead><tr>${heads.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
export function lineChart(rows,series,label){
 const vals=rows.flatMap(r=>series.map(s=>r[s.key])).filter(v=>v!=null&&Number.isFinite(v));
 if(!vals.length)return '<p>No comparable observations.</p>';
 const W=920,H=280,L=65,R=20,T=20,B=38,max=Math.max(...vals)*1.08||1;
 const x=i=>L+i*(W-L-R)/Math.max(1,rows.length-1),y=v=>H-B-v/max*(H-T-B);
 const colors=['#246846','#7c5898','#bd683b','#315e87'];
 let svg='';
 for(let i=0;i<5;i++){const v=i*max/4;svg+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#dfe5d9"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="#526453">${fmt(v,0)}</text>`;}
 const opening=rows.findIndex(r=>r.month==='2021-09');
 if(opening>=0)svg+=`<line x1="${x(opening)}" x2="${x(opening)}" y1="${T}" y2="${H-B}" stroke="#7b8176" stroke-dasharray="4 4"/><text x="${x(opening)+6}" y="${T+9}" font-size="11" fill="#526453">Sep 2021 opening</text>`;
 rows.forEach((r,i)=>{if(i===0||i===rows.length-1||r.month.endsWith('-01')||(rows.length<=12&&i%3===0))svg+=`<text x="${x(i)}" y="${H-12}" font-size="11" text-anchor="middle" fill="#526453">${esc(r.month)}</text>`;});
 series.forEach((s,j)=>{let pen=false;let d='';for(let i=0;i<rows.length;i++){const v=rows[i][s.key];if(v==null||!Number.isFinite(v)){pen=false;continue;}d+=`${pen?'L':'M'}${x(i)},${y(v)} `;pen=true;}svg+=`<path d="${d}" fill="none" stroke="${colors[j%4]}" stroke-width="2.4"/>`;});
 return `<div class="research-legend">${series.map((s,j)=>`<span><i style="background:${colors[j%4]}"></i>${esc(s.label)}</span>`).join('')}</div><svg class="research-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${svg}</svg>`;
}
