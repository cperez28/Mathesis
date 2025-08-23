
/* =====================================================
   Plataforma Cálculo — JS (v2 Estilos)
   ===================================================== */
(function(){
  const $ = (q) => document.querySelector(q);
  const $$ = (q) => document.querySelectorAll(q);
  const rnd = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  function todayStr(){ const d = new Date(); return d.toLocaleDateString('es-GT', { year:'numeric', month:'long', day:'2-digit' }); }

  // ========= THEME / STYLES ENGINE =========
  const THEME_KEY = 'calculo_theme_v4';
  function setVars(vars){
    const root = document.documentElement;
    for(const [k,v] of Object.entries(vars)){ root.style.setProperty(k, v); }
  }
  function presetTheme(key){
    const map = {
      azul: {primary:'#4f8cff', secondary:'#5dc9ff'},
      verde:{primary:'#27ae60', secondary:'#6ee7b7'},
      vino:{primary:'#8a1c3a', secondary:'#ff6b9d'},
      naranja:{primary:'#ff7a18', secondary:'#ffd166'},
      morado:{primary:'#6c5ce7', secondary:'#a29bfe'},
      neutral:{primary:'#64748b', secondary:'#94a3b8'}
    };
    return map[key] || {primary:'#4f8cff', secondary:'#5dc9ff'};
  }
  function applyTheme({primary, secondary, light, radius, fontScale, contrast}){
    document.body.classList.toggle('light-theme', !!light);
    setVars({
      '--accent': primary, '--accent-2': secondary, '--link': secondary,
      '--radius': (radius? radius+'px' : getComputedStyle(document.documentElement).getPropertyValue('--radius')),
      '--font-scale': (fontScale || 1.0),
      '--contrast': (contrast || 1.0)
    });
    localStorage.setItem(THEME_KEY, JSON.stringify({primary, secondary, light: !!light, radius: +String(radius||16).replace('px',''), fontScale: +(fontScale||1.0), contrast: +(contrast||1.0)}));
    if(typeof refreshAnalytics === 'function'){ refreshAnalytics(); }
  }
  function bootTheme(){
    const saved = localStorage.getItem(THEME_KEY);
    if(saved){
      try{
        const t = JSON.parse(saved);
        $('#col-primary').value = t.primary || '#4f8cff';
        $('#col-secondary').value = t.secondary || '#5dc9ff';
        $('#theme-light').checked = !!t.light;
        $('#range-radius').value = t.radius || 16;
        $('#range-font').value = t.fontScale || 1.0;
        $('#range-contrast').value = t.contrast || 1.0;
        updateStyleLabels();
        applyTheme(t);
      }catch{ const base = presetTheme('azul'); applyTheme({ ...base, light:false, radius:16, fontScale:1.0, contrast:1.0 }); }
    }else{
      const base = presetTheme('azul'); applyTheme({ ...base, light:false, radius:16, fontScale:1.0, contrast:1.0 });
    }
  }
  function updateStyleLabels(){
    $('#val-radius').textContent = $('#range-radius').value;
    $('#val-contrast').textContent = $('#range-contrast').value;
    $('#val-font').textContent = (+$('#range-font').value).toFixed(2);
  }

  // ========= USER / LOGIN =========
  const USER_KEY = 'calculo_user_current';
  const USERS_KEY = 'calculo_users_list_v1';
  const USER = { name: null, statsKey(){ return 'calculo_stats_v1_'+(this.name||'Invitado'); } };
  function getUsers(){ try{ return JSON.parse(localStorage.getItem(USERS_KEY)||'[]'); }catch(e){ return []; } }
  function setUsers(list){ localStorage.setItem(USERS_KEY, JSON.stringify(list)); }
  function setCurrentUser(name){
    USER.name = name;
    localStorage.setItem(USER_KEY, name);
    $('#user-name').textContent = name;
    $('#an-usr').textContent = name;
    refreshAnalytics();
  }
  function ensureLogin(){
    const cur = localStorage.getItem(USER_KEY);
    if(cur){ setCurrentUser(cur); return; }
    const sel = $('#sel-users');
    sel.innerHTML = '';
    const users = getUsers();
    if(users.length===0){ setUsers(['Invitado']); }
    getUsers().forEach(u=>{ const opt = document.createElement('option'); opt.value=u; opt.textContent=u; sel.appendChild(opt); });
    $('#modal-login').style.display='flex';
  }
  function closeLogin(){ $('#modal-login').style.display='none'; }

  // ========= Storage helpers =========
  function loadStats(){ try{ return JSON.parse(localStorage.getItem(USER.statsKey())||'[]'); }catch(e){ return []; } }
  function saveStats(arr){ localStorage.setItem(USER.statsKey(), JSON.stringify(arr)); }
  function pushStat(rec){ const arr = loadStats(); arr.push(rec); saveStats(arr); }

  // ========= STATE =========
  let STATE = { modo: 'practica', tema: 'limites', nivel: 1, currentProblem: null, session: {ok:0,bad:0,racha:0}, exam: null, charts: {temas:null, niveles:null} };

  // ========= Math helpers =========
  function texVar(v){ return v.replaceAll('*','\\cdot '); }
  function fmt(x){ if(!isFinite(x)) return (x===Infinity?'\\infty':'-\\infty'); const s = Math.abs(x) < 1e-6 ? '0' : (+x.toFixed(6)).toString(); return s; }
  function exprToTex(expr){ try{ return math.parse(expr).toTex({parenthesis:'auto', implicit:'hide'}); } catch(e){ return texVar(expr); } }
  function mathToLatex(expr){ return exprToTex(expr); }
  function isInfinityToken(s){ const t = s.toLowerCase().replace(/\s+/g,''); return t==='infinity' || t==='∞' || t==='+∞' || t==='-∞' || t==='+infinity' || t==='-infinity'; }
  function parseNumericMaybe(s){ const t = s.trim(); if(isInfinityToken(t)) return (t.includes('-')? -Infinity : Infinity); try{ const v = math.evaluate(t, {pi:Math.PI, e:Math.E}); if(typeof v==='number' && isFinite(v)) return v; } catch(e){} return null; }
  function safeEvalExpr(expr, x){ try{ const scope = {x, pi:Math.PI, e:Math.E}; const node = math.parse(expr); const v = node.evaluate(scope); return (typeof v==='number' && isFinite(v)) ? v : NaN; }catch(e){ return NaN; } }
  function limitNumeric(expr, a, side='two-sided'){
    if(a===Infinity){
      const pts = [10, 20, 40, 80, 160].map(t => safeEvalExpr(expr, t));
      const finites = pts.filter(v=>isFinite(v));
      if(finites.length<2){ return pts[pts.length-1]; }
      const a1 = finites[finites.length-2], a2 = finites[finites.length-1];
      if(Math.abs(a2-a1) < 1e-4*Math.max(1,Math.abs(a2))) return a2;
      return a2;
    } else {
      const eps = [1e-3, 5e-4, 1e-4, 1e-5];
      let vals=[];
      for(const e of eps){
        if(side!=='left'){ vals.push(safeEvalExpr(expr, a+e)); }
        if(side!=='right'){ vals.push(safeEvalExpr(expr, a-e)); }
      }
      vals = vals.filter(v=>!Number.isNaN(v));
      if(vals.length===0) return NaN;
      const big = vals.filter(v=>Math.abs(v)>1e6);
      if(big.length>=Math.max(2, vals.length/2)){ return big[big.length-1]; }
      vals.sort((a,b)=>a-b);
      const mid = vals[Math.floor(vals.length/2)];
      return mid;
    }
  }
  function numericDerivative(expr, x){ const h = 1e-5; const f1 = safeEvalExpr(expr, x+h); const f2 = safeEvalExpr(expr, x-h); return (f1 - f2)/(2*h); }
  function numericIntegral(expr, a, b){ const n = 400; const h = (b-a)/n; let s = safeEvalExpr(expr, a) + safeEvalExpr(expr, b); for(let i=1;i<n;i++){ const x = a + i*h; const fx = safeEvalExpr(expr, x); s += (i%2===0 ? 2 : 4) * fx; } return s*h/3; }

  // Pega este bloque en tu <script> y reemplaza SOLO la parte de creación del banco de LÍMITES.
// 1) Añade la función generateLimitsBank()
// 2) Dentro de generateBank(), reemplaza: bank.limites = [...] por: bank.limites = generateLimitsBank();

/* =====================================================
 *  LÍMITES — BLOQUE COMPLETO (helpers + generador sin '·' y sin '+ -')
 *  - Conversores LaTeX sin punto (implicit:'hide')
 *  - Normalizador funciones para math.js
 *  - Compositor de términos y polinomios (evita '+ -' en el origen)
 *  - generateLimitsBank() reescrito usando los compositores
 * ===================================================== */

// ------------------------------
// 1) Conversores a LaTeX (sin puntito de multiplicación)
// ------------------------------
function exprToTex(expr) {
  try {
    return math.parse(String(expr)).toTex({ parenthesis: 'auto', implicit: 'hide' });
  } catch (e) {
    return String(expr); // fallback simple
  }
}
function mathToLatex(expr) { return exprToTex(expr); }

// ------------------------------
// 2) Normalizador para compatibilidad con math.js
// ------------------------------
function normalizeExprForMathJS(expr){
  let s = String(expr);
  // inversas trig: arcsin, arccos, arctan -> asin, acos, atan
  s = s.replace(/\barcsin\s*\(/g, 'asin(')
       .replace(/\barccos\s*\(/g, 'acos(')
       .replace(/\barctan\s*\(/g, 'atan(');
  // log base 10 -> log(x,10)
  s = s.replace(/\blog10\s*\(\s*([^)]+)\s*\)/g, 'log($1, 10)');
  // sec, csc, cot -> 1/cos, 1/sin, 1/tan
  s = s.replace(/\bsec\s*\(\s*([^)]+)\s*\)/g, '1/cos($1)')
       .replace(/\bcsc\s*\(\s*([^)]+)\s*\)/g, '1/sin($1)')
       .replace(/\bcot\s*\(\s*([^)]+)\s*\)/g, '1/tan($1)');
  // f^n(x) -> (f(x))^n
  s = s.replace(/\b([a-zA-Z]+)\s*\^\s*(\d+)\s*\(\s*([^)]+)\s*\)/g, '($1($3))^$2');
  // eliminar '1*' delante de símbolos
  s = s.replace(/\b1\s*\*\s*/g, '');
  return s;
}

// ------------------------------
// 3) Composición de términos/polinomios (evita '+ -' desde el origen)
// ------------------------------
function term(c, base=''){
  // Devuelve "+3*x^2", "-x", "+5"; vacía si c==0
  if (!Number.isFinite(c) || c===0) return '';
  const sgn = c < 0 ? '-' : '+';
  const a = Math.abs(c);
  if (base) {
    // si |c|=1 y es término con variable, omitimos el 1
    const mag = (a === 1) ? '' : a + '*';
    return sgn + mag + base;
  } else {
    return sgn + a;
  }
}
function stripLeadingPlus(s){ return s && s[0] === '+' ? s.slice(1) : s; }
function poly2(a,b,c){
  const s = (term(a,'x^2') + term(b,'x') + term(c,''));
  return stripLeadingPlus(s) || '0';
}
function poly3(a,b,c,d){
  const s = (term(a,'x^3') + term(b,'x^2') + term(c,'x') + term(d,''));
  return stripLeadingPlus(s) || '0';
}

