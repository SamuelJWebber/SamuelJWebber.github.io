/* SVG charts for the Prediction Market Calibration Atlas. */
(function () {
  'use strict';
  const ns = 'http://www.w3.org/2000/svg';
  const observers = new WeakMap();
  const blue = '#245cbb', teal = '#087967', ink = '#47566f', grid = '#dce4ed';
  const num = value => value !== null && value !== undefined && value !== '' && Number.isFinite(+value);
  const pct = value => (100 * value).toFixed(1) + '%';
  const pp = value => (value > 0 ? '+' : '') + (100 * value).toFixed(2) + ' pp';
  const priceLabel = new Intl.NumberFormat('en-US',{style:'percent',maximumFractionDigits:12});
  const count = value => Number(value).toLocaleString('en-US');
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const metrics = {
    ece: { column: 5, name: 'Calibration bias', unit: 'pp', format: pp, color: teal },
    hit: { column: 4, name: 'Favorite win rate', unit: '%', format: pct, color: blue },
    brier: { column: 3, name: 'Brier score', unit: '', format: v => v.toFixed(3), color: blue }
  };

  function element(tag, attributes = {}, text) {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function add(parent, tag, attributes, text) {
    const node = element(tag, attributes, text);
    parent.append(node);
    return node;
  }

  function line(svg, x1, y1, x2, y2, opts = {}) {
    return add(svg, 'line', {x1, y1, x2, y2, stroke: grid, 'stroke-width': 1, ...opts});
  }

  function label(svg, x, y, text, options = {}) {
    return add(svg, 'text', {x, y, fill: ink, 'font-size': 11, ...options}, text);
  }

  function setup(container, rows, message, draw) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) return;
    observers.get(container)?.disconnect();
    container.replaceChildren();
    const frame = document.createElement('div');
    frame.style.cssText = 'position:relative;width:100%;min-width:0;font:inherit;color:#263655';
    container.append(frame);
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.style.cssText = 'margin:0;min-height:150px;display:grid;place-content:center;color:#52627b;text-align:center;padding:16px';
      empty.textContent = message;
      frame.append(empty);
      return;
    }
    const svg = element('svg', {tabindex:0, role:'slider', 'aria-orientation':'horizontal'});
    svg.style.cssText = 'display:block;width:100%;height:auto;overflow:visible;touch-action:pan-y;font-family:inherit;font-variant-numeric:tabular-nums;border-radius:4px';
    const tip = document.createElement('div');
    tip.style.cssText = 'position:absolute;z-index:2;pointer-events:none;padding:7px 10px;border:1px solid #314760;border-radius:6px;background:#192c45;color:#fff;font:500 12px/1.45 system-ui,sans-serif;white-space:pre-line;max-width:min(230px,94%);box-shadow:0 2px 8px #182b4126';
    tip.hidden = true;
    tip.setAttribute('aria-hidden','true');
    frame.append(svg,tip);
    let previousWidth = 0;
    function paint() {
      const w = Math.max(160, Math.round(frame.getBoundingClientRect().width || 460));
      if (w === previousWidth) return;
      previousWidth = w;
      svg.replaceChildren();
      tip.hidden = true;
      const h = w < 420 ? 216 : 236;
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      draw({svg,tip,w,h,left:w<250?34:44,right:w-14,top:24,bottom:h-38}, rows);
    }
    paint();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(paint);
      observer.observe(frame);
      observers.set(container, observer);
    }
  }

  function gridAndTicks(p, yTicks, xTicks, x, y, formatY, formatX, yTitle, xTitle) {
    const {svg,left,right,top,bottom,h} = p;
    label(svg, left, top-10, yTitle, {'font-weight':600});
    yTicks.forEach(tick => {
      const py = y(tick);
      line(svg, left, py, right, py);
      label(svg, left-7, py+4, formatY(tick), {'text-anchor':'end'});
    });
    xTicks.forEach((tick, i) => {
      const px = x(tick);
      line(svg, px, bottom, px, bottom+4);
      const anchor = i === xTicks.length-1 && px>right-4 ? 'end' : 'middle';
      label(svg, px, bottom+16, formatX(tick), {'text-anchor':anchor});
    });
    label(svg,(left+right)/2,h-3,xTitle,{'text-anchor':'middle','font-weight':600});
  }

  function interactions(p, points, initial, description, explain, choose, scatter=false) {
    const {svg,tip,left,right,top,bottom} = p;
    const focusLine = line(svg,0,top,0,bottom,{stroke:ink,'stroke-dasharray':'2 4',display:'none'});
    const focusDot = add(svg,'circle',{r:5,fill:'#fff',stroke:blue,'stroke-width':2,display:'none'});
    let active = Math.max(0, initial);
    svg.setAttribute('aria-label',description);
    svg.setAttribute('aria-valuemin','1');
    svg.setAttribute('aria-valuemax',String(points.length));
    svg.setAttribute('aria-description','Use left and right arrow keys to inspect observations.'+(choose?' Press Enter to select a day.':''));
    function show(i) {
      active = clamp(i,0,points.length-1);
      const point = points[active], text = explain(point.row);
      svg.setAttribute('aria-valuenow',String(active+1));
      svg.setAttribute('aria-valuetext',text.replace(/\n/g, '. '));
      focusLine.setAttribute('x1',point.x); focusLine.setAttribute('x2',point.x);
      focusLine.removeAttribute('display');
      focusDot.setAttribute('cx',point.x); focusDot.setAttribute('cy',point.y);
      focusDot.removeAttribute('display');
      tip.textContent = text;
      tip.hidden = false;
      const width = tip.offsetWidth;
      let tx = point.x + 10;
      if (tx + width > p.w - 4) tx = point.x - width - 10;
      tip.style.left = clamp(tx,3,Math.max(3,p.w-width-3))+'px';
      const ty = point.y<top+tip.offsetHeight+7 ? point.y+12 : point.y-tip.offsetHeight-8;
      tip.style.top = clamp(ty,0,Math.max(0,p.h-tip.offsetHeight))+'px';
    }
    function hide() {
      tip.hidden = true;
      focusLine.setAttribute('display','none');
      focusDot.setAttribute('display','none');
    }
    function nearest(e) {
      const rect = svg.getBoundingClientRect();
      const px = (e.clientX-rect.left)*p.w/rect.width;
      const py = (e.clientY-rect.top)*p.h/rect.height;
      if (px<left-6 || px>right+6 || py<top-6 || py>bottom+6) return -1;
      // Both series are in ascending x order. A scatter plot also uses the
      // pointer's height, so adjacent prices with different results stay selectable.
      let low=0, high=points.length;
      while(low<high) {
        const mid=(low+high)>>>1;
        if(points[mid].x<px) low=mid+1; else high=mid;
      }
      let best=Math.min(low,points.length-1), distance=Infinity;
      function inspect(j) {
        const dx=points[j].x-px;
        if(dx*dx>distance) return false;
        const dy=scatter?points[j].y-py:0;
        const d=dx*dx+dy*dy;
        if(d<distance) {distance=d; best=j;}
        return true;
      }
      for(let j=low;j<points.length && inspect(j);j++);
      for(let j=low-1;j>=0 && inspect(j);j--);
      return best;
    }
    svg.onpointermove = e => {const i=nearest(e); if (i>=0) show(i); else hide();};
    svg.onpointerleave = hide;
    svg.onfocus = () => show(active);
    svg.onblur = hide;
    svg.onclick = e => {const i=nearest(e); if (i<0) return; show(i); if(choose) choose(points[i].row);};
    svg.onkeydown = e => {
      const jump=Math.max(1,Math.round(points.length/20));
      const keys = {PageUp:active+jump, PageDown:active-jump, ArrowRight:active+1, ArrowLeft:active-1, ArrowUp:active+1, ArrowDown:active-1, Home:0, End:points.length-1};
      if (Object.hasOwn(keys,e.key)) {e.preventDefault();show(keys[e.key]);}
      else if ((e.key==='Enter'||e.key===' ') && choose) {e.preventDefault();choose(points[active].row);}
      else if (e.key==='Escape') hide();
    };
    svg.setAttribute('aria-valuenow',String(active+1));
    svg.setAttribute('aria-valuetext',explain(points[active].row).replace(/\n/g, '. '));
  }

  function reliability(container, exactPrices) {
    const data = (exactPrices || []).filter(r=>r.n>0 && num(r.p) && r.p>=.51-1e-14 && r.p<=1+1e-14 && num(r.y)).sort((a,b)=>a.p-b.p);
    setup(container,data,'No exact favorite prices have qualifying observations at this horizon.',(p,rows)=>{
      const {svg,w,left,right,top,bottom} = p;
      const x=v=>left+(clamp(v,.51,1)-.51)/.49*(right-left), y=v=>bottom-v*(bottom-top);
      const ticks = w<410 ? [.51,.75,1] : [.51,.60,.70,.80,.90,1];
      const percent = v=>Math.round(v*100)+'%';
      gridAndTicks(p,[0,.25,.5,.75,1],ticks,x,y,percent,percent,'Observed favorite win rate','Exact quoted probability');
      line(svg,x(.51),y(.51),x(1),y(1),{stroke:teal,'stroke-width':1.8,'stroke-dasharray':'5 4'});
      const points = rows.map(row=>({x:x(row.p),y:y(row.y),row}));
      // A single SVG path can draw thousands of native points. Larger samples
      // get a more prominent marker. Every exact price retains its own position.
      const sizePaths=[[],[],[]];
      for (const point of points) {
        const level=point.row.n>=100?2:point.row.n>=10?1:0;
        sizePaths[level].push('M'+point.x.toFixed(2)+' '+point.y.toFixed(2)+'h0.01');
      }
      sizePaths.forEach((parts,i)=>{
        if(parts.length) add(svg,'path',{d:parts.join(' '),stroke:blue,'stroke-width':[3,5,8][i],
          'stroke-opacity':[.55,.75,.95][i],'stroke-linecap':'round',fill:'none'});
      });
      const explain=r=>priceLabel.format(r.p)+' quoted · '+(100*r.y).toFixed(2)+'% won\n'+count(r.wins ?? Math.round(r.y*r.n))+' wins in '+count(r.n)+' contracts'+(num(r.events)?' · '+count(r.events)+' events':'');
      interactions(p,points,0,'Favorite win rates by exact quoted price from 51% to 100%. The dashed line marks perfect calibration. Larger dots represent more contracts.',explain,null,true);
    });
  }

  function horizon(container, series, selectedDay, onDay, metric='brier') {
    const m = metrics[metric] || metrics.brier;
    const data = (series || []).filter(r=>num(r[0])&&num(r[m.column])&&+r[1]>0).sort((a,b)=>a[0]-b[0]);
    setup(container,data,'No horizons have observations for this measure.',(p,rows)=>{
      const {svg,w,left,right,top,bottom} = p;
      const min=+rows[0][0],max=+rows[rows.length-1][0];
      const x=d=>min===max?(left+right)/2:left+(d-min)/(max-min)*(right-left);
      const values=rows.map(r=>+r[m.column]);
      const negative=m.unit==='pp'?Math.min(0,...values):0;
      const positive=Math.max(0,...values);
      const rawStep=Math.max(positive-negative,.01)/4;
      const decade=Math.pow(10,Math.floor(Math.log10(rawStep)));
      const step=[1,2,2.5,5,10].map(i=>i*decade).find(i=>i>=rawStep) || 10*decade;
      const yMin=Math.max(-1,Math.floor(negative/step)*step);
      let yMax=Math.min(1,Math.ceil(positive/step)*step);
      if(yMax===yMin) yMax=step*2;
      const y=t=>bottom-(t-yMin)/(yMax-yMin)*(bottom-top);
      const yTicks=[yMin];
      for(let v=Math.floor(yMin/step+1e-8)+1;v*step<yMax-1e-8;v++) yTicks.push(v*step);
      yTicks.push(yMax);
      const xTicks=[min];
      const pieces=w<410?2:4;
      for (let i=1;i<=pieces;i++) {const t=Math.round(min+(max-min)*i/pieces);if(t>xTicks[xTicks.length-1]) xTicks.push(t);}
      const formatY=m.unit ? v=>+(100*v).toFixed(2)+(m.unit==='%'?'%':'') : v=>''+(+v.toFixed(3));
      gridAndTicks(p,yTicks,xTicks,x,y,formatY,count,m.name+(m.unit==='pp'?' (pp)':''),'Days before cutoff');
      if(m.unit==='pp') line(svg,left,y(0),right,y(0),{stroke:ink,'stroke-width':1.1,'stroke-dasharray':'3 3'});
      const points=rows.map(row=>({x:x(row[0]),y:y(row[m.column]),row}));
      let path='',singletons='';
      points.forEach((v,i)=>{
        const adjacentPrev=i>0 && +v.row[0]===+points[i-1].row[0]+1;
        const adjacentNext=i<points.length-1 && +points[i+1].row[0]===+v.row[0]+1;
        path+=(adjacentPrev?'L':'M')+v.x.toFixed(2)+' '+v.y.toFixed(2)+' ';
        if (!adjacentPrev && !adjacentNext) singletons+='M'+(v.x-.55).toFixed(2)+' '+v.y.toFixed(2)+'h1.1 ';
      });
      add(svg,'path',{d:path,fill:'none',stroke:m.color,'stroke-width':2,'stroke-linejoin':'round','stroke-linecap':'round'});
      if(singletons) add(svg,'path',{d:singletons,fill:'none',stroke:m.color,'stroke-width':2,'stroke-linecap':'round'});
      const selected=points.findIndex(v=>+v.row[0]===+selectedDay);
      if (num(selectedDay) && selectedDay>=min && selectedDay<=max) {
        line(svg,x(selectedDay),top,x(selectedDay),bottom,{stroke:'#6a7790','stroke-width':1,'stroke-dasharray':'4 4'});
        if(selected>=0) add(svg,'circle',{cx:points[selected].x,cy:points[selected].y,r:4.8,stroke:m.color,fill:'white','stroke-width':2});
      }
      const explain=r=>'Day '+count(r[0])+' · '+m.name+' '+m.format(+r[m.column])+'\n'+count(r[1])+' contracts · '+count(r[2])+' events';
      interactions(p,points,selected,m.name+' by forecast horizon',explain,typeof onDay==='function' ? r=>onDay(+r[0]) : null);
    });
  }

  window.AtlasCharts = {reliability,horizon};
}());
