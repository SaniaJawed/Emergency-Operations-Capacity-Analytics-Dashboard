'use strict';

/* ── CHART.JS DEFAULTS ── */
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size   = 11;
Chart.defaults.color       = '#8B99B0';

const C = {
  blue:    '#4F8CFF',
  green:   '#27D7A1',
  warning: '#F4B942',
  crit:    '#FF5C7A',
  purple:  '#9B72FF',
  grid:    'rgba(255,255,255,0.04)',
  text:    '#8B99B0',
};

/* ── LOADER ── */
(function() {
  const bar = document.getElementById('loaderBar');
  let pct = 0;
  const iv = setInterval(() => {
    pct = Math.min(pct + Math.random() * 14, 92);
    if (bar) bar.style.width = pct + '%';
  }, 80);
  window.addEventListener('load', () => {
    clearInterval(iv);
    if (bar) bar.style.width = '100%';
    setTimeout(() => {
      const loader = document.getElementById('loader');
      if (loader) loader.classList.add('out');
      setTimeout(initUI, 400);
    }, 600);
  });
})();

/* ── UI INIT ── */
function initUI() {
  document.querySelectorAll('.section').forEach((s, i) =>
    setTimeout(() => s.classList.add('visible'), i * 80)
  );
  document.querySelectorAll('.kpi-card').forEach((c, i) =>
    setTimeout(() => c.classList.add('visible'), 200 + i * 100)
  );

  const navItems = document.querySelectorAll('.nav-item');
  const secObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting)
        navItems.forEach(n => n.classList.toggle('active', n.dataset.section === e.target.id));
    });
  }, { rootMargin: '-20% 0px -60% 0px' });
  document.querySelectorAll('section[id]').forEach(s => secObs.observe(s));
  navItems.forEach(item => item.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById(item.dataset.section)?.scrollIntoView({ behavior: 'smooth' });
  }));

  const benchObs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      document.querySelectorAll('.benchmark-bar').forEach(b => {
        b.style.background = b.dataset.color;
        b.style.width = (parseFloat(b.dataset.target) / parseFloat(b.dataset.max) * 100) + '%';
      });
      benchObs.disconnect();
    }
  }, { threshold: 0.2 });
  const bl = document.querySelector('.benchmark-list');
  if (bl) benchObs.observe(bl);
}

/* ── COUNTER ── */
function countUp(id, target, dec, suffix) {
  const el = document.getElementById(id);
  if (!el) return;
  const dur = 1600, t0 = performance.now();
  (function frame(now) {
    const p = Math.min((now - t0) / dur, 1);
    const v = target * (1 - Math.pow(1 - p, 3));
    el.textContent = v.toFixed(dec) + suffix;
    if (p < 1) requestAnimationFrame(frame);
  })(t0);
}

/* ── DATA LOAD ── */
async function init() {
  let D;
  try { D = await fetch('data/codeblue.json').then(r => r.json()); }
  catch(e) { console.error('JSON load failed:', e); return; }

  setTimeout(() => {
    countUp('kpi-visits', D.kpis.totalVisits,     0, '');
    countUp('kpi-wait',   D.kpis.avgWaitMin,       1, ' min');
    countUp('kpi-occ',    D.kpis.avgBedOccupancy,  0, '%');
    countUp('kpi-mort',   D.kpis.mortalityRate,     2, '%');
    countUp('kpi-sat',    D.kpis.satisfaction,      1, '%');
    countUp('kpi-readm',  D.kpis.readmissionRate,   1, '%');
  }, 900);

  buildTable(D.hospitals);
  buildJourney(D.careJourney);
  buildHeatmap(D.heatmap);

  // Give browser 2 full frames to paint the DOM
  requestAnimationFrame(() => requestAnimationFrame(() => {
    buildCharts(D);
  }));
}