// ------------------------------
// 4) Generador de LÍMITES (8 niveles, ~50 únicos por nivel)
// ------------------------------
function generateLimitsBank(){
  const items = [];
  const rnd = (a,b)=> Math.floor(Math.random()*(b-a+1))+a;
  const uniq = new Set();

  const push = (nivel, kind, expr, a=null, approach='two-sided', note='') => {
    const key = `${nivel}|${kind}|${expr}|${a}|${approach}`;
    if(uniq.has(key)) return; uniq.add(key);
    items.push({
      tema: 'limites',
      nivel,
      kind,
      data: { expr, a, approach, note },
      toTex(){
        const tgt = (this.data.a===Infinity? '\\infty' : (this.data.a===-Infinity? '-\\infty' : this.data.a));
        const side = this.data.approach==='right'?'^{+}': this.data.approach==='left'?'^{-}': '';
        const raw = normalizeExprForMathJS(this.data.expr);
        const body = (typeof mathToLatex==='function') ? mathToLatex(raw)
                   : (typeof exprToTex==='function') ? exprToTex(raw)
                   : raw;
        return `\\[\\lim_{x\\to ${tgt}${side}}\\, ${body}\\]`;
      }
    });
  };
  const addMany=(gen,N)=>{ for(let i=0;i<N;i++) gen(); };

  // =========================
  // NIVEL 1 — Determinados (continuidad) VARIADOS
  (function(){
    const target=60;
    addMany(()=>{ // racional regular (den(x0)≠0)
      const x0=rnd(-4,4);
      const a=rnd(1,6), b=rnd(-6,6), c=rnd(-4,4);
      const d=rnd(1,6), e=rnd(-6,6); let f=rnd(1,6);
      const denAt=(x)=> d*x*x+e*x+f; if(denAt(x0)===0){ f += 1+Math.abs(e); }
      const num = poly2(a,b,c);
      const den = poly2(d,e,f);
      const expr = `(${num})/(${den})`;
      push(1,'determinado_racional',expr,x0,'two-sided','Continuidad racional (den≠0)');
    }, Math.ceil(target*0.30));

    addMany(()=>{ // polinomio cúbico
      const x0=rnd(-3,3);
      const a=rnd(1,4), b=rnd(-4,4), c=rnd(-4,4), d=rnd(-3,3);
      const expr = poly3(a,b,c,d);
      push(1,'determinado_polinomio',expr,x0,'two-sided','Continuidad polinómica');
    }, Math.ceil(target*0.22));

    addMany(()=>{ // raíz válida
      const x0=rnd(0,5); const a=rnd(1,4), b=rnd(0,4), k=rnd(-3,3);
      const inside = stripLeadingPlus(term(a,'x') + term(b,''));      // a*x + b
      const outside = k ? (k<0 ? `${k}` : `+${k}`) : '';               // ±k (si no es 0)
      const expr = outside ? `sqrt(${inside})${outside}` : `sqrt(${inside})`;
      push(1,'determinado_raiz',expr,x0,'two-sided','Raíz con dominio válido');
    }, Math.ceil(target*0.16));

    addMany(()=>{ // trig continua
      const x0=rnd(-3,3); const k=rnd(1,5);
      const sum = stripLeadingPlus(term(1,`sin(${k}*x)`) + term(1,`cos(${k}*x)`));
      push(1,'determinado_trig',sum,x0,'two-sided','Trigonométrica continua');
    }, Math.ceil(target*0.16));

    addMany(()=>{ // exp+ln (x0>0)
      const x0=rnd(1,6); const a=rnd(1,3), b=rnd(1,3);
      const sum = stripLeadingPlus(term(1,`exp(${a}*x)`) + term(1,`log(${b}*x)`));
      push(1,'determinado_mixta',sum,x0,'two-sided','Mixta exp+ln (x0>0)');
    }, Math.ceil(target*0.16));
  })();

  // =========================
  // NIVEL 2 — 0/0 con FACTORIZACIÓN
  (function(){
    const target=60;
    addMany(()=>{ const a=rnd(1,10);
      const expr = `(x^2-${a}^2)/(x-${a})`;
      push(2,'fact_diff_sq',expr,a,'two-sided','Diferencia de cuadrados');
    }, Math.ceil(target*0.30));

    addMany(()=>{ const a=rnd(-3,3), b=rnd(1,4);
      const expr = `((x-${a})^2 - ${b}^2)/(x-(${a}+${b}))`;
      push(2,'fact_tcp',expr,a+b,'two-sided','(u^2-b^2)/(u-b)');
    }, Math.ceil(target*0.22));

    addMany(()=>{ const p=rnd(-5,5), q=rnd(1,6); const a=p/q;
      const expr = `((x-${a})*(x+${a}+${rnd(1,3)}))/(x-${a})`;
      push(2,'fact_common',expr,a,'two-sided','Factor común cancelable');
    }, Math.ceil(target*0.18));

    addMany(()=>{ const A=rnd(1,5), B=rnd(1,5); const x0= -B/A;
      const lin = stripLeadingPlus(term(A,'x') + term(B,'')); // A*x + B
      const num = `${lin}*(x+${rnd(1,4)})`;
      const expr = `(${num})/(x-(${x0}))`;
      push(2,'fact_lineal',expr,x0,'two-sided','Raíz lineal cancelable');
    }, Math.ceil(target*0.18));

    addMany(()=>{ const r=rnd(1,5), s=rnd(1,5); const a=-s/r;
      const lin = stripLeadingPlus(term(r,'x') + term(s,'')); // r*x + s
      const expr = `((x-(${a}))*(${lin}))/(x-(${a}))`;
      push(2,'fact_quad',expr,a,'two-sided','Cuadrático factorizable con cancelación');
    }, Math.ceil(target*0.12));
  })();

  // =========================
  // NIVEL 3 — CONJUGADOS (racionalización)
  (function(){
    const target=60;
    addMany(()=>{ const a=rnd(1,12);
      push(3,'conj_basic',`(sqrt(x+${a})-sqrt(${a}))/x`,0,'two-sided','Racionalización básica');
    }, Math.ceil(target*0.28));

    addMany(()=>{ const a=rnd(1,9), b=rnd(1,9), c=rnd(0,4);
      push(3,'conj_diff',`(sqrt(x+${a})-sqrt(x+${b}))/(x-${c})`,c,'two-sided','Diferencia de raíces');
    }, Math.ceil(target*0.24));

    addMany(()=>{ const a=rnd(1,6);
      push(3,'conj_recip',`1/(sqrt(x+${a})-sqrt(x))`,rnd(0,3),'two-sided','Conjugado en el denominador');
    }, Math.ceil(target*0.18));

    addMany(()=>{ const a=rnd(1,15);
      push(3,'conj_asym',`(sqrt(x^2+${a}*x)-x)`,Infinity,'two-sided','Racionalización asintótica');
    }, Math.ceil(target*0.18));

    addMany(()=>{ const a=rnd(1,6);
      push(3,'conj_cubic',`((x+${a})^(1/3) - x^(1/3))/(${a})`,Infinity,'two-sided','Diferencia de raíces cúbicas');
    }, Math.ceil(target*0.12));
  })();

  // =========================
  // NIVEL 4 — LATERALES (derecha/izquierda)
  (function(){
    const target=60;
    addMany(()=>{ push(4,'lat_inv','1/x',0,'right','0^+ → +∞'); }, 10);
    addMany(()=>{ push(4,'lat_inv','1/x',0,'left','0^- → -∞'); }, 10);
    addMany(()=>{ push(4,'lat_sign','abs(x)/x',0,'right','Salto a 1'); }, 8);
    addMany(()=>{ push(4,'lat_sign','abs(x)/x',0,'left','Salto a -1'); }, 8);
    addMany(()=>{ push(4,'lat_log','log(x)',0,'right','log(x)→-∞ (0^+)'); }, 6);
    addMany(()=>{ push(4,'lat_sqrt_over_x','sqrt(x)/x',0,'right','√x/x → +∞'); }, 6);
    addMany(()=>{ const a=rnd(-3,3);
      push(4,'lat_pole',`1/(x-(${a}))`,a,'right',`x→${a}^+`);
      push(4,'lat_pole',`1/(x-(${a}))`,a,'left',`x→${a}^-`);
    }, 6);
    addMany(()=>{ const a=rnd(-2,2);
      push(4,'lat_domain',`sqrt(x-(${a}))`,a,'left','No existe por dominio');
      push(4,'lat_domain',`sqrt(x-(${a}))`,a,'right','Existe (lado derecho)');
    }, 3);
    addMany(()=>{ const a=rnd(-2,2);
      push(4,'lat_log_shift',`log(x-(${a}))`,a,'right',`Dominio (x>${a})`);
    }, 3);
  })();

  // =========================
  // NIVEL 5 — x→∞ en fracciones polinómicas
  (function(){
    const target=60;
    addMany(()=>{ const p1=rnd(1,8), q1=rnd(1,8); const p2=rnd(-5,5), q2=rnd(-5,5);
      const num = poly2(p1,p2,1); const den = poly2(q1,q2,1);
      const expr = `(${num})/(${den})`;
      push(5,'inf_eq22',expr,Infinity,'two-sided','deg num = deg den');
    }, Math.ceil(target*0.34));

    addMany(()=>{ const p1=rnd(1,6), q1=rnd(1,6); const p2=rnd(-4,4), q2=rnd(-4,4);
      const num = stripLeadingPlus(term(p1,'x^3') + term(p2,'x^2') + term(1,''));
      const den = poly2(q1,q2,1);
      const expr = `(${num})/(${den})`;
      push(5,'inf_num_gt',expr,Infinity,'two-sided','deg num > deg den');
    }, Math.ceil(target*0.32));

    addMany(()=>{ const p1=rnd(1,6), q1=rnd(1,6); const p2=rnd(-4,4), q2=rnd(-4,4);
      const num = stripLeadingPlus(term(p1,'x') + term(p2,''));
      const den = poly2(q1,q2,1);
      const expr = `(${num})/(${den})`;
      push(5,'inf_num_lt',expr,Infinity,'two-sided','deg num < deg den');
    }, Math.ceil(target*0.34));
  })();

  // =========================
  // NIVEL 6 — Límites al infinito notables
  (function(){
    addMany(()=>{ const p=rnd(1,5); push(6,'inf_ln_over_pow',`log(x)/x^${p}`,Infinity,'two-sided','(ln x)/x^p → 0'); }, 14);
    addMany(()=>{ const a=rnd(1,4), b=rnd(1,3); push(6,'inf_pow_exp_decay',`x^${a}*exp(-${b}*x)`,Infinity,'two-sided','x^a e^{-bx} → 0'); }, 12);
    addMany(()=>{ const k=rnd(1,3), m=rnd(1,4); push(6,'inf_exp_over_pow',`exp(${k}*x)/x^${m}`,Infinity,'two-sided','e^{kx}/x^m → ∞'); }, 12);
    addMany(()=>{ const c=rnd(1,4); push(6,'inf_e_limit',`(1+1/x)^( ${c}*x )`,Infinity,'two-sided','(1+1/x)^{cx} → e^{c}'); }, 12);
    addMany(()=>{ const k=rnd(2,4), m=rnd(1,3); push(6,'inf_ln_power_over_pow',`(log(x))^${k} / x^${m}`,Infinity,'two-sided','(ln x)^k/x^m → 0'); }, 10);
  })();

  // =========================
  // NIVEL 7 — Avanzados algebraicos I
  (function(){
    const target=60;
    addMany(()=>{ const a=rnd(1,6); push(7,'adv_cos',`(1-cos(${a}*x))/x^2`,0,'two-sided','≈ a^2/2'); }, 15);
    addMany(()=>{ const a=rnd(1,5); push(7,'adv_sin_ax_minus_ax',`(sin(${a}*x)-${a}*x)/x^3`,0,'two-sided','≈ -a^3/6'); }, 12);
    addMany(()=>{ const n=rnd(2,6), a=rnd(1,5); push(7,'adv_diff_quot',`(x^${n}-${a}^${n})/(x-${a})`,a,'two-sided','→ n·a^{n-1}'); }, 15);
    addMany(()=>{ push(7,'adv_sandwich','x*sin(1/x)',0,'two-sided','Teorema del sándwich'); }, 10);
    addMany(()=>{ const a=rnd(1,4); push(7,'adv_tan_minus',`(tan(${a}*x)-${a}*x)/x^3`,0,'two-sided','≈ (a^3)*2/3'); }, 8);
  })();

  // =========================
  // NIVEL 8 — Avanzados algebraicos II
  (function(){
    const target=60;
    addMany(()=>{ const a=rnd(1,15); push(8,'adv_asym_sqrt',`sqrt(x^2+${a}*x)-x`,Infinity,'two-sided','≈ a/2'); }, 18);
    addMany(()=>{ const a=rnd(1,8); push(8,'adv_cuberoot_shift',`((x+${a})^(1/3) - x^(1/3))/(${a})`,Infinity,'two-sided','Diferencia de raíces cúbicas'); }, 12);
    addMany(()=>{ const a=rnd(1,6); push(8,'adv_log1p_over_x',`log(1+${a}*x)/x`,0,'two-sided','→ a'); }, 10);
    addMany(()=>{ const k=rnd(1,4); push(8,'adv_exp_second',`(exp(${k}*x)-1-${k}*x)/x^2`,0,'two-sided','→ k^2/2'); }, 10);
    addMany(()=>{ const a=rnd(1,5), b=rnd(1,5); push(8,'adv_nested_root',`(sqrt(x+${a}) - sqrt(x+${b}))/(x)`,Infinity,'two-sided','Diferencia de raíces asintótica'); }, 10);
  })();

  return items;
}



