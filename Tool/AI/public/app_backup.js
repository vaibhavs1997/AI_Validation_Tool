/**
 * Ticket-to-API Validation — Main Application
 *
 * Manages 4-section workspace:
 *   1. Requirements   -> 2. API Collection -> 3. Test Scenarios -> 4. Test Execution
 *
 * State management, collapsible sections, workflow progress,
 * scenario filtering, mapping visibility, execution readiness.
 */

const state = {
  view: "workspace",
  requirements: { source: "jira", ticket: null, loading: false, status: "empty" },
  collection: { contract: null, loading: false, status: "empty", warnings: [] },
  scenarios: { list: [], unusedEndpoints: [], loading: false, status: "empty", filters: { search: "", type: "all", mapping: "all" } },
  execution: { run: null, reportUrl: "", status: "not_ready" },
  history: { runs: [], tickets: [], totals: { runs: 0, tickets: 0, summary: {} } },
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function esc(v) { return String(v ?? "").replace(/&/g,"&").replace(/</g,"<").replace(/>/g,">").replace(/"/g,"""); }
function pretty(v) { return JSON.stringify(v, null, 2); }

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error || new Error("Unable to read file."));
    r.readAsText(file);
  });
}

function toast(msg, type) {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast " + (type || "info");
  el.hidden = false;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
}

function showModal(title, msg) {
  let modal = document.getElementById("errorModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "errorModal";
    modal.className = "modal-backdrop";
    modal.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><div class="modal-header"><h3 class="modal-title"></h3><button type="button" class="modal-close" aria-label="Close">x</button></div><div class="modal-body"></div><div class="modal-footer"><button type="button" class="primary modal-ok">OK</button></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.classList.contains("modal-close") || e.target.classList.contains("modal-ok")) {
        modal.classList.remove("show");
        modal.hidden = true;
      }
    });
  }
  modal.querySelector(".modal-title").textContent = title;
  modal.querySelector(".modal-body").textContent = msg;
  modal.hidden = false;
  modal.classList.add("show");
}