/* ── TABLE ── */
function buildTable(hospitals) {
  const tbody = document.getElementById('hospitalTableBody');
  if (!tbody) return;
  const sorted = [...hospitals].sort((a,b) => b.readmissionRate - a.readmissionRate);
  tbody.innerHTML = sorted.map(h => {
    const wC = h.avgWait > 65 ? 'metric-critical' : h.avgWait > 60 ? 'metric-warning' : 'metric-ok';
    const rC = h.readmissionRate > 25 ? 'metric-critical' : h.readmissionRate > 18 ? 'metric-warning' : 'metric-ok';
    const mC = h.mortalityRate > 5 ? 'metric-critical' : h.mortalityRate > 3 ? 'metric-warning' : 'metric-ok';
    const sC = h.satisfaction < 50 ? 'metric-critical' : h.satisfaction < 65 ? 'metric-warning' : 'metric-ok';
    return `<tr data-risk="${h.risk}">
      <td><div class="hosp-name-cell">${h.name}<small>${h.isPrivate?'Private':'NHS'} · ${h.staffingStress} stress</small></div></td>
      <td class="metric-val">${h.visits.toLocaleString()}</td>
      <td class="metric-val ${wC}">${h.avgWait} min</td>
      <td class="metric-val ${rC}">${h.readmissionRate}%</td>
      <td class="metric-val ${mC}">${h.mortalityRate}%</td>
      <td class="metric-val ${sC}">${h.satisfaction}/100</td>
      <td class="metric-val">${h.efficiency}</td>
      <td><span class="risk-badge risk-${h.risk}">${h.risk}</span></td>
    </tr>`;
  }).join('');
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.filter;
      tbody.querySelectorAll('tr').forEach(row =>
        row.classList.toggle('hidden-row', f !== 'all' && row.dataset.risk !== f)
      );
    });
  });
}

/* ── JOURNEY ── */
function buildJourney(steps) {
  const el = document.getElementById('careJourney');
  if (!el) return;
  el.innerHTML = steps.map(s => `
    <div class="journey-step">
      <div class="journey-node ${s.status}"></div>
      <div class="journey-stage">${s.stage}</div>
      <div class="journey-time">${s.time}</div>
      <div class="journey-label">${s.label}</div>
    </div>`).join('');
}

/* ── HEATMAP ── */
function buildHeatmap(hm) {
  const el = document.getElementById('heatmapGrid');
  if (!el) return;
  const flat = hm.values.flat();
  const mn = Math.min(...flat), mx = Math.max(...flat);
  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';
  grid.innerHTML = '<div class="heatmap-header"></div>' +
    hm.days.map(d => `<div class="heatmap-header">${d.slice(0,3)}</div>`).join('');
  hm.bands.forEach((band, bi) => {
    grid.innerHTML += `<div class="heatmap-row-label">${band}</div>`;
    hm.days.forEach((_, di) => {
      const v = hm.values[bi][di], t = (v-mn)/(mx-mn);
      const r = Math.round(79+t*176), g2 = Math.round(140-t*80), b2 = Math.round(255-t*133);
      grid.innerHTML += `<div class="heatmap-cell" style="background:rgba(${r},${g2},${b2},${0.15+t*0.55})" title="${v} min">${v}</div>`;
    });
  });
  el.appendChild(grid);
}