// ===============================
// NOTA DE INTEGRACIÓN
// ===============================
// 1) Reemplaza tu antigua generateLimitsBank() por esta versión.
// 2) En generateBank(): bank.limites = generateLimitsBank();
// 3) Esta versión garantiza data.a y data.approach SIEMPRE presentes (null si no aplica).

/* =====================================================
 *  DERIVADAS — BLOQUE COMPLETO (helpers + generador sin '·' y sin '+ -')
 *  - Conversores LaTeX sin punto (implicit:'hide')
 *  - Normalizador funciones para math.js
 *  - Compositor de términos y sumas (evita '+ -' en el origen)
 *  - generateDerivativesBank() (8 niveles, ~50+ candidatos por nivel)
 *
 *  Integración:
 *    1) Carga math.js y MathJax.
 *    2) Pega ESTE archivo después de math.js (y antes de usar generateDerivativesBank()).
 *    3) En tu generateBank(): bank.derivadas = generateDerivativesBank();
 * ===================================================== */

// ------------------------------
// 1) Conversores a LaTeX (sin puntito de multiplicación)
// ------------------------------
function exprToTex(expr) {
  try {
    return math.parse(String(expr)).toTex({ parenthesis: 'auto', implicit: 'hide' });
  } catch (e) {
    return String(expr); // fallback simple
  }
}
function mathToLatex(expr) { return exprToTex(expr); }

// ------------------------------
// 2) Normalizador para compatibilidad con math.js
// ------------------------------
function normalizeExprForMathJS(expr){
  let s = String(expr);
  // inversas trig: arcsin, arccos, arctan -> asin, acos, atan
  s = s.replace(/\barcsin\s*\(/g, 'asin(')
       .replace(/\barccos\s*\(/g, 'acos(')
       .replace(/\barctan\s*\(/g, 'atan(');
  // log base 10 -> log(x,10)
  s = s.replace(/\blog10\s*\(\s*([^)]+)\s*\)/g, 'log($1, 10)');
  // sec, csc, cot -> 1/cos, 1/sin, 1/tan
  s = s.replace(/\bsec\s*\(\s*([^)]+)\s*\)/g, '1/cos($1)')
       .replace(/\bcsc\s*\(\s*([^)]+)\s*\)/g, '1/sin($1)')
       .replace(/\bcot\s*\(\s*([^)]+)\s*\)/g, '1/tan($1)');
  // f^n(x) -> (f(x))^n
  s = s.replace(/\b([a-zA-Z]+)\s*\^\s*(\d+)\s*\(\s*([^)]+)\s*\)/g, '($1($3))^$2');
  // eliminar '1*' delante de símbolos
  s = s.replace(/\b1\s*\*\s*/g, '');
  return s;
}

// ------------------------------
// 3) Composición de términos/sumas (evita '+ -' desde el origen)
// ------------------------------
function termD(c, base=''){
  // Devuelve "+3*x^2", "-x", "+5"; vacía si c==0
  if (!Number.isFinite(c) || c===0) return '';
  const sgn = c < 0 ? '-' : '+';
  const a = Math.abs(c);
  if (base) {
    const mag = (a === 1) ? '' : a + '*';
    return sgn + mag + base;
  } else {
    return sgn + a;
  }
}
function stripPlus(s){ return s && s[0] === '+' ? s.slice(1) : s; }
function poly1(a,b){
  const s = (termD(a,'x') + termD(b,''));
  return stripPlus(s) || '0';
}
function poly2D(a,b,c){
  const s = (termD(a,'x^2') + termD(b,'x') + termD(c,''));
  return stripPlus(s) || '0';
}
function poly3D(a,b,c,d){
  const s = (termD(a,'x^3') + termD(b,'x^2') + termD(c,'x') + termD(d,''));
  return stripPlus(s) || '0';
}

// Utilidad para envolver una expresión en f(x)= ... cuando proceda
function wrapAsFunction(expr){
  // Algunas plataformas prefieren ver solo la función adentro del operador d/dx.
  // Aquí devolvemos la expresión tal cual; el toTex se encarga del símbolo de derivada.
  return expr;
}

// ------------------------------
// 4) Generador de DERIVADAS (8 niveles)
// ------------------------------
function generateDerivativesBank(){
  const items = [];
  const rnd = (a,b)=> Math.floor(Math.random()*(b-a+1))+a;
  const uniq = new Set();

  // push unificado: mantenemos data.a y data.approach para compatibilidad, aunque vayan null
  const push = (nivel, kind, expr, note='', evalAt=null, order=1) => {
    const key = `${nivel}|${kind}|${expr}|${note}|${evalAt}|${order}`;
    if(uniq.has(key)) return; uniq.add(key);
    items.push({
      tema: 'derivadas',
      nivel,
      kind,
      data: { expr, a: null, approach: null, note, evalAt, order },
      toTex(){
        const raw = normalizeExprForMathJS(wrapAsFunction(expr));
        const body = (typeof mathToLatex==='function') ? mathToLatex(raw)
                   : (typeof exprToTex==='function') ? exprToTex(raw)
                   : raw;
        if(this.data.order===2){
          if(this.data.evalAt!==null){
            return `\\[ \\left. \\dfrac{d^{2}}{dx^{2}} \\big(${body}\\big) \\right|_{x=${this.data.evalAt}} \\]`;
          }
          return `\\[ \\dfrac{d^{2}}{dx^{2}} \\big(${body}\\big) \\]`;
        }
        if(this.data.evalAt!==null){
          return `\\[ \\left. \\dfrac{d}{dx} \\big(${body}\\big) \\right|_{x=${this.data.evalAt}} \\]`;
        }
        return `\\[ \\dfrac{d}{dx} \\big(${body}\\big) \\]`;
      }
    });
  };

  const addMany=(gen,N)=>{ for(let i=0;i<N;i++) gen(); };

  // =========================
  // NIVEL 1 — Derivación básica (solo constante*función, sin suma/resta)
  (function(){
    const target=60;
    const bases = [
      ()=> `x^${rnd(2,200)}`,
      ()=> `${rnd(2,200)}`,
      ()=> `exp(${rnd(1,20)}*x)`,
      ()=> `10^x`,
      ()=> `log(x)`,
      ()=> `sqrt(x)`,
      ()=> `x^(1/${rnd(2,50)})`,
      ()=> `sin(x)`,
      ()=> `cos(x)`,
      ()=> `tan(x)`,
      ()=> `asin(x)`,
      ()=> `acos(x)`,
      ()=> `atan(x)`
    ];
    addMany(()=>{
      const c = rnd(-20,20) || 1; // evita 0
      const expr = (Math.abs(c)===1 ? (c<0? '-' : '') : c+'*') + bases[rnd(0,bases.length-1)]();
      push(1,'basica_constante_por_funcion', expr, 'Reglas básicas', (Math.random()<0.25? rnd(-13,13): null));
    }, target);
  })();

  // =========================
  // NIVEL 2 — Regla de la suma y de la resta (mixtas)
  (function(){
    const target=60;
    addMany(()=>{
      const p = poly3D(rnd(-4,4), rnd(-6,6), rnd(-6,6), rnd(-4,4));
      const q = stripPlus(termD(rnd(-5,5),'exp(x)') + termD(rnd(-5,5),'sin(x)'));
      const expr = stripPlus('+'+p) + (q? ('+'+q) : '');
      push(2,'suma_mixta', expr, 'Suma/resta de familias');
    }, Math.ceil(target*0.35));

    addMany(()=>{ // solo polinomios
      const expr = poly3D(rnd(-5,5), rnd(-5,5), rnd(-5,5), rnd(-5,5));
      push(2,'suma_polinomios', expr, 'Polinomios');
    }, Math.ceil(target*0.25));

    addMany(()=>{ // trig + log + exp
      const expr = stripPlus(termD(rnd(-4,4),'sin(2*x)') + termD(rnd(-4,4),'cos(3*x)') + termD(rnd(-4,4),'log(x)') + termD(rnd(-4,4),'exp(2*x)')) || '0';
      push(2,'suma_trig_log_exp', expr, 'Mixta');
    }, Math.ceil(target*0.40));
  })();

  // =========================
  // NIVEL 3 — Regla del producto
  (function(){
    const target=60;
    const factors = [
      ()=> poly1(rnd(-5,5), rnd(-5,5)),
      ()=> `exp(${rnd(1,3)}*x)`,
      ()=> `sin(${rnd(1,3)}*x)`,
      ()=> `cos(${rnd(1,3)}*x)`,
      ()=> `log(x)`
    ];
    addMany(()=>{
      const f = factors[rnd(0,factors.length-1)]();
      const g = factors[rnd(0,factors.length-1)]();
      if(f===g){ return; }
      const expr = `(${f})*(${g})`;
      push(3,'producto', expr, 'Regla del producto');
    }, target);
  })();

  // =========================
  // NIVEL 4 — Regla del cociente
  (function(){
    const target=60;
    const tops = [()=> poly2D(rnd(-5,5), rnd(-5,5), rnd(-5,5)), ()=> `exp(${rnd(1,3)}*x) + sin(${rnd(1,3)}*x)`];
    const bots = [()=> poly2D(rnd(1,5), rnd(-5,5), rnd(1,5)), ()=> `x^2 + 1`, ()=> `exp(x) + 1`];
    addMany(()=>{
      const num = tops[rnd(0,tops.length-1)]();
      const den = bots[rnd(0,bots.length-1)]();
      const expr = `(${num})/(${den})`;
      push(4,'cociente', expr, 'Regla del cociente');
    }, target);
  })();

  // =========================
  // NIVEL 5 — Regla de la cadena (simple)
  (function(){
    const target=60;
    const outers = [
      (u)=> `(${u})^${rnd(2,5)}`,
      (u)=> `sqrt(${u})`,
      (u)=> `log(${u})`,
      (u)=> `exp(${u})`,
      (u)=> `sin(${u})`,
      (u)=> `cos(${u})`,
      (u)=> `tan(${u})`
    ];
    const inners = [
      ()=> poly1(rnd(-4,4), rnd(-4,4)),
      ()=> `x^${rnd(2,4)} + ${rnd(1,4)}`,
      ()=> `exp(${rnd(1,3)}*x)`,
      ()=> `sin(${rnd(1,3)}*x)`,
      ()=> `log(x)`
    ];
    addMany(()=>{
      const inner = inners[rnd(0,inners.length-1)]();
      const outer = outers[rnd(0,outers.length-1)](inner);
      push(5,'cadena_simple', outer, 'Cadena simple');
    }, target);
  })();

  // =========================
  // NIVEL 6 — Regla de la cadena (difícil / anidada)
  (function(){
    const target=60;
    addMany(()=>{ // triple anidación
      const inner = `sqrt(${stripPlus(termD(rnd(1,4),'x') + termD(rnd(0,3),''))})`;
      const mid   = `exp(${inner})`;
      const expr  = `sin(${mid})`;
      push(6,'cadena_anidada', expr, 'Cadena anidada');
    }, Math.ceil(target*0.40));

    addMany(()=>{ // log(tan(x^2))
      const expr = `log(tan(x^2))`;
      push(6,'cadena_compuesta', expr, 'log(tan(x^2))');
    }, Math.ceil(target*0.20));

    addMany(()=>{ // (e^{x^2})^(1/3)
      const expr = `(exp(x^2))^(1/3)`;
      push(6,'cadena_otra', expr, 'Radical de exponencial');
    }, Math.ceil(target*0.20));

    addMany(()=>{ // sin(exp(sin(3x)))
      const expr = `sin(exp(sin(${rnd(2,4)}*x)))`;
      push(6,'cadena_triple', expr, 'sin(exp(sin(kx)))');
    }, Math.ceil(target*0.20));
  })();

  // =========================
  // NIVEL 7 — Derivación implícita
  (function(){
    const target=60;
    addMany(()=>{ // circunferencia
      const r = rnd(1,5);
      const expr = `x^2 + y^2 = ${r*r}`;
      push(7,'implicita_circunferencia', expr, 'dx/dy implícita');
    }, Math.ceil(target*0.30));

    addMany(()=>{ // elipse
      const a=rnd(1,5), b=rnd(1,5);
      const expr = `(x^2)/${a*a} + (y^2)/${b*b} = 1`;
      push(7,'implicita_elipse', expr, 'Elipse');
    }, Math.ceil(target*0.25));

    addMany(()=>{ // hipérbola
      const a=rnd(1,5), b=rnd(1,5);
      const expr = `(x^2)/${a*a} - (y^2)/${b*b} = 1`;
      push(7,'implicita_hiperbola', expr, 'Hipérbola');
    }, Math.ceil(target*0.20));

    addMany(()=>{ // xy = const
      const c = rnd(1,6);
      const expr = `x*y = ${c}`;
      push(7,'implicita_producto', expr, 'xy = c');
    }, Math.ceil(target*0.25));
  })();

  // =========================
  // NIVEL 8 — Segunda derivada
  (function(){
    const target=60;
    addMany(()=>{ // polinomio
      const expr = poly3D(rnd(-5,5), rnd(-5,5), rnd(-5,5), rnd(-5,5));
      push(8,'segunda_polinomio', expr, 'Segunda derivada', null, 2);
    }, Math.ceil(target*0.35));

    addMany(()=>{ // exp*sin
      const expr = `exp(${rnd(1,3)}*x) * sin(${rnd(1,3)}*x)`;
      push(8,'segunda_exp_sin', expr, 'Segunda derivada', null, 2);
    }, Math.ceil(target*0.25));

    addMany(()=>{ // log(x^2+1)
      const expr = `log(x^2+1)`;
      push(8,'segunda_log_comp', expr, 'Segunda derivada', null, 2);
    }, Math.ceil(target*0.20));

    addMany(()=>{ // (sin x)^3
      const expr = `(sin(x))^3`;
      push(8,'segunda_sin_cubo', expr, 'Segunda derivada', null, 2);
    }, Math.ceil(target*0.20));
  })();

  return items;
}