function compactText(v) { return String(v||"").replace(/\r/g,"").split("\n").map(l=>l.trim()).join("\n").replace(/\n{3,}/g,"\n\n").trim(); }
function cleanAc(item) { if(!item)return""; return String(item).replace(/^(?:\s*AC(?:'s)?s?|\s*ACs|\s*Acceptance Criteria)\s*[:\-\.\s]*/i,"").replace(/^[-*\s\d\.)]+/,"").trim(); }

function extractAC(text) {
  const norm = compactText(text);
  const lines = norm.split("\n");
  const idx = lines.findIndex(l=>/^(acceptance criteria|acceptance conditions|ac)\b/i.test(l.replace(/[:#-]/g,"").trim()));
  if(idx>=0){
    const res=[];
    for(let i=idx+1;i<lines.length;i++){
      let l=lines[i].trim();
      if(!l){if(res.length)break;continue}
      if(/^[A-Z][A-Za-z ]{2,}:$/.test(l)&&res.length)break;
      l=l.replace(/^[-*0-9.)\s]+/,"").trim();
      if(/[,;]\s*/.test(l)&&!/\bhttps?:\/\//i.test(l)){l.split(/[,;]\s*/).map(p=>p.trim()).filter(Boolean).forEach(p=>res.push(cleanAc(p)))}
      else res.push(cleanAc(l));
    }
    return res.filter(Boolean);
  }
  const m=norm.match(/\b(?:acceptance criteria|ac|acs)\b\s*[:\-]\s*(.+)$/i);
  if(m&&m[1])return m[1].split(/\s*(?:\d+\.|\d+\)|,|;|\n)\s*/).map(cleanAc).filter(Boolean);
  return lines.filter(l=>/^[-*]\s+/.test(l)||/^\d+[.)]\s+/.test(l)).map(cleanAc).filter(Boolean);
}

function normalizeTicket(v) {
  if(!v||typeof v!=="object")return v;
  if(v.fields){
    const f=v.fields||{},desc=typeof f.description==="string"?f.description:v.description||"";
    return{key:v.key||$("#jiraKey").value.trim()||"MANUAL-TICKET",summary:f.summary||v.summary||"Manual ticket",issueType:f.issuetype?.name||v.issueType||"Story",status:f.status?.name||v.status||"Manual",priority:f.priority?.name||v.priority||"",labels:f.labels||v.labels||[],description:desc,acceptanceCriteria:v.acceptanceCriteria||extractAC(desc),comments:v.comments||[],fetchedAt:new Date().toISOString()};
  }
  return v;
}

function ticketFromText(raw) {
  const desc=compactText(raw),first=desc.split("\n").find(Boolean)||"Manual API validation request";
  const kt=desc.match(/\b[A-Z][A-Z0-9]+-\d+\b/)?.[0];
  const key=$("#jiraKey").value.trim()||kt||"MANUAL-"+Date.now();
  return{key,summary:first.replace(/^summary[:\s-]*/i,"").slice(0,140),issueType:"Manual",status:"Draft",priority:"",labels:["manual-input"],description:desc,acceptanceCriteria:extractAC(desc),comments:[],fetchedAt:new Date().toISOString(),source:"plain_text"};
}

function parseTicketInput(raw) {
  const t=String(raw||"").trim();
  if(!t)throw new Error("Ticket description is empty.");
  try{return normalizeTicket(JSON.parse(t))}catch{return ticketFromText(t)}
}

async function api(path,opts){
  const r=await fetch(path,{...opts,headers:{"Content-Type":"application/json",...((opts||{}).headers||{})}});
  const d=await r.json();
  if(!r.ok)throw new Error(d.error||r.statusText);
  return d;
}

function formatDate(v){if(!v)return"";return new Intl.DateTimeFormat(undefined,{month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(v))}
function statusLabel(v){return String(v||"needs_review").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
function dominantStatus(s){if((s.failed||0)>0)return"failed";if((s.blocked||0)>0)return"blocked";if((s.needs_review||0)>0)return"needs_review";if((s.dry_run||0)>0&&(s.dry_run||0)>=(s.total||0))return"dry_run";if((s.passed||0)>0)return"passed";return"needs_review"}

function setActiveView(view,opts){
  const allowed=new Set(["workspace","history","results"]);
  const next=allowed.has(view)?view:"workspace";
  state.view=next;
  $$("[data-view-section]").forEach(s=>s.classList.toggle("view-hidden",s.dataset.viewSection!==next));
  $$("[data-view-trigger]").forEach(t=>t.classList.toggle("active",t.dataset.viewTrigger===next));
  if(!(opts||{}).skipHash){const h=next==="workspace"?"#workspace":`#${next}`;if(window.location.hash!==h)window.history.replaceState(null,"",h)}
}
function initialViewFromHash(){const h=window.location.hash.replace("#","");return["workspace","history","results"].includes(h)?h:"workspace"}

function computeSummary(){
  const req=state.requirements,coll=state.collection,sc=state.scenarios,ticket=req.ticket;
  const sm={requirements:{count:0,acs:0,gaps:0,status:req.status,key:ticket?.key||null,summary:ticket?.summary||null},collection:{ops:coll.contract?.endpoints?.length||0,status:coll.status,title:coll.contract?.title||null},tests:{total:sc.list.length,selected:$$(".scenario-check:checked").length,mapped:sc.list.filter(s=>s.endpointId&&!s.unlinked).length,reviewRequired:sc.list.filter(s=>s.matchNeedsReview||s.needsHumanReview).length,byType:{},byMapping:{high:0,medium:0,low:0,ambiguous:0,unmapped:0}},exec:{ready:0,blocked:0,status:"not_ready"}};
  for(const s of sc.list){
    const t=s.type||"scenario";sm.tests.byType[t]=(sm.tests.byType[t]||0)+1;
    const conf=s.matchConfidence||"";
    if(!s.endpointId||s.unlinked)sm.tests.byMapping.unmapped++;
    else if(s.matchNeedsReview||s.needsHumanReview)sm.tests.byMapping.ambiguous++;
    else if(conf==="HIGH")sm.tests.byMapping.high++;
    else if(conf==="MEDIUM")sm.tests.byMapping.medium++;
    else if(conf==="LOW")sm.tests.byMapping.low++;
    else sm.tests.byMapping.unmapped++;
  }
  sm.exec.ready=sc.list.filter(s=>s.endpointId&&!s.unlinked&&!s.matchNeedsReview&&!s.needsHumanReview).length;
  sm.exec.blocked=sc.list.filter(s=>!s.endpointId||s.unlinked||s.matchNeedsReview||s.needsHumanReview).length;
  sm.exec.status=sc.list.length===0?"not_ready":sm.exec.blocked>0?"partial":"ready";
  if(ticket){sm.requirements.count=ticket.acceptanceCriteria?.length||0;sm.requirements.acs=ticket.acceptanceCriteria?.length||0}
  return sm;
}

function renderWorkflow(){
  const sm=computeSummary();
  const steps=[
    {label:"Requirements",status:state.requirements.status==="loaded"?"completed":state.requirements.status==="empty"?"":state.requirements.status},
    {label:"API Collection",status:state.collection.status==="parsed"?"completed":state.collection.status==="empty"?"":state.collection.status},
    {label:"Test Scenarios",status:sm.tests.total>0?(sm.tests.reviewRequired>0?"warning":"completed"):""},
    {label:"Test Execution",status:sm.exec.status==="ready"?"completed":sm.exec.status==="partial"?"warning":""},
  ];
  let fa=false;
  for(const s of steps){if(!s.status&&!fa){s.status="active";fa=true}}
  if(!fa)steps[steps.length-1].status=steps[steps.length-1].status||"active";
  $("#workflowProgress").innerHTML=steps.map((s,i)=>{
    const conn=i<steps.length-1?`<span class="wf-connector ${s.status==="completed"?"completed":""}"></span>`:"";
    return`<span class="wf-step ${s.status}"><span class="wf-num">${s.status==="completed"?"✓":i+1}</span> ${s.label}</span>${conn}`;
  }).join("");
}

function renderMetrics(){
  const sm=computeSummary();
  $("#appMetrics").innerHTML=[
    ["Requirements",sm.requirements.count||"—",sm.requirements.key?`${sm.requirements.key}`:"Not loaded"],
    ["API Operations",sm.collection.ops||"—",sm.collection.title||"Not parsed"],
    ["Test Cases",sm.tests.total||"—",`${sm.tests.selected||0} selected, ${sm.tests.reviewRequired||0} review`],
    ["Ready",sm.exec.ready||"—",`${sm.exec.blocked||0} blocked`],
    ["Mapped",sm.tests.mapped||"—",`${sm.tests.byMapping.high||0} HIGH, ${sm.tests.byMapping.medium||0} MED`],
  ].map(([l,v,h])=>`<div class="metric-tile"><span>${esc(l)}</span><strong>${esc(v)}</strong><small>${esc(h)}</small></div>`).join("");
}

function renderReqSummary(){
  const ticket=state.requirements.ticket,panel=$("[data-section=requirements]");
  if(!ticket){
    state.requirements.status="empty";panel.classList.remove("collapsed");
    $("#reqStatusBadge").textContent="";$("#reqSummaryKey").textContent="—";$("#reqSummaryText").textContent="No requirements loaded";
    $("#reqSummaryCount").textContent="0";$("#reqSummaryAcCount").textContent="0";$("#reqGapChip").hidden=true;
    renderWorkflow();return;
  }
  state.requirements.status="loaded";panel.classList.add("collapsed");
  $("#reqStatusBadge").textContent="✓ Loaded";$("#reqStatusBadge").className="status-badge loaded";
  $("#reqSummaryKey").textContent=ticket.key||"—";$("#reqSummaryText").textContent=ticket.summary||"—";
  $("#reqSummaryCount").textContent=ticket.acceptanceCriteria?.length||"0";
  $("#reqSummaryAcCount").textContent=ticket.acceptanceCriteria?.length||"0";
  const gaps=ticket.requirementGaps?.length||0;
  if(gaps>0){$("#reqSummaryGapCount").textContent=gaps;$("#reqGapChip").hidden=false;$("#reqStatusBadge").textContent="⚠ "+gaps+" gaps";$("#reqStatusBadge").className="status-badge warning"}
  renderWorkflow();renderMetrics();
}

function renderCollSummary(){
  const c=state.collection.contract,panel=$("[data-section=collection]");
  if(!c){panel.classList.remove("collapsed");state.collection.status="empty";$("#collectionStatusBadge").textContent="";$("#collectionSummaryTitle").textContent="—";$("#collectionSummaryFormat").textContent="";$("#collectionSummaryCount").textContent="0";renderWorkflow();return}
  state.collection.status="parsed";panel.classList.add("collapsed");
  $("#collectionStatusBadge").textContent="✓ Parsed";$("#collectionStatusBadge").className="status-badge loaded";
  $("#collectionSummaryTitle").textContent=c.title||"API Collection";$("#collectionSummaryFormat").textContent=c.type?`Format: ${c.type}`:"";
  $("#collectionSummaryCount").textContent=c.endpoints?.length||0;
  const vars=c.variables?.length||0;$("#collectionVariableChip").hidden=vars===0;if(vars)$("#collectionSummaryVars").textContent=vars;
  const ha=c.auth?.type||c.security?.length>0;$("#collectionAuthChip").hidden=!ha;if(ha)$("#collectionSummaryAuth").textContent=c.auth?.type||"configured";
  const warns=state.collection.warnings.length;$("#collectionWarnChip").hidden=warns===0;
  if(warns){$("#collectionSummaryWarns").textContent=warns;$("#collectionStatusBadge").textContent="⚠ "+warns+" warnings";$("#collectionStatusBadge").className="status-badge warning"}
  const mc={};
  for(const ep of c.endpoints||[]){const m=ep.method||"UNKNOWN";mc[m]=(mc[m]||0)+1}
  $("#methodBreakdown").innerHTML=["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"].filter(m=>mc[m]).map(m=>`<span class="method-pill method-${m}">${m} ${mc[m]}</span>`).join("");
  renderWorkflow();renderMetrics();
}

function epLabel(s){return`${s.method||""} ${s.path||""}`.trim()}

function mapBadge(s){
  const c=s.matchConfidence||"",nr=s.matchNeedsReview||s.needsHumanReview,um=!s.endpointId||s.unlinked;
  if(um)return'<span class="map-badge unmapped">UNMAPPED</span>';
  if(nr)return'<span class="map-badge ambiguous">REVIEW</span>';
  if(c==="HIGH")return'<span class="map-badge high">HIGH</span>';
  if(c==="MEDIUM")return'<span class="map-badge medium">MEDIUM</span>';
  if(c==="LOW")return'<span class="map-badge low">LOW</span>';
  return'<span class="map-badge unmapped">UNMAPPED</span>';
}

function getMapLevel(s){
  if(!s.endpointId||s.unlinked)return"unmapped";
  if(s.matchNeedsReview||s.needsHumanReview)return"ambiguous";
  return(s.matchConfidence||"").toLowerCase()||"unmapped";
}

function renderScenarios(){
  const rows=$("#scenarioRows"),sc=state.scenarios;
  if(!sc.list.length){
    rows.innerHTML='<tr><td colspan="7" class="empty">No scenarios generated yet.</td></tr>';
    $("#scenariosSummary").hidden=true;$("#scenariosEmpty").hidden=false;$("#scenariosControls").hidden=true;$("#scenariosFilters").hidden=true;
    sc.status="empty";renderScBadge();return;
  }
  sc.status="generated";$("#scenariosEmpty").hidden=true;$("#scenariosControls").hidden=false;$("#scenariosFilters").hidden=false;
  renderScSummary();
  const f=sc.filters;let filtered=[...sc.list];
  if(f.search){const q=f.search.toLowerCase();filtered=filtered.filter(s=>(s.title||"").toLowerCase().includes(q)||(s.id||"").toLowerCase().includes(q))}
  if(f.type!=="all")filtered=filtered.filter(s=>(s.type||"scenario")===f.type);
  if(f.mapping!=="all")filtered=filtered.filter(s=>getMapLevel(s)===f.mapping);
  $("#scenarioFilterCount").textContent=`Showing ${filtered.length} of ${sc.list.length}`;
  populateTypeFilter(sc.list);
  rows.innerHTML=filtered.map(s=>{
    const ml=getMapLevel(s),api=s.endpointId?`${s.method||""} ${s.path||""}`.trim():"—";
    return`<tr><td><input class="scenario-check" type="checkbox" data-id="${esc(s.id)}" checked></td>
      <td><strong>${esc(s.title)}</strong><div class="muted">${esc(s.id)}${s.unlinked?" · unlinked":""}</div></td>
      <td><span class="pill">${esc(s.type||"scenario")}</span></td>
      <td>${esc(api)}</td>
      <td>${mapBadge(s)}</td>
      <td>${esc(s.priority||s.risk||"—")}</td>
      <td>${ml==="unmapped"||ml==="ambiguous"?`<span class="status needs_review">Review</span>`:`<span class="status passed">Ready</span>`}</td></tr>`;
  }).join("");
  $$(".scenario-check").forEach(input=>input.addEventListener("change",renderMetrics));
  updateScControls();renderScBadge();renderExecReadiness();renderMetrics();
}

function populateTypeFilter(ss){
  const sel=$("#scenarioTypeFilter"),cur=sel.value;
  const types=[...new Set(ss.map(s=>s.type||"scenario"))];
  sel.innerHTML='<option value="all">All types</option>'+types.map(t=>`<option value="${esc(t)}">${esc(t.charAt(0).toUpperCase()+t.slice(1))}</option>`).join("");
  sel.value=cur;
}

function renderScSummary(){
  const sc=state.scenarios,sm=computeSummary();
  $("#scenariosSummary").hidden=false;$("#scTotal").textContent=sc.list.length;
  for(const[t,c]of Object.entries(sm.tests.byType)){const el=$(`#sc${t.charAt(0).toUpperCase()+t.slice(1)}`);if(el)el.textContent=c}
  $("#mapHighCount").textContent=sm.tests.byMapping.high;$("#mapMediumCount").textContent=sm.tests.byMapping.medium;
  $("#mapLowCount").textContent=sm.tests.byMapping.low;$("#mapAmbigCount").textContent=sm.tests.byMapping.ambiguous;$("#mapUnmapCount").textContent=sm.tests.byMapping.unmapped;
}

function renderScBadge(){
  const b=$("#scenariosStatusBadge"),sc=state.scenarios;
  if(!sc.list.length){b.textContent="";return}
  const sm=computeSummary();
  if(sm.tests.reviewRequired>0){b.textContent="⚠ "+sm.tests.reviewRequired+" review";b.className="status-badge warning"}
  else{b.textContent="✓ "+sc.list.length+" tests";b.className="status-badge loaded"}
}

function updateScControls(){const h=state.scenarios.list.length>0;$("#selectAllScenariosBtn").disabled=!h;$("#deselectAllScenariosBtn").disabled=!h;$("#downloadScenariosBtn").disabled=!h;$("#exportPostmanBtn").disabled=!h}
function setScSelection(ch){$$(".scenario-check").forEach(i=>{i.checked=ch});renderMetrics();updateScControls()}
function selectedScenarios(){const sel=new Set($$(".scenario-check:checked").map(i=>i.dataset.id));return state.scenarios.list.filter(s=>sel.has(String(s.id)))}

function renderExecReadiness(){
  const sm=computeSummary(),sc=state.scenarios;
  if(!sc.list.length){$("#execEmpty").hidden=false;$("#execContent").hidden=true;state.execution.status="not_ready";renderExecBadge();return}
  $("#execEmpty").hidden=true;$("#execContent").hidden=false;
  const ready=sm.exec.ready,blocked=sm.exec.blocked;
  const env=$("#envName").value.trim();setRI("readinessEnv",env,!!env);
  const url=$("#baseUrl").value.trim(),urlOk=/^https?:\/\/.+/i.test(url);setRI("readinessUrl",url||"Not set",urlOk,!url?"na":urlOk?"ready":"error");
  const at=$("#authType").value;setRI("readinessAuth",at==="none"?"None":at,true);
  setRI("readinessMappings",`${sm.tests.mapped}/${sm.tests.total} resolved`,sm.tests.mapped===sm.tests.total,sm.tests.mapped<sm.tests.total?"warning":"ready");
  setRI("readinessBlocked",`${blocked} blocked`,blocked===0,blocked>0?"warning":"ready");
  $("#readyCount").textContent=ready;$("#readyCountBtn").textContent=ready;$("#blockedCount").textContent=blocked;$("#viewBlockedBtn").hidden=blocked===0;
  state.execution.status=blocked>0?"partial":"ready";renderExecBadge();renderMetrics();
  $("#runAllBtn").disabled=ready===0;$("#executeBtn").disabled=ready===0;$("#runAllBtn").innerHTML=`Run <span id="readyCountBtn">${ready}</span> Ready Tests`;
}

function setRI(id,label,ok,cc){
  const el=document.getElementById(id);if(!el)return;
  el.querySelector(".readiness-value").textContent=label;
  const icon=el.querySelector(".readiness-check");
  if(ok){icon.textContent="✓";icon.className="readiness-check ready"}
  else if(cc==="na"){icon.textContent="○";icon.className="readiness-check na"}
  else{icon.textContent="⚠";icon.className="readiness-check warning"}
}

function renderExecBadge(){
  const b=$("#executionStatusBadge"),s=state.execution.status;
  if(s==="not_ready"){b.textContent="";return}
  if(s==="ready"){b.textContent="✓ Ready";b.className="status-badge loaded";return}
  if(s==="partial"){b.textContent="⚠ Partial";b.className="status-badge warning";return}
}

async function loadConfig(){
  const d=await api("/api/config/status");
  $("#serverState").textContent="Online";
  $("#configStatus").textContent=[d.jiraConfigured?"Jira connected":"Jira not configured",d.aiConfigured?`AI ready: ${d.aiModel}`:"AI optional",`Port ${d.port}`].join(" | ");
}

async function loadSampleTicket(opts){
  const t=await fetch("/sample-data/jira-ticket.json").then(r=>r.json());
  state.requirements.ticket=t;state.requirements.source="jira";
  $("#jiraKey").value=t.key||"";$("#ticketJson").value=pretty(t);renderReqSummary();
  if(!(opts||{}).silent)toast("Sample ticket loaded.");
}

async function fetchJiraTicket(){
  const key=$("#jiraKey").value.trim();if(!key)return toast("Enter a ticket key.");
  state.requirements.loading=true;
  try{const d=await api("/api/jira/ticket",{method:"POST",body:JSON.stringify({issueKey:key})});state.requirements.ticket=d.ticket;state.requirements.source="jira";$("#ticketJson").value=pretty(d.ticket);renderReqSummary();toast(`Fetched ${d.ticket.key}.`)}
  catch(err){toast(`Fetch failed: ${err.message}`,"error");state.requirements.status="error"}
  finally{state.requirements.loading=false}
}

function applyManualTicket(){
  const raw=$("#ticketJson").value.trim();if(!raw)return toast("Paste ticket JSON or description first.");
  try{const t=parseTicketInput(raw);state.requirements.ticket=t;state.requirements.source="manual";renderReqSummary();toast(`Loaded ${t.key}.`)}
  catch(err){toast(`Parse failed: ${err.message}`,"error")}
}

async function handleTicketUpload(e){
  const f=e.target.files?.[0];if(!f)return;
  $("#ticketJson").value=await readFileText(f);applyManualTicket();
}

async function loadSampleContract(opts){
  const raw=await fetch("/sample-data/openapi-refund.json").then(r=>r.json());
  $("#contractJson").value=pretty(raw);await parseContract({silent:true});
  if(raw.baseUrl)$("#baseUrl").value=raw.baseUrl;$("#dryRun").checked=false;
  if(!(opts||{}).silent)toast("Sample API collection loaded.");
}

async function parseContract(opts){
  const raw=$("#contractJson").value.trim();if(!raw)return toast("Paste an API collection first.");
  state.collection.loading=true;
  try{
    let p;try{p={contract:JSON.parse(raw),name:"ui-contract"}}catch{p={contract:raw,name:"ui-contract"}}
    const d=await api("/api/contracts/parse",{method:"POST",body:JSON.stringify(p)});
    state.collection.contract=d.contract;state.collection.warnings=[];state.collection.parsed=true;
    renderCollSummary();if(!(opts||{}).silent)toast(`Parsed ${d.contract.endpoints.length} operation(s).`);
  }catch(err){state.collection.status="error";toast(`Parse failed: ${err.message}`,"error")}
  finally{state.collection.loading=false}
}

async function handleContractUpload(e){
  const f=e.target.files?.[0];if(!f)return;
  $("#contractJson").value=await readFileText(f);await parseContract({silent:true});toast(`Loaded ${f.name}.`);
}

async function generateScenarios(){
  if(!state.requirements.ticket){
    const raw=$("#ticketJson").value.trim();
    if(raw){try{const t=parseTicketInput(raw);state.requirements.ticket=t;renderReqSummary()}catch{}}
  }
  if(!state.requirements.ticket){showModal("Requirements Required","Load a Jira ticket or paste requirement text first.");return}
  if(!state.collection.contract){
    const raw=$("#contractJson").value.trim();
    if(!raw){showModal("API Collection Required","Upload or paste an API collection (OpenAPI/Postman).");return}
    await parseContract({silent:true});if(!state.collection.contract)return
  }
  state.scenarios.loading=true;
  try{
    const d=await api("/api/scenarios/generate",{method:"POST",body:JSON.stringify({ticket:state.requirements.ticket,contract:state.collection.contract,useAi:$("#useAi").checked})});
    state.scenarios.list=d.scenarios||[];state.scenarios.unusedEndpoints=d.unusedEndpoints||[];
    renderWarnings(d.warnings||[]);renderScenarios();renderExecReadiness();
    toast(`Generated ${state.scenarios.list.length} scenario(s).`);
  }catch(err){toast(`Generation failed: ${err.message}`,"error")}
  finally{state.scenarios.loading=false}
}

function renderWarnings(w){$("#warnings").innerHTML=w.map(w=>`<div class="warning">${esc(w)}</div>`).join("")}

function csvCell(v){const s=String(v??"");return s.includes(",")||s.includes('"')||s.includes("\n")?`"${s.replace(/"/g,'"')}"`:s}
function csvLine(...c){return c.map(csvCell).join(",")}

function downloadScenarios(){
  const sc=state.scenarios.list;if(!sc.length)return toast("No scenarios to download.");
  const ticket=state.requirements.ticket,contract=state.collection.contract;
  const parts=[];
  parts.push("=== TEST PLAN ===");
  parts.push(csvLine("Generated At",new Date().toISOString()));
  parts.push(csvLine("Ticket Key",ticket?.key||"N/A"));parts.push(csvLine("Ticket Summary",ticket?.summary||"N/A"));parts.push(csvLine("Total",sc.length));
  const linked=sc.filter(s=>s.endpointId&&!s.unlinked).length,unlinked=sc.filter(s=>!s.endpointId||s.unlinked).length;
  parts.push(csvLine("Linked",linked,"Unlinked",unlinked));parts.push("");
  parts.push("=== ENDPOINT COVERAGE ===");parts.push(csvLine("Endpoint","Method","Path","TC Count","Status"));
  const used=new Map();for(const s of sc){if(s.endpointId&&!s.unlinked){const k=`${s.method} ${s.path}`;used.set(k,(used.get(k)||0)+1)}}
  if(contract?.endpoints){for(const ep of contract.endpoints){const k=`${ep.method} ${ep.path}`,c=used.get(k)||0;parts.push(csvLine(ep.operationId||k,ep.method,ep.path,c,c>0?"COVERED":"NOT COVERED"))}}
  parts.push("");parts.push("=== TEST CASES ===");
  parts.push(csvLine("TC ID","Title","Type","Target API","Method","Path","Expected Status","Mapping Confidence","Risk","Source AC"));
  for(const s of sc)parts.push(csvLine(s.id,s.title,s.type,epLabel(s),s.method||"",s.path||"",s.expectedStatus||"",s.matchConfidence||(s.endpointId?"mapped":"unmapped"),s.risk||"",s.sourceAc||""));
  const blob=new Blob(["\uFEFF"+parts.join("\n")],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");
  a.href=url;a.download=`scenarios-${(ticket?.key||"manual").toLowerCase()}.csv`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  toast(`Downloaded ${sc.length} scenarios.`);
}

function generatePostmanCollection(){
  const sc=state.scenarios.list;if(!sc.length)return toast("No scenarios to export.");
  const ticket=state.requirements.ticket,contract=state.collection.contract;
  const coll={info:{name:`${ticket?.key||"manual"} - API Tests`,version:"1.0.0",description:ticket?.summary||""},item:sc.filter(s=>s.endpointId&&s.method&&s.path).map(s=>({name:(s.title||"").slice(0,80),request:{method:s.method,header:[{key:"Content-Type",value:"application/json",type:"text"}],url:{raw:s.path,host:"",path:s.path.split("/").filter(Boolean)},body:{mode:"raw",raw:JSON.stringify(s.basePayload||{},null,2)}},response:[]}))};
  if(contract?.baseUrl){coll.info.schema="https://schema.getpostman.com/json/collection/v2.1.0/collection.json";coll.item.forEach(item=>{item.request.url.raw=`${contract.baseUrl}${item.request.url.raw}`})}
  const blob=new Blob([JSON.stringify(coll,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");
  a.href=url;a.download=`postman-${(ticket?.key||"manual").toLowerCase()}.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  toast(`Exported ${coll.item.length} requests.`);
}

function environmentPayload(){
  const at=$("#authType").value,auth={type:at};
  if(at==="bearer")auth.token=$("#authToken")?.value||"";
  if(at==="autoBearer"){auth.tokenUrl=$("#tokenUrl")?.value.trim()||"";auth.tokenMethod=$("#tokenMethod")?.value||"POST";auth.tokenHeaders=$("#tokenHeaders")?.value.trim()||"{}";auth.tokenBody=$("#tokenBody")?.value.trim()||"{}";auth.tokenPath=$("#tokenPath")?.value.trim()||"access_token"}
  if(at==="basic"){auth.username=$("#authUsername")?.value||"";auth.password=$("#authPassword")?.value||""}
  if(at==="custom"){auth.headerName=$("#authHeaderName")?.value||"";auth.headerValue=$("#authHeaderValue")?.value||""}
  return{name:$("#envName").value.trim()||"local",baseUrl:$("#baseUrl").value.trim(),dryRun:$("#dryRun").checked,auth};
}

async function runAll(){
  if(!state.requirements.ticket)await loadSampleTicket({silent:true});
  if(!state.collection.contract)await parseContract({silent:true});
  if(!state.collection.contract){showModal("Run Failed","No API collection loaded.");return}
  await generateScenarios();await new Promise(r=>setTimeout(r,100));
  if(!state.scenarios.list.length){showModal("Run Failed","No scenarios generated.");return}
  setScSelection(true);$("#dryRun").checked=false;
  const scenarios=state.scenarios.list;toast("Running all ready tests...");
  try{
    const d=await api("/api/runs/execute",{method:"POST",body:JSON.stringify({ticket:state.requirements.ticket,contract:state.collection.contract,scenarios,environment:environmentPayload()})});
    state.execution.run=d.run;state.execution.reportUrl=d.reportUrl;renderRun();await loadRunHistory({silent:true});
    setActiveView("results");$("#results").scrollIntoView({behavior:"smooth",block:"start"});
    toast(`Run complete: ${d.run.summary.passed} passed, ${d.run.summary.failed} failed`);
  }catch(err){toast(`Run failed: ${err.message}`,"error")}
}

async function executeSelected(){
  if(!state.requirements.ticket){showModal("No Requirements","Load requirements first.");return}
  if(!state.collection.contract){showModal("No API Collection","Parse an API collection first.");return}
  const scenarios=selectedScenarios();
  if(!scenarios.length){showModal("No Tests Selected","Select at least one test scenario to execute.");return}
  const envName=$("#envName").value.trim();if(!envName){showModal("Environment Required","Enter an environment name.");$("#envName").focus();return}
  const baseUrl=$("#baseUrl").value.trim();if(!baseUrl){showModal("Base URL Required","Enter a Base URL.");$("#baseUrl").focus();return}
  if(!/^https?:\/\/.+/i.test(baseUrl)){showModal("Invalid URL","Base URL must start with http:// or https://.");$("#baseUrl").focus();return}
  toast(`Running ${scenarios.length} test(s)...`);
  try{
    const d=await api("/api/runs/execute",{method:"POST",body:JSON.stringify({ticket:state.requirements.ticket,contract:state.collection.contract,scenarios,environment:environmentPayload()})});
    state.execution.run=d.run;state.execution.reportUrl=d.reportUrl;renderRun();await loadRunHistory({silent:true});
    setActiveView("results");toast(`Run stored: ${d.run.id}`);
  }catch(err){toast(`Run failed: ${err.message}`,"error")}
}

function renderRun(){
  const run=state.execution.run;if(!run)return;
  const s=run.summary||{};
  const stats=[["Total",s.total||0],["Passed",s.passed||0],["Failed",s.failed||0],["Blocked",s.blocked||0],["Review",s.needs_review||0],["Dry Run",s.dry_run||0]];
  const rt=(run.results||[]).map(r=>r.validation?.responseTimeMs).filter(Boolean);
  const avg=rt.length?Math.round(rt.reduce((a,b)=>a+b,0)/rt.length):0;
  if(avg>0)stats.push(["Avg Time",`${avg}ms`]);
  if(run.authStatus)stats.push(["Auth",statusLabel(run.authStatus.status)]);
  $("#runSummary").innerHTML=stats.map(([l,v])=>`<span class="stat-pill">${l} <strong>${v}</strong></span>`).join("");
  $("#reportLinks").innerHTML=`<a class="link-button" href="/api/runs/${encodeURIComponent(run.id)}" target="_blank" rel="noreferrer">JSON</a><a class="link-button" href="${state.execution.reportUrl||`/api/reports/${encodeURIComponent(run.id)}.html`}" target="_blank" rel="noreferrer">HTML report</a>`;
  $("#resultRows").innerHTML=(run.results||[]).map(r=>{
    const st=r.status,color=st==="passed"?"#238052":st==="failed"?"#b44236":st==="blocked"?"#8b6500":"#28699a";
    const rtime=r.validation?.responseTimeMs?`${r.validation.responseTimeMs}ms`:"—";
    return`<tr><td><strong>${esc(r.title)}</strong><div class="muted">${esc(r.scenarioId)}</div></td><td><span class="status ${esc(st)}">${esc(statusLabel(st))}</span></td><td><span style="font-weight:600;color:${color}">${r.response?.status||r.error||st}</span><div class="muted">⏱ ${rtime}</div></td><td><details><summary style="color:#28699a;font-weight:600">Request/Response</summary><pre>${esc(pretty({request:r.request,response:r.response}))}</pre></details></td></tr>`;
  }).join("");
}

async function loadRunHistory(opts){
  const d=await api("/api/runs");
  state.history=d;renderHistory();renderMetrics();
  if(!(opts||{}).silent)toast("Run history refreshed.");
}

function runMatches(run){
  const q=$("#historySearch").value.trim().toLowerCase(),s=$("#historyStatus").value,sv=dominantStatus(run.summary);
  const hay=[run.id,run.ticketKey,run.ticketSummary,run.environment,run.contractTitle,run.baseUrl].join(" ").toLowerCase();
  return(!q||hay.includes(q))&&(s==="all"||s===sv);
}

function renderHistory(){
  const all=state.history.runs||[],filtered=all.filter(runMatches);
  renderTicketGroups(filtered);renderHistoryRows(filtered);
}

function aggregateRuns(runs){
  const g=new Map();
  for(const run of runs){
    if(!g.has(run.ticketKey))g.set(run.ticketKey,{ticketKey:run.ticketKey,ticketSummary:run.ticketSummary,runCount:0,latestRunAt:run.createdAt,latestRunId:run.id,summary:{total:0,passed:0,failed:0,blocked:0,needs_review:0,dry_run:0}});
    const grp=g.get(run.ticketKey);grp.runCount++;
    if(run.createdAt>grp.latestRunAt){grp.latestRunAt=run.createdAt;grp.latestRunId=run.id;grp.ticketSummary=run.ticketSummary}
    for(const k of Object.keys(grp.summary))grp.summary[k]+=run.summary?.[k]||0;
  }
  return Array.from(g.values()).sort((a,b)=>b.latestRunAt.localeCompare(a.latestRunAt));
}

function renderTicketGroups(runs){
  const groups=aggregateRuns(runs).slice(0,4),target=$("#ticketGroups");
  if(!groups.length){target.innerHTML='<div class="empty">No matching ticket history.</div>';return}
  target.innerHTML=groups.map(g=>`<div class="ticket-row"><div><strong>${esc(g.ticketKey)}</strong><small>${g.runCount} run(s) | Latest ${formatDate(g.latestRunAt)}</small></div><div><div>${esc(g.ticketSummary||"Manual run")}</div><div class="status-stack"><span class="pill green">Passed ${g.summary.passed||0}</span><span class="pill">Total ${g.summary.total||0}</span><span class="pill">Failed ${g.summary.failed||0}</span></div></div><button type="button" data-load-run="${esc(g.latestRunId)}" class="load-btn">Latest</button></div>`).join("");
}

function renderHistoryRows(runs){
  const rows=$("#historyRows");
  if(!runs.length){rows.innerHTML='<tr><td colspan="6" class="empty">No matching run history.</td></tr>';return}
  rows.innerHTML=runs.map(run=>{
    const st=dominantStatus(run.summary);
    return`<tr><td><strong>${esc(run.ticketKey)}</strong><div class="muted">${esc(run.ticketSummary||"Manual run")}</div></td><td><strong>${esc(run.id)}</strong><div class="muted">${esc(run.contractTitle)}</div></td><td><span class="status ${esc(st)}">${esc(statusLabel(st))}</span><div class="muted">${esc(run.summary.total)} total, ${esc(run.summary.passed)} passed, ${esc(run.summary.failed)} failed</div></td><td>${esc(run.environment)}<div class="muted">${run.dryRun?"Dry run":esc(run.baseUrl||"No base URL")}</div></td><td>${esc(formatDate(run.createdAt))}</td><td><div class="button-row"><button type="button" data-load-run="${esc(run.id)}" class="load-btn">Load</button><a class="link-button" href="${esc(run.reportUrl)}" target="_blank" rel="noreferrer">Report</a><button type="button" data-delete-run="${esc(run.id)}" class="delete-btn">Delete</button></div></td></tr>`;
  }).join("");
}

async function loadRun(runId){
  const run=await api(`/api/runs/${encodeURIComponent(runId)}`);
  state.execution.run=run;state.execution.reportUrl=`/api/reports/${encodeURIComponent(run.id)}.html`;
  renderRun();setActiveView("results");$("#results").scrollIntoView({behavior:"smooth",block:"start"});toast(`Loaded run ${run.id}.`);
}

async function deleteRun(runId){
  if(!confirm(`Delete run ${runId}?`))return;
  await api(`/api/runs/${encodeURIComponent(runId)}`,{method:"DELETE"});toast(`Run ${runId} deleted.`);await loadRunHistory({silent:true});
}

function detectAuthEndpoint(contract){
  if(!contract)return null;
  const eps=contract.endpoints||[];
  return eps.find(ep=>/post/i.test(ep.method)&&/(token|login|auth|oauth|session|signin|sign-in)/i.test([ep.path,ep.summary,ep.operationId,ep.description].join(" ")))||eps.find(ep=>/(token|login|auth|oauth|session|signin|sign-in)/i.test([ep.path,ep.summary,ep.operationId,ep.description].join(" ")));
}

function sampleValueFromSchema(schema,fn){
  if(!schema||typeof schema!=="object")return null;
  if(schema.example!==undefined)return schema.example;
  if(schema.default!==undefined)return schema.default;
  if(Array.isArray(schema.enum)&&schema.enum.length)return schema.enum[0];
  const type=Array.isArray(schema.type)?schema.type[0]:schema.type;
  if(type==="object"||schema.properties)return Object.fromEntries(Object.entries(schema.properties||{}).map(([k,v])=>[k,sampleValueFromSchema(v,k)]));
  if(type==="array")return[sampleValueFromSchema(schema.items||{},fn)];
  if(type==="integer"||type==="number")return 1;
  if(type==="boolean")return true;
  return `sample-${fn}`;
}

function fillDetectedTokenEndpoint(opts){
  const ep=detectAuthEndpoint(state.collection.contract);
  if(!ep){toast("No auth endpoint detected in collection.");return}
  const oe=Boolean((opts||{}).onlyEmpty);
  const tu=$("#tokenUrl"),tm=$("#tokenMethod"),tb=$("#tokenBody"),th=$("#tokenHeaders"),tp=$("#tokenPath");
  if(tu&&(!oe||!tu.value))tu.value=ep.path||"";
  if(tm&&(!oe||!tm.value))tm.value=ep.method||"POST";
  if(tb&&(!oe||!tb.value))tb.value=pretty(sampleValueFromSchema(ep.requestSchema,"tokenRequest")||{});
  if(th&&(!oe||!th.value))th.value="{}";
  if(tp&&(!oe||!tp.value))tp.value="access_token";
}

function renderAuthFields(){
  const type=$("#authType").value,target=$("#authFields");
  if(type==="bearer"){target.innerHTML='<label>Token<input id="authToken" type="password" autocomplete="off"></label>'}
  else if(type==="autoBearer"){target.innerHTML='<div class="button-row auth-detect-row"><button id="detectAuthEndpointBtn" type="button" class="action-btn">Use detected token endpoint</button></div><label>Token URL<input id="tokenUrl" type="text" placeholder="/auth/token or https://auth.company.com/token"></label><label>Method<select id="tokenMethod"><option value="POST">POST</option><option value="GET">GET</option></select></label><label>Headers JSON<textarea id="tokenHeaders" class="mini-code" spellcheck="false">{}</textarea></label><label>Body JSON<textarea id="tokenBody" class="mini-code" spellcheck="false">{}</textarea></label><label>Token JSON path<input id="tokenPath" type="text" value="access_token" placeholder="access_token"></label>';$("#detectAuthEndpointBtn").addEventListener("click",()=>fillDetectedTokenEndpoint());fillDetectedTokenEndpoint({onlyEmpty:true})}
  else if(type==="basic"){target.innerHTML='<label>Username<input id="authUsername" type="text" autocomplete="off"></label><label>Password<input id="authPassword" type="password" autocomplete="off"></label>'}
  else if(type==="custom"){target.innerHTML='<label>Header name<input id="authHeaderName" type="text" placeholder="X-API-Key"></label><label>Header value<input id="authHeaderValue" type="password" autocomplete="off"></label>'}
  else target.innerHTML="";
}

function toggleTheme(){
  const cur=document.documentElement.getAttribute("data-theme")||"light",next=cur==="light"?"dark":"light";
  document.documentElement.setAttribute("data-theme",next);localStorage.setItem("theme",next);$("#themeToggle").textContent=next==="dark"?"☀️":"🌙";
}
function initTheme(){const cur=document.documentElement.getAttribute("data-theme")||"light";$("#themeToggle").textContent=cur==="dark"?"☀️":"🌙"}

function bindEvents(){
  $$("[data-view-trigger]").forEach(t=>{t.addEventListener("click",e=>{e.preventDefault();setActiveView(t.dataset.viewTrigger);if(t.dataset.viewTrigger==="history")loadRunHistory({silent:true}).catch(err=>toast(err.message))})});
  // Collapsible sections
  $$("[data-toggle-section]").forEach(head=>{head.addEventListener("click",e=>{if(e.target.closest("button")||e.target.closest(".expand-toggle"))return;const panel=head.closest(".panel");panel.classList.toggle("collapsed");const tg=panel.querySelector(".expand-toggle");if(tg)tg.textContent=panel.classList.contains("collapsed")?"+":"−"})});
  $$(".expand-toggle").forEach(btn=>{btn.addEventListener("click",e=>{e.stopPropagation();const panel=btn.closest(".panel");panel.classList.toggle("collapsed");btn.textContent=panel.classList.contains("collapsed")?"+":"−"})});
  // Source chips
  $$(".source-chip").forEach(chip=>{chip.addEventListener("click",()=>{$$(".source-chip").forEach(c=>c.classList.remove("active"));chip.classList.add("active");const src=chip.dataset.source;state.requirements.source=src;$$(".source-panel").forEach(p=>p.hidden=p.classList.contains(`source-${src}`)?false:true)})});
  // Requirements
  $("#loadSampleTicketBtn").addEventListener("click",()=>loadSampleTicket().catch(err=>toast(err.message)));
  $("#fetchJiraBtn").addEventListener("click",()=>fetchJiraTicket().catch(err=>toast(err.message)));
  $("#ticketFile").addEventListener("change",e=>handleTicketUpload(e).catch(err=>toast(err.message)));
  $("#applyManualTicketBtn").addEventListener("click",()=>applyManualTicket());
  $("#changeTicketBtn").addEventListener("click",()=>{const p=$("[data-section=requirements]");p.classList.remove("collapsed");p.querySelector(".expand-toggle").textContent="−"});
  $("#viewRawTicketBtn").addEventListener("click",()=>showModal("Raw Requirement Data",pretty(state.requirements.ticket)));
  $("#viewRequirementsBtn").addEventListener("click",()=>{const t=state.requirements.ticket;if(!t)return;const acs=(t.acceptanceCriteria||[]).map((ac,i)=>`${i+1}. ${ac}`).join("\n");showModal(`Requirements — ${t.key}`,(t.summary||"No summary")+"\n\nAcceptance Criteria:\n"+(acs||"None"))});
  // Collection
  $("#loadSampleContractBtn").addEventListener("click",()=>loadSampleContract().catch(err=>toast(err.message)));
  $("#parseContractBtn").addEventListener("click",()=>parseContract().catch(err=>toast(err.message)));
  $("#contractFile").addEventListener("change",e=>handleContractUpload(e).catch(err=>toast(err.message)));
  $("#changeContractBtn").addEventListener("click",()=>{const p=$("[data-section=collection]");p.classList.remove("collapsed");p.querySelector(".expand-toggle").textContent="−"});
  $("#viewRawContractBtn").addEventListener("click",()=>showModal("Raw API Collection",pretty(state.collection.contract)));
  $("#viewCatalogBtn").addEventListener("click",()=>{const c=state.collection.contract;if(!c||!c.endpoints){toast("No parsed collection available.");return}const cat=c.endpoints.map((ep,i)=>`${i+1}. ${ep.method} ${ep.path}\n   ${ep.operationId||ep.summary||""}\n   Tags: ${(ep.tags||[]).join(", ")||"—"}\n   Fields: ${ep.requestSchema?Object.keys(ep.requestSchema.properties||{}).join(", "):"—"}`).join("\n\n");showModal(`API Catalog — ${c.endpoints.length} operations`,cat)});
  // Scenarios
  $("#generateBtn").addEventListener("click",()=>generateScenarios().catch(err=>toast(err.message)));
  $("#selectAllScenariosBtn").addEventListener("click",()=>setScSelection(true));
  $("#deselectAllScenariosBtn").addEventListener("click",()=>setScSelection(false));
  $("#downloadScenariosBtn").addEventListener("click",()=>downloadScenarios());
  $("#exportPostmanBtn").addEventListener("click",()=>generatePostmanCollection());
  // Filters
  $("#scenarioSearch").addEventListener("input",()=>{state.scenarios.filters.search=$("#scenarioSearch").value;renderScenarios()});
  $("#scenarioTypeFilter").addEventListener("change",()=>{state.scenarios.filters.type=$("#scenarioTypeFilter").value;renderScenarios()});
  $("#scenarioMapFilter").addEventListener("change",()=>{state.scenarios.filters.mapping=$("#scenarioMapFilter").value;renderScenarios()});
  // Execution
  $("#runAllBtn").addEventListener("click",()=>runAll().catch(err=>toast(err.message)));
  $("#executeBtn").addEventListener("click",()=>executeSelected().catch(err=>toast(err.message)));
  $("#refreshHistoryBtn").addEventListener("click",()=>loadRunHistory().catch(err=>toast(err.message)));
  $("#authType").addEventListener("change",renderAuthFields);
  $("#historySearch").addEventListener("input",renderHistory);
  $("#historyStatus").addEventListener("change",renderHistory);
  $("#themeToggle").addEventListener("click",toggleTheme);
  $("#history").addEventListener("click",e=>{
    const lb=e.target.closest("[data-load-run]");if(lb){loadRun(lb.dataset.loadRun).catch(err=>toast(err.message));return}
    const db=e.target.closest("[data-delete-run]");if(db)deleteRun(db.dataset.deleteRun).catch(err=>toast(err.message))
  });
  // Execution config changes trigger readiness
  $("#envName").addEventListener("input",renderExecReadiness);
  $("#baseUrl").addEventListener("input",renderExecReadiness);
  $("#authType").addEventListener("change",renderExecReadiness);
  $("#dryRun").addEventListener("change",renderExecReadiness);
  // View blocked
  $("#viewBlockedBtn").addEventListener("click",()=>{
    const blocked=state.scenarios.list.filter(s=>!s.endpointId||s.unlinked||s.matchNeedsReview||s.needsHumanReview);
    showModal(`Blocked Tests (${blocked.length})`,blocked.map(s=>`• ${s.id}: ${s.title} [${!s.endpointId||s.unlinked?"Unmapped":"Needs Review"}]`).join("\n"));
  });
}

async function boot(){
  bindEvents();initTheme();renderAuthFields();setActiveView(initialViewFromHash(),{skipHash:true});
  renderMetrics();await loadConfig();await loadRunHistory({silent:true});
  await loadSampleTicket({silent:true});await loadSampleContract({silent:true});
}

boot().catch(err=>{$("#serverState").textContent="Attention";toast(err.message)});