/* ── ALL CHARTS ── */
function buildCharts(D) {

  // Shared scale helper
  function sx(yLabel, yMin) {
    const y = { grid:{color:C.grid,drawBorder:false}, ticks:{color:C.text}, beginAtZero: yMin==null };
    if (yMin != null) y.min = yMin;
    if (yLabel) y.title = {display:true, text:yLabel, color:C.text};
    return { x:{grid:{color:C.grid,drawBorder:false}, ticks:{color:C.text}}, y };
  }

  // Monthly
  const cM = document.getElementById('chartMonthly');
  if (cM) new Chart(cM, {
    data: { labels: D.monthly.labels, datasets: [
      { type:'bar', label:'Visits', data:D.monthly.visits, yAxisID:'y',
        backgroundColor:C.blue+'33', borderColor:C.blue, borderWidth:1, borderRadius:3 },
      { type:'line', label:'Avg wait (min)', data:D.monthly.avgWait, yAxisID:'y2',
        borderColor:C.warning, backgroundColor:'transparent',
        borderWidth:2, pointRadius:3, pointBackgroundColor:C.warning, tension:0.4 }
    ]},
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: {
        legend:{display:true, position:'top', labels:{color:C.text, boxWidth:10, padding:12}},
        tooltip:{mode:'index', intersect:false}
      },
      scales: {
        x:{grid:{color:C.grid,drawBorder:false}, ticks:{color:C.text}},
        y:{position:'left', grid:{color:C.grid,drawBorder:false}, ticks:{color:C.blue},
           title:{display:true,text:'Visits',color:C.blue}, beginAtZero:false},
        y2:{position:'right', grid:{drawOnChartArea:false}, ticks:{color:C.warning,callback:v=>v+'m'},
            title:{display:true,text:'Wait(min)',color:C.warning}, beginAtZero:false}
      }
    }
  });

  // Admission doughnut
  const cA = document.getElementById('chartAdmission');
  if (cA) new Chart(cA, {
    type:'doughnut',
    data:{ labels:D.admissionTypes.labels, datasets:[{
      data:D.admissionTypes.values,
      backgroundColor:[C.crit,C.warning,C.blue,C.green],
      borderColor:'#111827', borderWidth:2, hoverOffset:6
    }]},
    options:{
      responsive:true, maintainAspectRatio:false, cutout:'62%',
      plugins:{
        legend:{display:true, position:'right', labels:{color:C.text,boxWidth:10,padding:10}},
        tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${ctx.parsed.toLocaleString()}`}}
      }
    }
  });

  // Scatter
  const cSc = document.getElementById('chartScatter');
  if (cSc) {
    const cm = {Critical:C.crit, Watchlist:C.warning, Stable:C.green};
    new Chart(cSc, {
      type:'scatter',
      data:{datasets:[{
        data:D.hospitals.map(h=>({x:h.efficiency,y:h.satisfaction})),
        backgroundColor:D.hospitals.map(h=>cm[h.risk]+'BB'),
        borderColor:D.hospitals.map(h=>cm[h.risk]),
        borderWidth:1.5, pointRadius:9, pointHoverRadius:11
      }]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{callbacks:{label:ctx=>{
            const h=D.hospitals[ctx.dataIndex];
            return [`${h.name}`,`Efficiency: ${h.efficiency}`,`Satisfaction: ${h.satisfaction}/100`];
          }}}
        },
        scales:{
          x:{grid:{color:C.grid,drawBorder:false},ticks:{color:C.text},
             title:{display:true,text:'Efficiency score',color:C.text},min:0.4,max:1.05},
          y:{grid:{color:C.grid,drawBorder:false},ticks:{color:C.text},
             title:{display:true,text:'Patient satisfaction',color:C.text},min:20,max:100}
        }
      }
    });
  }

  // Readmission horizontal bar
  const cR = document.getElementById('chartReadmission');
  if (cR) {
    const s = [...D.hospitals].sort((a,b)=>b.readmissionRate-a.readmissionRate);
    new Chart(cR, {
      type:'bar',
      data:{
        labels:s.map(h=>h.name.split(' ').slice(0,2).join(' ')),
        datasets:[{
          data:s.map(h=>h.readmissionRate),
          backgroundColor:s.map(h=>h.readmissionRate>25?C.crit+'88':h.readmissionRate>18?C.warning+'88':C.green+'88'),
          borderColor:s.map(h=>h.readmissionRate>25?C.crit:h.readmissionRate>18?C.warning:C.green),
          borderWidth:1, borderRadius:3
        }]
      },
      options:{
        indexAxis:'y', responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}, tooltip:{callbacks:{label:ctx=>` ${ctx.parsed.x}% readmission`}}},
        scales:{
          x:{grid:{color:C.grid,drawBorder:false},ticks:{color:C.text,callback:v=>v+'%'},beginAtZero:true},
          y:{grid:{display:false},ticks:{color:C.text,font:{size:10}}}
        }
      }
    });
  }

  // Severity bar
  const cSv = document.getElementById('chartSeverity');
  if (cSv) {
    const colors = [C.green, C.green, C.warning, C.warning, C.crit];
    new Chart(cSv, {
      type:'bar',
      data:{
        labels: D.severityWait?.labels || [],
        datasets:[{
          data: D.severityWait?.values || [],
          backgroundColor:colors.map(x=>x+'66'),
          borderColor:colors,
          borderWidth:1, borderRadius:4
        }]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}, tooltip:{callbacks:{label:ctx=>` ${ctx.parsed.y} min avg wait`}}},
        scales:{
          x:{grid:{color:C.grid,drawBorder:false}, ticks:{color:C.text}},
          y:{grid:{color:C.grid,drawBorder:false}, ticks:{color:C.text,callback:v=>v+'m'},
             title:{display:true,text:'Avg wait (min)',color:C.text}, min:50, max:70}
        }
      }
    });
  }

  // Outcomes
  const cO = document.getElementById('chartOutcomes');
  if (cO) {
    const cm2 = {Discharged:C.green,Admitted:C.blue,Transferred:C.warning,Deceased:C.crit,AMA:C.purple};
    new Chart(cO, {
      type:'bar',
      data:{
        labels:D.outcomes.labels,
        datasets:[{
          data:D.outcomes.values,
          backgroundColor:D.outcomes.labels.map(l=>(cm2[l]||C.blue)+'77'),
          borderColor:D.outcomes.labels.map(l=>cm2[l]||C.blue),
          borderWidth:1, borderRadius:3
        }]
      },
      options:{
        indexAxis:'y', responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}, tooltip:{callbacks:{label:ctx=>` ${ctx.parsed.x.toLocaleString()} patients`}}},
        scales:{
          x:{grid:{color:C.grid,drawBorder:false},ticks:{color:C.text},beginAtZero:true},
          y:{grid:{display:false},ticks:{color:C.text}}
        }
      }
    });
  }

  // Diagnosis readmission
  const cD = document.getElementById('chartDiagReadm');
  if (cD) {
    const labels8 = D.diagnosisReadmission.labels.slice(0,8);
    const vals8   = D.diagnosisReadmission.values.slice(0,8);
    new Chart(cD, {
      type:'bar',
      data:{
        labels:labels8,
        datasets:[{
          data:vals8,
          backgroundColor:vals8.map(v=>v>18?C.crit+'77':v>16?C.warning+'77':C.blue+'77'),
          borderColor:vals8.map(v=>v>18?C.crit:v>16?C.warning:C.blue),
          borderWidth:1, borderRadius:3
        }]
      },
      options:{
        indexAxis:'y', responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}, tooltip:{callbacks:{label:ctx=>` ${ctx.parsed.x}% readmission`}}},
        scales:{
          x:{grid:{color:C.grid,drawBorder:false},ticks:{color:C.text,callback:v=>v+'%'},beginAtZero:true},
          y:{grid:{display:false},ticks:{color:C.text,font:{size:10}}}
        }
      }
    });
  }

  // Insurance
  const cI = document.getElementById('chartInsurance');
  if (cI) new Chart(cI, {
    type:'bar',
    data:{
      labels:D.insurance.labels,
      datasets:[
        {label:'Satisfaction /100', data:D.insurance.satisfaction, yAxisID:'y',
         backgroundColor:C.blue+'66', borderColor:C.blue, borderWidth:1, borderRadius:3},
        {label:'Avg wait (min)', data:D.insurance.wait, yAxisID:'y2',
         backgroundColor:C.warning+'66', borderColor:C.warning, borderWidth:1, borderRadius:3}
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:true,position:'top',labels:{color:C.text,boxWidth:10,padding:12}}},
      scales:{
        x:{grid:{color:C.grid,drawBorder:false},ticks:{color:C.text}},
        y:{position:'left',grid:{color:C.grid,drawBorder:false},ticks:{color:C.blue},
           title:{display:true,text:'Satisfaction',color:C.blue},beginAtZero:true},
        y2:{position:'right',grid:{drawOnChartArea:false},ticks:{color:C.warning},
            title:{display:true,text:'Wait (min)',color:C.warning},beginAtZero:true}
      }
    }
  });

  // LOS
  const cL = document.getElementById('chartLOS');
  if (cL) new Chart(cL, {
    type:'line',
    data:{
      labels:D.monthly.labels,
      datasets:[{
        data:D.monthly.avgLOS,
        borderColor:C.purple, backgroundColor:C.purple+'18',
        borderWidth:2.5, pointBackgroundColor:C.purple, pointRadius:4, tension:0.4, fill:true
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        x:{grid:{color:C.grid,drawBorder:false},ticks:{color:C.text}},
        y:{grid:{color:C.grid,drawBorder:false},ticks:{color:C.text,callback:v=>v+'h'},
           title:{display:true,text:'Avg LOS (hrs)',color:C.text},beginAtZero:false}
      }
    }
  });
}

init();