/* ===============================
 * FIN DEL BLOQUE — DERIVADAS
 * =============================== */

/* =====================================================
 *  INTEGRALES — BLOQUE COMPLETO (helpers + generador compatible con evaluador)
 *
 *  Diseño clave para que FUNCIONE en tu plataforma:
 *   - Cada item tiene: { tema:'integrales', nivel, kind:'indef'|'def', data:{expr, a, b, note}, toTex() }
 *   - Las definidas SIEMPRE incluyen data.a y data.b numéricos y FINITOS.
 *   - Nada de etiquetas 'def::' o 'indef::' dentro de expr; el tipo va en 'kind'.
 *   - Render LaTeX sin '·' y sin cadenas con "+ -".
 * ===================================================== */

// ------------------------------
// 1) Conversores a LaTeX (sin puntito de multiplicación)
// ------------------------------
function exprToTex(expr) {
  try {
    return math.parse(String(expr)).toTex({ parenthesis: 'auto', implicit: 'hide' });
  } catch (e) {
    return String(expr); // fallback simple
  }
}
function mathToLatex(expr) { return exprToTex(expr); }

// ------------------------------
// 2) Normalizador para compatibilidad con math.js
// ------------------------------
function normalizeExprForMathJS(expr){
  let s = String(expr);
  // inversas trig
  s = s.replace(/\barcsin\s*\(/g, 'asin(')
       .replace(/\barccos\s*\(/g, 'acos(')
       .replace(/\barctan\s*\(/g, 'atan(');
  // log base 10 -> log(x,10)
  s = s.replace(/\blog10\s*\(\s*([^)]+)\s*\)/g, 'log($1, 10)');
  // sec, csc, cot -> 1/cos, 1/sin, 1/tan
  s = s.replace(/\bsec\s*\(\s*([^)]+)\s*\)/g, '1/cos($1)')
       .replace(/\bcsc\s*\(\s*([^)]+)\s*\)/g, '1/sin($1)')
       .replace(/\bcot\s*\(\s*([^)]+)\s*\)/g, '1/tan($1)');
  // f^n(x) -> (f(x))^n  (para casos como sec^2(x))
  s = s.replace(/\b([a-zA-Z]+)\s*\^\s*(\d+)\s*\(\s*([^)]+)\s*\)/g, '($1($3))^$2');
  // eliminar '1*' delante de símbolos
  s = s.replace(/\b1\s*\*\s*/g, '');
  return s;
}

// ------------------------------
// 3) Limpieza de signos (seguro y estable)
// ------------------------------
function cleanExprSigns(expr){
  let s = String(expr);
  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '+' || ch === '-') {
      let minus = 0; let j = i;
      while (j < s.length && (s[j] === '+' || s[j] === '-' || s[j] === ' ')) {
        if (s[j] === '-') minus++;
        j++;
      }
      const sign = (minus % 2 === 0) ? '+' : '-';
      const prev = out.length ? out[out.length - 1] : '';
      const prevIsOp = prev === '' || "+-*/^(".includes(prev) || prev === '[' || prev === '{';
      if (!(sign === '+' && prevIsOp)) out += sign;
      i = j; continue;
    }
    out += ch; i++;
  }
  if (out[0] === '+') out = out.slice(1);
  out = out.split('\t').join(' ');
  out = out.split(' ').filter(Boolean).join(' ');
  return out.trim();
}

// ------------------------------
// 4) Compositores para términos (evitan '+ -' desde el origen)
// ------------------------------
function cfx(c, fstr){ // retorna "+3*f(x)" | "-f(x)" | "+5"
  if (!Number.isFinite(c) || c===0) return '';
  const sgn = c<0? '-' : '+';
  const a = Math.abs(c);
  const mag = (a===1 && /[a-zA-Z]/.test(fstr)) ? '' : a + '*';
  return sgn + mag + fstr;
}
function stripPlus(s){ return (s && s[0]==='+') ? s.slice(1) : s; }

// ------------------------------
// 5) Bounds → LaTeX
// ------------------------------
function fmtBoundTex(v){
  if (v === Infinity) return '\\infty';
  if (v === -Infinity) return '-\\infty';
  const M = Math;
  const candidates = [
    [M.PI, '\\pi'],
    [M.PI/2, '\\tfrac{\\pi}{2}'],
    [M.PI/3, '\\tfrac{\\pi}{3}'],
    [M.PI/4, '\\tfrac{\\pi}{4}'],
    [M.PI/6, '\\tfrac{\\pi}{6}']
  ];
  for(const [val, tex] of candidates){ if(Math.abs(v - val) < 1e-10) return tex; }
  // número con hasta 4 decimales
  return (Math.abs(v) > 1000 ? v.toExponential(2) : (Math.round(v*10000)/10000).toString());
}

// ------------------------------
// (Opcional) Parser de 'def::a::b::f(x)' y 'indef::f(x)' para compatibilidad
// ------------------------------
function parseIntegralSpec(spec){
  const s = String(spec);
  if (s.startsWith('def::')){
    const parts = s.split('::');
    const lower = parts[1];
    const upper = parts[2];
    const body  = parts.slice(3).join('::');
    return { type:'def', lower, upper, body };
  }
  if (s.startsWith('indef::')){
    const body = s.slice('indef::'.length);
    return { type:'indef', body };
  }
  return null;
}

// ------------------------------
// 6) Generador de INTEGRALES (8 niveles) — compatible con evaluador
// ------------------------------
function generateIntegralsBank(){
  const items = [];
  const uniq = new Set();
  const rnd = (a,b)=> Math.floor(Math.random()*(b-a+1))+a;
  const choice = arr => arr[rnd(0,arr.length-1)];

  const push = (nivel, kind, spec, note='', a=null, b=null) => {
    // Acepta: (i) spec tipo string normal, (ii) o etiqueta 'def::..'/'indef::..'
    let expr = null; let k = kind; let A = a; let B = b;
    const parsed = (typeof spec==='string') ? parseIntegralSpec(spec) : null;
    if (parsed){
      expr = parsed.body;
      if (parsed.type==='def'){
        k = 'def';
        A = (parsed.lower==='inf'? Infinity: parsed.lower==='-inf'? -Infinity : Number(parsed.lower));
        B = (parsed.upper==='inf'? Infinity: parsed.upper==='-inf'? -Infinity : Number(parsed.upper));
      } else { k='indef'; }
    } else {
      expr = String(spec);
      if (k!=='def' && k!=='indef') k = 'indef';
    }

    const key = `${nivel}|${k}|${expr}|${A}|${B}`;
    if(uniq.has(key)) return; uniq.add(key);

    items.push({
      tema: 'integrales',
      nivel,
      kind: k,
      data: { expr: expr, a: A, b: B, note },
      toTex(){
        const cleaned = cleanExprSigns(expr);
        const raw = normalizeExprForMathJS(cleaned);
        const body = (typeof mathToLatex==='function') ? mathToLatex(raw)
                   : (typeof exprToTex==='function') ? exprToTex(raw)
                   : raw;
        if(k==='def'){
          return `\\[ \\int_{${fmtBoundTex(A)}}^{${fmtBoundTex(B)}} ${body}\\, dx \\]`;
        }
        return `\\[ \\int ${body}\\, dx \\]`;
      }
    });
  };

  const addMany=(gen,N)=>{ for(let i=0;i<N;i++) gen(); };

  // BASES DE FUNCIONES
  const baseSimple = [
    ()=> `x^${choice([2,3,4,5,6,7,8,9])}`,
    ()=> `x^(1/${rnd(2,6)})`,
    ()=> `1/x`,
    ()=> `${rnd(1,9)}`,
    ()=> `exp(x)`, ()=> `2^x`, ()=> `10^x`,
    ()=> `sin(x)`, ()=> `cos(x)`, ()=> `tan(x)`,
    ()=> `asin(x)`, ()=> `acos(x)`, ()=> `atan(x)`,
    ()=> `sinh(x)`, ()=> `cosh(x)`, ()=> `tanh(x)`
  ];

  // =========================
  // NIVEL 1 — Integración básica (indefinidas + definidas "suaves")
  (function(){
    const target=80;
    // Indefinidas: c*f(x)
    addMany(()=>{
      const f = baseSimple[rnd(0,baseSimple.length-1)]();
      let c = rnd(-7,7); if(c===0) c=1;
      const body = stripPlus(cfx(c,f));
      push(1,'indef', body, 'Indefinida básica');
    }, Math.ceil(target*0.55));

    // Definidas básicas con límites FINITOS seguros
    addMany(()=>{
      const f = choice([
        ()=> `x^${rnd(1,4)}`,
        ()=> `exp(x)`,
        ()=> `sin(x)`,
        ()=> `cos(x)`,
        ()=> `1/(x+${rnd(2,6)})`,
        ()=> `${rnd(1,5)}`
      ])();
      const a = rnd(0,3), b = a + rnd(1,4);
      push(1,'def', f, 'Definida básica', a, b);
    }, Math.ceil(target*0.45));
  })();

  // =========================
  // NIVEL 2 — Regla de la suma/resta (indef. y definidas)
  (function(){
    const target=80;
    addMany(()=>{ // suma de 3–4 términos
      const k=rnd(3,4); let s='';
      for(let i=0;i<k;i++){
        const f = baseSimple[rnd(0,baseSimple.length-1)]();
        const c = rnd(-6,6) || 1; s += cfx(c,f);
      }
      push(2,'indef', stripPlus(s), 'Suma/resta');
    }, Math.ceil(target*0.6));

    addMany(()=>{ // definida con suma
      const f1 = stripPlus(cfx(rnd(-5,5),'x^2') + cfx(rnd(-5,5),'x') + cfx(rnd(-5,5),'1'));
      const f2 = stripPlus(cfx(rnd(-5,5),'sin(x)') + cfx(rnd(-5,5),'exp(x)'));
      const body = stripPlus('+'+f1) + (f2? ('+'+f2):'');
      const a = rnd(0,2), b = a+rnd(2,4);
      push(2,'def', body, 'Definida suma', a, b);
    }, Math.ceil(target*0.4));
  })();

  // =========================
  // NIVEL 3 — Sustitución u (simple)
  (function(){
    const target=70;
    // (ax+b)^n
    addMany(()=>{ const a=rnd(1,5), b=rnd(-5,5), n=rnd(1,5);
      const body = `(${a}*x+${b})^${n}`;
      push(3,'indef', body, 'u = ax+b');
    }, Math.ceil(target*0.35));

    // a*cos(ax+b), a*sin(ax+b), a*exp(ax+b)
    addMany(()=>{ const a=rnd(1,5), b=rnd(-5,5);
      const form = choice([`cos(${a}*x+${b})`,`sin(${a}*x+${b})`,`exp(${a}*x+${b})`]);
      const body = stripPlus(cfx(a, form)); // a*f(ax+b)
      push(3,'indef', body, 'u = ax+b');
    }, Math.ceil(target*0.35));

    // f'(x)/f(x) => ln|f|
    addMany(()=>{ const a=rnd(1,6), b=rnd(-6,6);
      const body = `(${a})/(${a}*x+${b})`;
      push(3,'indef', body, "f'(x)/f(x)");
    }, Math.ceil(target*0.30));
  })();

  // =========================
  // NIVEL 4 — Integración por partes (sencillas)
  (function(){
    const target=70;
    addMany(()=>{ const a=rnd(1,4); const body = `x*exp(${a}*x)`; push(4,'indef', body, 'u=x, dv=e^{ax}dx'); }, Math.ceil(target*0.25));
    addMany(()=>{ const b=rnd(1,4); const body = `x*sin(${b}*x)`; push(4,'indef', body, 'u=x, dv=sin(bx)dx'); }, Math.ceil(target*0.25));
    addMany(()=>{ const n=rnd(1,3); const body = `x^${n}*log(x)`; push(4,'indef', body, 'u=log x'); }, Math.ceil(target*0.25));
    addMany(()=>{ const body = `atan(x)`; push(4,'indef', body, 'u=arctan x'); }, Math.ceil(target*0.25));
  })();

  // =========================
  // NIVEL 5 — Integración trigonométrica (indef.)
  (function(){
    const target=70;
    addMany(()=>{ const m=choice([1,2,3,4,5]); const n=choice([1,2,3,4]);
      const body = `sin(x)^${m}*cos(x)^${n}`; push(5,'indef', body, 'potencias seno/cos');
    }, Math.ceil(target*0.40));
    addMany(()=>{ const k=rnd(1,4); const body = `tan(${k}*x)*sec(${k}*x)`; push(5,'indef', body, 'tan*sec'); }, Math.ceil(target*0.20));
    addMany(()=>{ const k=rnd(1,4); const body = `sec(${k}*x)^2`; push(5,'indef', body, 'sec^2'); }, Math.ceil(target*0.20));
    addMany(()=>{ const body = `1/(1+tan(x)^2)`; push(5,'indef', body, 'identidad'); }, Math.ceil(target*0.20));
  })();

  // =========================
  // NIVEL 6 — Sustitución trigonométrica (definidas PROPIAS)
  (function(){
    const target=70;
    addMany(()=>{ const a=1; const body = `1/sqrt(${a*a} - x^2)`; push(6,'def', body, 'x=a sin t', -0.9, 0.9); }, Math.ceil(target*0.30));
    addMany(()=>{ const a=1; const body = `1/sqrt(x^2 + ${a*a})`; push(6,'def', body, 'x=a sinh t', 0, 2); }, Math.ceil(target*0.30));
    addMany(()=>{ const a=rnd(2,4); const body = `x^2/sqrt(x^2 + ${a*a})`; push(6,'def', body, 'evita singularidad', 0, 2); }, Math.ceil(target*0.40));
  })();

  // =========================
  // NIVEL 7 — Fracciones parciales (definidas PROPIAS)
  (function(){
    const target=70;
    addMany(()=>{ const a=rnd(1,4), b=rnd(5,9); const body = `( ${rnd(1,4)}*x + ${rnd(1,4)} ) / ( (x+${a})*(x+${b}) )`; push(7,'def', body, 'lineales distintos', 0, 1); }, Math.ceil(target*0.45));
    addMany(()=>{ const a=rnd(1,4); const body = `( ${rnd(1,4)}*x + ${rnd(1,4)} ) / ( (x+${a})^2 )`; push(7,'def', body, 'lineal repetido', 0, 1); }, Math.ceil(target*0.25));
    addMany(()=>{ const p=rnd(-3,3), q=rnd(2,6); const body = `( ${rnd(1,4)}*x + ${rnd(1,4)} ) / ( x^2 + ${p}*x + ${q} )`; push(7,'def', body, 'cuadrática irreducible', 0, 1); }, Math.ceil(target*0.30));
  })();

  // =========================
  // NIVEL 8 — "Impropias" (pero evaluables por el numérico)
  // Se evitan límites infinitos y valores singulares exactos.
  (function(){
    const target=70;
    addMany(()=>{ const c=rnd(1,3); const body = `exp(-${c}*x)`; push(8,'def', body, 'aprox 0→∞', 0, 8); }, Math.ceil(target*0.30));
    addMany(()=>{ const body = `1/(1+x^2)`; push(8,'def', body, 'campana racional', -3, 3); }, Math.ceil(target*0.30));
    addMany(()=>{ const body = `1/sqrt(x+2)`; push(8,'def', body, 'raíz desplazada', 0, 2); }, Math.ceil(target*0.40));
  })();

  return items;
}

/* ===============================
 * FIN DEL BLOQUE — INTEGRALES
 * =============================== */




  // ========= Banco de problemas =========
  function generateBank(){
    const bank = { limites:[], derivadas:[], integrales:[] };
    bank.limites = generateLimitsBank();
    bank.derivadas = generateDerivativesBank();
    bank.integrales = generateIntegralsBank();
    return bank;
  }
  const BANK = generateBank();

  // ========= UI Switching =========
  $$('.tab').forEach(btn=>btn.addEventListener('click',()=>{
    $$('.tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.dataset.mode;
    STATE.modo = mode;
    $('#lbl-modo').textContent = (mode==='practica'?'Practicar': mode==='examen'?'Examen':'Analítica');
    $('#panel-practica').classList.toggle('hidden', mode!=='practica');
    $('#panel-examen').classList.toggle('hidden', mode!=='examen');
    $('#panel-analitica').classList.toggle('hidden', mode!=='analitica');
    if(mode==='analitica') refreshAnalytics();
  }));

  // ===== Drawer ESTILOS =====
  $('#btn-styles').addEventListener('click', ()=>{
    const d = $('#styles-menu'); d.classList.add('open'); d.setAttribute('aria-hidden','false');
  });
  $('#btn-styles-close').addEventListener('click', ()=>{
    const d = $('#styles-menu'); d.classList.remove('open'); d.setAttribute('aria-hidden','true');
  });
  document.addEventListener('click', (e)=>{
    const d = $('#styles-menu');
    if(!d.classList.contains('open')) return;
    if(!e.target.closest('#styles-menu') && !e.target.closest('#btn-styles')){
      d.classList.remove('open'); d.setAttribute('aria-hidden','true');
    }
  });
  $$('.swatch').forEach(s=>s.addEventListener('click', ()=>{
    const key = s.getAttribute('data-key');
    const {primary, secondary} = presetTheme(key);
    const light = $('#theme-light').checked;
    applyTheme({primary, secondary, light, radius:+$('#range-radius').value, fontScale:+$('#range-font').value, contrast:+$('#range-contrast').value});
    $('#col-primary').value = primary; $('#col-secondary').value = secondary;
  }));
  $('#btn-save-theme').addEventListener('click', ()=>{
    applyTheme({
      primary:$('#col-primary').value, secondary:$('#col-secondary').value,
      light:$('#theme-light').checked,
      radius:+$('#range-radius').value, fontScale:+$('#range-font').value, contrast:+$('#range-contrast').value
    });
  });
  $('#btn-reset-theme').addEventListener('click', ()=>{
    localStorage.removeItem(THEME_KEY);
    const base = presetTheme('azul');
    $('#col-primary').value = base.primary; $('#col-secondary').value = base.secondary; $('#theme-light').checked=false;
    $('#range-radius').value=16; $('#range-font').value=1.0; $('#range-contrast').value=1.0; updateStyleLabels();
    applyTheme({ ...base, light:false, radius:16, fontScale:1.0, contrast:1.0 });
  });
  ['range-radius','range-contrast','range-font'].forEach(id=>{
    $('#'+id).addEventListener('input', ()=>{ updateStyleLabels(); });
  });

  // Enfoque / Fullscreen
  $('#btn-focus').addEventListener('click', ()=>{ document.body.classList.toggle('focus-mode'); });
  $('#btn-fullscreen').addEventListener('click', async ()=>{
    const el = document.documentElement;
    if(!document.fullscreenElement){
      try{ await el.requestFullscreen(); document.body.classList.add('fullscreen-active'); }catch{ document.body.classList.toggle('fullscreen-active'); }
    }else{
      try{ await document.exitFullscreen(); }finally{ document.body.classList.remove('fullscreen-active'); }
    }
  });
  document.addEventListener('fullscreenchange', ()=>{
    if(!document.fullscreenElement){ document.body.classList.remove('fullscreen-active'); }
  });

  // User switch
  $('#btn-switch').addEventListener('click', ()=>{
    const sel = $('#sel-users');
    sel.innerHTML='';
    getUsers().forEach(u=>{ const o=document.createElement('option'); o.value=u; o.textContent=u; sel.appendChild(o); });
    $('#modal-login').style.display='flex';
  });
  $('#btn-login-existing').addEventListener('click', ()=>{ const u = $('#sel-users').value || 'Invitado'; setCurrentUser(u); closeLogin(); });
  $('#btn-create-user').addEventListener('click', ()=>{ const v = ($('#in-new-user').value||'').trim(); if(!v) return; const users = new Set(getUsers()); users.add(v); setUsers([...users]); setCurrentUser(v); closeLogin(); });

  // ========= Selection controls =========
  $('#sel-tema').addEventListener('change', (e)=>{ STATE.tema = e.target.value; newPractice(); });
  $('#sel-nivel').addEventListener('change', (e)=>{ STATE.nivel = +e.target.value; newPractice(); });

  // ========= Teclado auxiliar =========
  $$('.kbdbar button').forEach(b=>b.addEventListener('click', ()=>{
    const ins = b.getAttribute('data-ins');
    const ta = (STATE.modo==='examen')? $('#ex-respuesta') : $('#tx-respuesta');
    const s = ta.selectionStart||0, e = ta.selectionEnd||0;
    const val = ta.value;
    ta.value = val.slice(0,s) + ins + val.slice(e);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = s + ins.length;
    updatePreview(); updatePreviewExam();
  }));

  // ========= PRÁCTICA =========
  function pickProblem(tema, nivel){ const pool = BANK[tema].filter(p=>p.nivel===+nivel); return pool[rnd(0,pool.length-1)]; }
  function renderProblem(where, p){
    where.innerHTML = p.toTex();
    MathJax.typesetPromise([where]);
    const tags = `Tema: <span class="tag">${p.tema}</span> · Nivel: <span class="tag">${p.nivel}</span>`;
    if(where.id==='problem-tex'){ $('#problem-tags').innerHTML = tags; } else { $('#ex-problem-tags').innerHTML = tags; }
  }
  function newPractice(){ STATE.currentProblem = pickProblem(STATE.tema, STATE.nivel); renderProblem($('#problem-tex'), STATE.currentProblem); $('#tx-respuesta').value=''; setStatus('', ''); updatePreview(); }
  function setStatus(txt, fb, ok=null){ const el = $('#lbl-estado'); el.textContent = txt; el.classList.remove('ok','bad'); if(ok===true) el.classList.add('ok'); else if(ok===false) el.classList.add('bad'); $('#lbl-feedback').textContent = fb||''; }
  function updatePreview(){ const s = $('#tx-respuesta').value.trim(); const dst = $('#ans-preview'); renderPreviewTo(dst, s); }
  function updatePreviewExam(){ const s = $('#ex-respuesta').value.trim(); const dst = $('#ex-ans-preview'); renderPreviewTo(dst, s); }
  function renderPreviewTo(node, text){
    if(!text){ node.innerHTML = '<span class="muted small">— sin entrada —</span>'; return; }
    const seemsTeX = /\\(frac|int|sqrt|sin|cos|tan|ln|log|lim|infty|to)/.test(text) || /^\$/.test(text);
    let tex;
    if(seemsTeX){ tex = `\\[ ${text} \\]`; }
    else { try{ tex = `\\[ ${exprToTex(text)} \\]`; }catch(e){ tex = text; } }
    node.innerHTML = tex;
    MathJax.typesetPromise([node]);
  }

  async function checkAnswer(problem, userAns){
    const t0 = performance.now();
    const tema = problem.tema;
    let ok=false, feedback='', reason='';
    try{
      if(tema==='limites'){
        const {expr, a, approach} = problem.data;
        const limVal = limitNumeric(expr, a, approach);
        let expectedStr = !isFinite(limVal) ? (limVal===Infinity?'∞':'-∞') : fmt(limVal);
        const v = parseNumericMaybe(userAns);
        if(v!==null){
          if(!isFinite(limVal) && !isFinite(v) && ((limVal>0 && v>0) || (limVal<0 && v<0))){ ok=true; }
          else if(isFinite(limVal) && isFinite(v)){
            ok = Math.abs(v - limVal) <= 1e-3 * Math.max(1, Math.abs(limVal)) || Math.abs(v - limVal) <= 2e-4;
            if(!ok) reason='off_tolerance';
          } else { reason='finite_vs_infinite'; }
        }else{
          const testx = (a===Infinity)? 200 : (a+1e-4);
          const uv = safeEvalExpr(userAns, testx);
          if(isFinite(limVal) && isFinite(uv)){
            ok = Math.abs(uv - limVal) <= 1e-2 * Math.max(1, Math.abs(limVal));
            if(!ok) reason='symbolic_mismatch';
          }else{ reason='unparsable'; }
        }
        feedback = `Vuelve a intentarlo`;
      }
      else if(tema==='derivadas'){
        const {expr} = problem.data;
        let dtexp = null;
        try{ dtexp = math.derivative(expr,'x').toString(); }
        catch(e){ try{ dtexp = nerdamer.diff(expr,'x').toString(); }catch(e2){ dtexp = null; } }
        const pts = [ -1.3, -0.7, -0.2, 0.2, 0.7, 1.3, 2.1 ].map(v=>v + rnd(-2,2)*1e-3);
        ok = true;
        for(const x of pts){
          const target = dtexp? safeEvalExpr(dtexp, x) : numericDerivative(expr,x);
          const userv = safeEvalExpr(userAns, x);
          if(!isFinite(target) || !isFinite(userv)){ ok=false; reason='unparsable'; break; }
          const tol = 1e-2 * Math.max(1, Math.abs(target));
          if(Math.abs(userv - target) > tol){ ok=false; reason='off_tolerance'; break; }
        }
        feedback = 'Vuelve a intentarlo.';
      }
      else if(tema==='integrales'){
        const kind = problem.kind;
        if(kind==='indef'){
          const f = problem.data.expr;
          let du = null;
          try{ du = math.derivative(userAns,'x').toString(); }
          catch(e){ try{ du = nerdamer.diff(userAns,'x').toString(); }catch(e2){ du = null; } }
          const pts = [ -1.1,-0.6,-0.2,0.2,0.8,1.5,2.0 ];
          ok = true;
          for(const x of pts){
            const target = safeEvalExpr(f, x);
            let userd = du? safeEvalExpr(du, x) : NaN;
            if(!isFinite(userd)){ userd = numericDerivative(userAns, x); }
            const tol = 2e-2 * Math.max(1, Math.abs(target));
            if(!(isFinite(target) && isFinite(userd)) || Math.abs(userd - target) > tol){ ok=false; reason='derivative_mismatch'; break; }
          }
          feedback = 'Comprobado derivando tu respuesta (se acepta +C).';
        } else {
          const f = problem.data.expr, a = problem.data.a, b = problem.data.b;
          const exact = numericIntegral(f, a, b);
          const v = parseNumericMaybe(userAns);
          ok = (v!==null) && Math.abs(v - exact) <= 1e-2 * Math.max(1, Math.abs(exact)) + 1e-3;
          if(!ok) reason='off_tolerance';
          feedback = ``;
        }
      }
    }catch(e){
      ok=false; feedback = 'No se pudo validar. Revisa formato de la respuesta.'; reason='exception';
    }
    const ms = Math.round(performance.now()-t0);
    return {ok, feedback, ms, reason};
  }

  // ========= PRÁCTICA (eventos) =========
  $('#btn-verificar').addEventListener('click', async ()=>{
    const ans = $('#tx-respuesta').value.trim(); if(!ans){ setStatus('—', 'Escribe una respuesta.'); return; }
    const {ok, feedback, ms, reason} = await checkAnswer(STATE.currentProblem, ans);
    if(ok){ setStatus('¡Correcto!', feedback, true); STATE.session.ok++; STATE.session.racha++; }
    else { setStatus('Incorrecto', feedback, false); STATE.session.bad++; STATE.session.racha=0; }
    $('#m-ok').textContent = STATE.session.ok; $('#m-bad').textContent = STATE.session.bad; $('#m-racha').textContent = STATE.session.racha;
    pushStat({ t: Date.now(), user: USER.name, tema: STATE.currentProblem.tema, nivel: STATE.currentProblem.nivel, ok, modo:'practica', ms, reason, q: STATE.currentProblem.toTex(), ans });
  });
  $('#btn-siguiente').addEventListener('click', ()=> newPractice());
  $('#tx-respuesta').addEventListener('input', updatePreview);

  // ========= EXAMEN =========
  let exTimer=null, exTimeLeft=0;
  function startExam(){
    const np = clamp(+$('#ex-npreg').value||8, 3, 40);
    const mins = clamp(+$('#ex-min').value||15, 3, 240);
    const tema = STATE.tema, nivel=STATE.nivel;
    const pool = BANK[tema].filter(p=>p.nivel===+nivel);
    const items = []; const copy = [...pool];
    for(let i=0;i<np;i++){ if(copy.length===0) copy.push(...pool); const idx = rnd(0,copy.length-1); items.push(copy.splice(idx,1)[0]); }
    STATE.exam = { tema, nivel, items, idx:0, ok:0, bad:0, answers:[], started: Date.now() };
    $('#ex-estado').textContent = 'En curso';
    $('#ex-qtot').textContent = String(np);
    $('#ex-qnum').textContent = '1';
    $('#ex-running').classList.remove('hidden');
    $('#ex-summary').classList.add('hidden');
    exTimeLeft = mins*60; updateExamTimer();
    if(exTimer) clearInterval(exTimer);
    exTimer = setInterval(()=>{ exTimeLeft--; updateExamTimer(); if(exTimeLeft<=0){ finishExam(); } },1000);
    renderProblem($('#ex-problem-tex'), STATE.exam.items[0]);
    $('#ex-respuesta').value=''; $('#ex-estado-item').textContent=''; $('#ex-estado-item').classList.remove('ok','bad'); updatePreviewExam();
  }
  function updateExamTimer(){ const m = Math.floor(exTimeLeft/60); const s = exTimeLeft%60; $('#ex-timer').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
  async function verifyExamItem(){
    const ans = $('#ex-respuesta').value.trim(); if(!ans){ $('#ex-estado-item').textContent='— escribe una respuesta'; return; }
    const pr = STATE.exam.items[STATE.exam.idx];
    const {ok, feedback, ms, reason} = await checkAnswer(pr, ans);
    $('#ex-estado-item').textContent = ok?'Correcto':'Incorrecto';
    $('#ex-estado-item').classList.remove('ok','bad'); $('#ex-estado-item').classList.add(ok?'ok':'bad');
    if(ok) STATE.exam.ok++; else STATE.exam.bad++;
    STATE.exam.answers.push({i:STATE.exam.idx, ok, ans, ms, feedback, reason, qtex: pr.toTex() });
    pushStat({t:Date.now(), user: USER.name, tema:pr.tema, nivel:pr.nivel, ok, modo:'examen', ms, reason, q: pr.toTex(), ans});
    STATE.exam.idx++;
    if(STATE.exam.idx>=STATE.exam.items.length){ finishExam(); }
    else{
      $('#ex-qnum').textContent = String(STATE.exam.idx+1);
      renderProblem($('#ex-problem-tex'), STATE.exam.items[STATE.exam.idx]);
      $('#ex-respuesta').value=''; $('#ex-estado-item').textContent=''; $('#ex-estado-item').classList.remove('ok','bad'); updatePreviewExam();
    }
  }
  function skipExamItem(){
    const pr = STATE.exam.items[STATE.exam.idx];
    STATE.exam.answers.push({i:STATE.exam.idx, ok:false, ans:'(saltado)', ms:0, feedback:'', reason:'skip', qtex: pr.toTex()});
    STATE.exam.bad++;
    pushStat({t:Date.now(), user: USER.name, tema:pr.tema, nivel:pr.nivel, ok:false, modo:'examen', ms:0, reason:'skip', q: pr.toTex(), ans:'(saltado)'});
    STATE.exam.idx++;
    if(STATE.exam.idx>=STATE.exam.items.length){ finishExam(); }
    else{
      $('#ex-qnum').textContent = String(STATE.exam.idx+1);
      renderProblem($('#ex-problem-tex'), STATE.exam.items[STATE.exam.idx]);
      $('#ex-respuesta').value=''; $('#ex-estado-item').textContent=''; $('#ex-estado-item').classList.remove('ok','bad'); updatePreviewExam();
    }
  }
  function finishExam(){
    if(exTimer) clearInterval(exTimer);
    $('#ex-running').classList.add('hidden');
    $('#ex-summary').classList.remove('hidden');
    const ok = STATE.exam.ok, bad = STATE.exam.bad; const tot = ok+bad; const score = Math.round(100*ok/Math.max(1,tot));
    $('#ex-ok').textContent = ok; $('#ex-bad').textContent = bad; $('#ex-score').textContent = score + '%';
    $('#ex-t-seleccion').textContent = STATE.exam.tema; $('#ex-n-seleccion').textContent = STATE.exam.nivel; $('#ex-estado').textContent = 'Completado';
  }
  $('#btn-examen-start').addEventListener('click', startExam);
  $('#btn-ex-verificar').addEventListener('click', verifyExamItem);
  $('#btn-ex-skip').addEventListener('click', skipExamItem);
  $('#ex-respuesta').addEventListener('input', updatePreviewExam);

  // ========= Analytics =========
  function metricsBy(keysFn){
    const rows = loadStats();
    const map = new Map();
    for(const r of rows){
      const key = keysFn(r);
      if(!map.has(key)) map.set(key, {attempts:0, ok:0, ms:0});
      const m = map.get(key);
      m.attempts++; if(r.ok) m.ok++; m.ms += (r.ms||0);
    }
    const out = [];
    for(const [k,v] of map.entries()){
      out.push({key:k, attempts:v.attempts, ok:v.ok, acc: (v.attempts? Math.round(100*v.ok/v.attempts) : 0), tbar: Math.round(v.ms/Math.max(1,v.attempts))});
    }
    out.sort((a,b)=>a.key.localeCompare(b.key));
    return out;
  }
  function chartColors(){
    const cs = getComputedStyle(document.documentElement);
    const accent = cs.getPropertyValue('--accent').trim() || '#4f8cff';
    const ink = cs.getPropertyValue('--ink').trim() || '#e8ecf1';
    return {accent, ink};
  }
  function refreshAnalytics(){
    const rows = loadStats();
    $('#an-total').textContent = rows.length;
    const acc = rows.length? Math.round(100*rows.filter(r=>r.ok).length/rows.length):0;
    $('#an-acc').textContent = acc+'%';
    const tb = $('#tbl-hist tbody'); tb.innerHTML='';
    for(let i=rows.length-1;i>=Math.max(0, rows.length-300);i--){
      const r = rows[i]; const dt = new Date(r.t).toLocaleString('es-GT');
      tb.insertAdjacentHTML('beforeend', `<tr><td>${dt}</td><td>${r.tema}</td><td>${r.nivel}</td><td>${r.ok?'✔':'✘'}</td><td>${r.modo}</td><td>${r.ms}</td><td>${r.reason||''}</td></tr>`);
    }
    const temas = ['limites','derivadas','integrales'];
    const accTema = temas.map(t=>{ const f = rows.filter(r=>r.tema===t); if(!f.length) return 0; return Math.round(100* f.filter(r=>r.ok).length / f.length); });
    const niveles = [...Array(8).keys()].map(i=>i+1);
    const accNivel = niveles.map(n=>{ const f = rows.filter(r=>r.nivel===n); if(!f.length) return 0; return Math.round(100* f.filter(r=>r.ok).length / f.length); });
    const {accent, ink} = chartColors();
    const ctx1 = $('#ch-temas').getContext('2d');
    const ctx2 = $('#ch-niveles').getContext('2d');
    if(STATE.charts.temas){ STATE.charts.temas.destroy(); }
    if(STATE.charts.niveles){ STATE.charts.niveles.destroy(); }
    STATE.charts.temas = new Chart(ctx1, {
      type:'bar',
      data:{ labels:['Límites','Derivadas','Integrales'], datasets:[{label:'Precisión %', data: accTema, backgroundColor: accent}] },
      options:{ responsive:true, maintainAspectRatio:true, plugins:{legend:{display:true, labels:{color:ink}}}, scales:{y:{beginAtZero:true, max:100, ticks:{color:ink}}, x:{ticks:{color:ink}} } }
    });
    STATE.charts.niveles = new Chart(ctx2, {
      type:'bar',
      data:{ labels: niveles.map(String), datasets:[{label:'Precisión %', data: accNivel, backgroundColor: accent}] },
      options:{ responsive:true, maintainAspectRatio:true, plugins:{legend:{display:true, labels:{color:ink}}}, scales:{y:{beginAtZero:true, max:100, ticks:{color:ink}}, x:{ticks:{color:ink}} } }
    });
  }
  window.refreshAnalytics = refreshAnalytics; // used by theme engine

  // ========= Export CSV =========
  function exportCSV(rows, name){
    const head = ['fecha','usuario','tema','nivel','correcto','modo','ms','razon','pregunta_tex','respuesta'];
    const csv = [head.join(',')].concat(rows.map(r=>{
      const d = new Date(r.t).toISOString();
      const esc = (s)=>(''+s).replace(/"/g,'""');
      return [d, r.user||USER.name, r.tema, r.nivel, r.ok?'1':'0', r.modo, r.ms, r.reason||'', `"${esc(r.q||'')}"`, `"${esc(r.ans||'')}"`].join(',');
    })).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  $('#btn-an-csv').addEventListener('click', ()=> exportCSV(loadStats(), 'analitica_calculo.csv') );
  $('#btn-ex-export-csv').addEventListener('click', ()=>{
    const ex = STATE.exam; if(!ex){ alert('No hay examen finalizado.'); return; }
    const rows = ex.answers.map(r=>{ const pr = ex.items[r.i]; return {t: ex.started, user: USER.name, tema: pr.tema, nivel: pr.nivel, ok: r.ok, modo:'examen', ms:r.ms||0, reason:r.reason||'', q: r.qtex, ans:r.ans}; });
    exportCSV(rows, 'examen_calculo.csv');
  });

  // ========================= PDF UTILITIES =========================
  const { jsPDF } = window.jspdf;
  async function ensureMathJax(){ if(window.MathJax && MathJax.startup){ await MathJax.startup.promise; return true; } return false; }
  function texToSVGElement(tex){ const node = MathJax.tex2svg(tex, { display: false }); const svg = node.querySelector('svg'); return svg; }
  function drawTeX(doc, tex, x, y, maxWidth){
    return new Promise((resolve) => {
      const check = () => {
        if (window.svg2pdf && window.svg2pdf.svg2pdf) {
          const svg = texToSVGElement(tex);
          if (!svg) { resolve(0); return; }
          const vb = (svg.getAttribute('viewBox') || '0 0 100 30').split(' ').map(Number);
          const vbW = vb[2], vbH = vb[3];
          const targetW = maxWidth || 170;
          const scale = targetW / vbW;
          window.svg2pdf.svg2pdf(svg, doc, { x, y, width: targetW, height: vbH * scale });
          resolve(vbH * scale);
        } else {
          setTimeout(check, 80);
        }
      };
      check();
    });
  }
  function ribbonHeader(doc, { title, subtitle, accent }){
    const w = doc.internal.pageSize.getWidth(); const h = 26;
    const rgb = hexToRgb(accent||'#1e88e5');
    doc.setFillColor(rgb.r, rgb.g, rgb.b); doc.rect(0,0,w,h,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(16); doc.text(title, 12, 16);
    if(subtitle){ doc.setFontSize(10); doc.text(subtitle, 12, 22); }
    doc.setTextColor(0,0,0);
  }
  function footerAllPages(doc, { studentName }){
    const pageCount = doc.getNumberOfPages();
    for(let i=1;i<=pageCount;i++){ doc.setPage(i); const h = doc.internal.pageSize.getHeight();
      doc.setFontSize(9); doc.setTextColor(120); doc.text(`Alumno: ${studentName||'Estudiante'} · Página ${i}/${pageCount}`, 12, h-8); doc.setTextColor(0);
    }
  }
  function table(doc, { head, body, startY }){
    doc.autoTable({ head: [head], body, startY: startY || 40, styles: { fontSize: 10, cellPadding: 3 },
                    headStyles: { fillColor: [30,136,229], textColor: 255 },
                    alternateRowStyles: { fillColor: [245,247,250] }, theme: 'striped', margin: { left:12, right:12 } });
    return doc.lastAutoTable.finalY || startY;
  }
  function addChartImage(doc, chart, x, y, w){
    if(!chart) return y; const url = chart.toBase64Image('image/png', 1.0);
    const width = w || 88; const height = width * 0.62; doc.addImage(url, 'PNG', x, y, width, height); return y + height + 4;
  }
  function hexToRgb(hex){
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex||'#1e88e5');
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : {r:30,g:136,b:229};
  }
  function readAccent(){ try{ const raw = localStorage.getItem(THEME_KEY); if(raw){ const t = JSON.parse(raw); return t.primary || '#1e88e5'; } }catch(e){} return '#1e88e5'; }

  function computeAnalyticsData(){
    const rows = loadStats();
    const totalItems = rows.length;
    const correct = rows.filter(r=>r.ok).length;
    const avgMs = totalItems? rows.reduce((a,b)=>a+(b.ms||0),0)/totalItems : 0;
    const sorted = rows.slice(); sorted.sort((a,b)=> (a.t||0)-(b.t||0));
    let streak=0, best=0; for(const r of sorted){ if(r.ok){ streak++; if(streak>best) best=streak; } else { streak=0; } }
    const topicsMap = new Map(); const levelsMap = new Map(); const modeMap = new Map();
    for(const r of rows){
      const t=r.tema, l=String(r.nivel), m=r.modo;
      if(!topicsMap.has(t)) topicsMap.set(t,{attempts:0, ok:0, sumMs:0});
      if(!levelsMap.has(l)) levelsMap.set(l,{attempts:0, ok:0, sumMs:0});
      if(!modeMap.has(m)) modeMap.set(m,{attempts:0, ok:0, sumMs:0});
      const T=topicsMap.get(t), L=levelsMap.get(l), M=modeMap.get(m);
      T.attempts++; T.ok+=r.ok?1:0; T.sumMs+=(r.ms||0);
      L.attempts++; L.ok+=r.ok?1:0; L.sumMs+=(r.ms||0);
      M.attempts++; M.ok+=r.ok?1:0; M.sumMs+=(r.ms||0);
    }
    const topics = Array.from(topicsMap, ([topic,v])=>({ topic, attempts:v.attempts, correct:v.ok, avgMs: v.attempts? v.sumMs/v.attempts:0 }));
    const levels = Array.from(levelsMap, ([level,v])=>({ level, attempts:v.attempts, correct:v.ok, avgMs: v.attempts? v.sumMs/v.attempts:0 }));
    const byMode = Array.from(modeMap, ([mode,v])=>({ mode, attempts:v.attempts, correct:v.ok, avgMs: v.attempts? v.sumMs/v.attempts:0 }));
    const history = rows.map(r=>({ date: new Date(r.t).toLocaleString('es-GT'), topic:r.tema, level:r.nivel, correct:r.ok?'✔':'✘', mode:r.modo, ms:r.ms||0, reason:r.reason||'' }));
    return { totalItems, correct, avgMs, streak:best, topics, levels, byMode, history };
  }

  async function buildAnalyticsPDF(opts={compact:false}){
    await ensureMathJax();
    refreshAnalytics();
    const data = computeAnalyticsData();
    const studentName = USER.name || 'Estudiante';
    const doc = new jsPDF({ unit:'mm', format:'a4' });
    const accent = readAccent();

    
    
    ribbonHeader(doc, { title: opts.compact ? ' Mathesis - Reporte Analítico (Compacto) — Cálculo' : ' Mathesis - Reporte Analítico — Cálculo', subtitle: todayStr(), accent });
    doc.setFontSize(12); doc.text(`Estudiante: ${studentName}`, 12, 36); doc.text(`Rango: ${opts.range||'Todo'}`, 12, 42);
    let y = 50;
    const kpis = [
      ['Total ítems', data.totalItems],
      ['Aciertos', data.correct],
      ['Precisión global', (data.totalItems? (100*data.correct/data.totalItems).toFixed(1):'0.0') + '%'],
      ['t̄ por ítem', Math.round(data.avgMs) + ' ms'],
      ['Mejor racha', data.streak]
    ];
    doc.autoTable({ startY:y, head:[['KPI','Valor']], body:kpis, theme:'grid', styles:{fontSize:10}, headStyles:{fillColor:[30,136,229], textColor:255}, margin:{left:12,right:12} });
    y = doc.lastAutoTable.finalY + 6;
    if(!opts.compact){
      y = addChartImage(doc, STATE.charts.temas, 12, y, 90);
      y = addChartImage(doc, STATE.charts.niveles, 108, y- (90*0.62 + 4), 90);
      y += 2;
    }
    const topicsBody = data.topics.map(t=>[t.topic, t.attempts, t.correct, (t.attempts? Math.round(100*t.correct/t.attempts):0)+'%', Math.round(t.avgMs)]);
    doc.autoTable({ startY:y, head:[['Tema','Intentos','Aciertos','Precisión','t̄ (ms)']], body:topicsBody, theme:'striped', styles:{fontSize:10}, headStyles:{fillColor:[30,136,229], textColor:255}, margin:{left:12,right:12} });
    y = doc.lastAutoTable.finalY + 4;
    const levelsBody = data.levels.map(t=>[t.level, t.attempts, t.correct, (t.attempts? Math.round(100*t.correct/t.attempts):0)+'%', Math.round(t.avgMs)]);
    doc.autoTable({ startY:y, head:[['Nivel','Intentos','Aciertos','Precisión','t̄ (ms)']], body:levelsBody, theme:'striped', styles:{fontSize:10}, headStyles:{fillColor:[30,136,229], textColor:255}, margin:{left:12,right:12} });
    y = doc.lastAutoTable.finalY + 4;
    if(!opts.compact){
      const modesBody = data.byMode.map(t=>[t.mode, t.attempts, t.correct, (t.attempts? Math.round(100*t.correct/t.attempts):0)+'%', Math.round(t.avgMs)]);
      doc.autoTable({ startY:y, head:[['Modo','Intentos','Aciertos','Precisión','t̄ (ms)']], body:modesBody, theme:'striped', styles:{fontSize:10}, headStyles:{fillColor:[30,136,229], textColor:255}, margin:{left:12,right:12} });
      y = doc.lastAutoTable.finalY + 4;
    }
    const histBody = data.history.slice(-200).map(h=>[h.date,h.topic,h.level,h.correct,h.mode,h.ms,h.reason]);
    doc.autoTable({ startY:y, head:[['Fecha','Tema','Nivel','Correcto','Modo','ms','Nota']], body:histBody, theme:'grid', styles:{fontSize:9}, headStyles:{fillColor:[30,136,229], textColor:255}, margin:{left:12,right:12} });
    footerAllPages(doc, { studentName });
    doc.save(opts.compact ? 'analitica_compacto.pdf' : 'analitica_detallado.pdf');
  }
  async function buildExamPDF() {
  const PLATFORM = 'Mathesis';
  const studentName = USER.name || 'Estudiante';
  await ensureMathJax();


  const ex = STATE && STATE.exam;
  if (!ex) { alert('Primero completa un examen.'); return; }

  // ----------------- Constantes de layout -----------------
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const A4_W = 210, A4_H = 297;
  const MARGIN = 14;
  const CONTENT_W = A4_W - 2 * MARGIN;

  // Paleta
  const accent = readAccent?.() || '#3f78ff';     // azul marca
  const okFill = '#e8f6ee', okBorder = '#2e7d32'; // verde suave / borde
  const badFill = '#fdeaea', badBorder = '#c62828'; // rojo suave / borde
  const grayLine = 230;

  // Helpers tipográficos
  const setTitle = () => { doc.setFont('helvetica', 'bold'); doc.setFontSize(18); };
  const setH = () => { doc.setFont('helvetica', 'bold'); doc.setFontSize(13); };
  const setSub = () => { doc.setFont('helvetica', 'normal'); doc.setFontSize(11); };
  const setBody = () => { doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); };
  const setSmall = () => { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); };

  // ----------------- Encabezado con banda -----------------
  const headerH = 24;
  doc.setFillColor(accent);
  doc.rect(0, 0, A4_W, headerH, 'F');

  // Marca plataforma (grande)
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(PLATFORM, MARGIN, 15);

  // Título del reporte (blanco)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text('Reporte de Examen — Cálculo', MARGIN, 21.2);

  // Fecha (alineada a la derecha, dentro de la banda)
  const dateStr = nowStr();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const dateW = doc.getTextWidth(dateStr);
  doc.text(dateStr, A4_W - MARGIN - dateW, 12);

  // ----------------- Badge de puntaje (debajo de la banda) -----------------
  const ok = ex.ok || 0, bad = ex.bad || 0, tot = Math.max(1, ok + bad);
  const score = Math.round((100 * ok) / tot);

  // Meta (nombre / tema / nivel)
  let y = headerH + 10;
  setSub(); doc.setTextColor(0);
  doc.text(`Estudiante: ${studentName}`, MARGIN, y); y += 6;
  doc.text(`Tema: ${ex.tema} · Nivel: ${ex.nivel}`, MARGIN, y);

  // Badge a la derecha, alineado con la línea inferior del meta, sin solapar fecha
  drawScoreBadge(doc, {
    x: A4_W - MARGIN - 25,
    y: headerH + 8,
    r: 16,
    score,
    ring: accent
  });

  y += 10;

  // ----------------- Panel de barras (overview) -----------------
  y = drawOverviewBars(doc, {
    x: MARGIN, y: y, width: CONTENT_W, ok, bad, score, accent, okColor: okBorder, badColor: badBorder
  }) + 10;

  // Línea divisoria suave
  doc.setDrawColor(grayLine);
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  doc.setDrawColor(0);
  y += 10;

  

  // ----------------- Listado de reactivos en tarjetas -----------------
const maxY = A4_H - 18; // deja espacio para el footer
const answers = Array.isArray(ex.answers) ? ex.answers : [];


// --- Verificador QR en la página 1 (Nombre + Tema + Nivel + Puntaje) ---
try {
  const verifier = `${studentName} | ${ex.tema} | ${ex.nivel} | Puntaje: ${score}%`;
  const qrDataUrl = await makeQRDataURL(verifier, 220); // 220 px

  const pageCount = doc.getNumberOfPages();
  doc.setPage(1);

  const qrSize = 26;                         // mm
  const footerY = A4_H - 9.5;
  const qrX = A4_W - MARGIN - qrSize;
  const qrY = footerY - 4.5 - qrSize - 3;

  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text('Verificador QR', qrX, qrY - 2);
  doc.setTextColor(0);

  doc.setPage(pageCount);
} catch (e) {
  console.warn('No se pudo generar el QR del verificador:', e);
}





































  // ----------------- Footer en todas las páginas -----------------
  applyFooterAllPages(doc, {
    leftText: `Estudiante: ${studentName}`,
    rightText: nowStr()
  });

  // Guardar
  doc.save('examen_reporte.pdf');

  // ============================ Helpers ============================

  function drawScoreBadge(doc, { x, y, r, score, ring }) {
    doc.setDrawColor(ring);
    doc.setFillColor(255);
    doc.setLineWidth(1.2);
    doc.circle(x, y, r, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    const s = `${score}%`;
    const tw = doc.getTextWidth(s);
    doc.setTextColor(0);
    doc.text(s, x - tw / 2, y + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const lab = 'Puntaje';
    const lw = doc.getTextWidth(lab);
    doc.text(lab, x - lw / 2, y + r + 6);
  }

  // Barras iniciales (aciertos, fallos, puntaje)
  function drawOverviewBars(doc, { x, y, width, ok, bad, score, accent, okColor, badColor }) {
    const H = 48; // alto del panel
    const barH = 6, gap = 6;
    const labelY = y + 6;
    const left = x, right = x + width;

    // Caja del panel
    doc.setDrawColor(235);
    doc.roundedRect(left, y, width, H, 2, 2, 'S');

    // Etiqueta
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('Resumen de desempeño', left + 5, labelY);

    const barsX = left + 5;
    let barsY = y + 12;

    // Aciertos
    drawBar('Aciertos', ok, ok + bad, okColor);

    // Fallos
    drawBar('Fallos', bad, ok + bad, badColor);

    // Puntaje (sobre 100)
    drawBar('Puntaje', score, 100, accent);

    return y + H;

    function drawBar(name, val, base, color) {
      // etiqueta y valor
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
      const valTxt = name === 'Puntaje' ? `${val}%` : `${val}/${base}`;
      doc.text(name, barsX, barsY + 4.2);
      const vtW = doc.getTextWidth(valTxt);
      doc.text(valTxt, right - 5 - vtW, barsY + 4.2);

      // barra
      const trackX = barsX + 35, trackW = right - 5 - trackX - (vtW + 2);
      doc.setDrawColor(220);
      doc.setFillColor(245);
      doc.setLineWidth(0.3);
      doc.roundedRect(trackX, barsY, trackW, barH, 1.5, 1.5, 'FD');

      const ratio = base > 0 ? Math.max(0, Math.min(1, val / base)) : 0;
      const fillW = Math.max(1.5, trackW * ratio);
      doc.setFillColor(color);
      doc.roundedRect(trackX, barsY, fillW, barH, 1.5, 1.5, 'F');

      barsY += barH + gap;
    }
  }

  function applyFooterAllPages(doc, { leftText, rightText }) {
    const pageCount = doc.getNumberOfPages();
    const footerY = A4_H - 9.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80);

    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setDrawColor(230);
      doc.line(MARGIN, footerY - 4.5, A4_W - MARGIN, footerY - 4.5);
      doc.setDrawColor(0);

      doc.text(leftText, MARGIN, footerY);

      const mid = `Página ${p} de ${pageCount}`;
      const midW = doc.getTextWidth(mid);
      doc.text(mid, (A4_W - midW) / 2, footerY);

      const rtW = doc.getTextWidth(rightText);
      doc.text(rightText, A4_W - MARGIN - rtW, footerY);
    }
    doc.setTextColor(0);
  }

  function nowStr() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }


  // Carga perezosa de la librería QR si no existe window.QRCode
async function ensureQRLib() {
  if (window.QRCode) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar qrcode.min.js'));
    document.head.appendChild(s);
  });
}

// Genera un DataURL PNG del QR (para insertarlo con doc.addImage)
async function makeQRDataURL(text, sizePx = 220) {
  await ensureQRLib();

  // contenedor fuera de pantalla para que no afecte el layout
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  document.body.appendChild(host);

  // qrcodejs dibuja <canvas> o <img> dentro del contenedor
  const tmp = document.createElement('div');
  host.appendChild(tmp);

  const qr = new QRCode(tmp, {
    text: String(text || ''),
    width: sizePx,
    height: sizePx,
    correctLevel: QRCode.CorrectLevel.M
  });

  // Espera un frame para que el canvas se pinte
  await new Promise(r => requestAnimationFrame(r));

  // Preferimos canvas para obtener toDataURL()
  let dataURL = '';
  const canvas = tmp.querySelector('canvas');
  if (canvas) {
    dataURL = canvas.toDataURL('image/png');
  } else {
    const img = tmp.querySelector('img');
    dataURL = img && img.src ? img.src : '';
  }

  document.body.removeChild(host);
  if (!dataURL) throw new Error('QR vacío');
  return dataURL;
}












}











  $('#btn-an-pdf').addEventListener('click', ()=>buildAnalyticsPDF({compact:false}));
  $('#btn-an-pdf-compact').addEventListener('click', ()=>buildAnalyticsPDF({compact:true}));
  $('#btn-ex-export-pdf-simple').addEventListener('click', buildExamPDF);

  // ========= Boot =========
  function boot(){
    bootTheme();
    ensureLogin();
    STATE.tema = $('#sel-tema').value;
    STATE.nivel = +$('#sel-nivel').value;
    newPractice();
    refreshAnalytics();
  }
  document.addEventListener('keydown',(e)=>{
    if(e.key==='Escape'){ const modal = $('#modal-login'); if(modal && modal.style.display==='flex'){ modal.style.display='none'; } }
  });
  boot();
})();
