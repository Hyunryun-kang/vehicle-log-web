/* eslint-disable */
import { useState, useEffect, useCallback, useRef } from "react";

const SHEET_ID = "1ZUs1qmEduNUthBjHAZJg4YiqzRPht_AsTP_CKjrHSBE";
const SA_EMAIL = "id-653@sharevehiclelog.iam.gserviceaccount.com";

const SA_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDIvAUbFsoktu5v
v0wNFrGSV03hMj0jAVWjAne/Vuuey9Fey4a/pe+8xi0zn3BIcETcXbD8yUIrA9QP
UpelM56kOWMlDuj8IXnEpqm4pHnhqH4kzkpNqxhu2xnRR3BPPheswsm2St4A3ZbP
jFDAHPZimZaDaUuS811Nn0PT4/UJ2T6IWevAEwT724/Juulx5FiRVn31GTKCl8k4
ysdI6J6FJzl1vYYaIPJKcEujGQJTijED/M6SSzVhQNijiPzzdgvTMOG0sHYeHMu8
Ptx+Mzmd2b4g4A27SXMlN7+i4Da9luGJIhw1IUd3ymjoe6VpajS1wjSon4YTZPip
NpISCOwzAgMBAAECggEAS93wKhRbczPmezq4YiwFEhPIHghwXeYXuUPqAVm3NO3A
pIzU0WNEcDsQg3XLqL0x8X3BslDYnsxUHjRvlyMi3tvHso5nlT+Lt7zr4Zrca+LU
RlHneGJlmiRaJiRTeMe1h/iY5zp1nKsjYC8ep/VqU8rLvcASragoR/mdV5zNFJqp
CxR5Pu7iQQmF6KaKELrhtRUId7TNXil1D/8QhUDTqQypwbTNRWupIR82iB/FXjue
V8AWhIkiLihSEziFHrUER1pg/jntpswrodWAkaOks/LIl3zvkN1r0fPVqcA4nSSc
pwAthTFwQVlkHv44samWt8orlsbk9soOZUlco+DNlQKBgQDsd+XrgAcVz/O2xgTo
M8icu59RXcoNfVWHKjEd4jAJbnaGN3HGXkCBnCbkWFMXL2ugEMqG2qbZ66s/HiuX
tfhU4nMufN+76EPMsVxjE1yNXsc57XQ2pDkbAxFSa/9yONDmce2YjVd+/UCp/KQT
1zDPfIJRemd0f6yZBwxn9eRu9QKBgQDZUIgheVQhJ17qfq5IO6IyTwNgMqalyHvj
9bjNQZp4rZ5KM7OdG74PLg7zXjNJYibmnYsb9NnpmkzsuDlLwuhuiwOn9OZ6sUYG
Iz0HJ3CfsXamQ1+c7NV/laKSrHqz7+Qi2sF6I1DoQbfiAW8iPZngZ/NjCKfTrAII
Ad88AMUlhwKBgQDDW16gy7mOxKlE451kNHvVOJAriX+G23fQXgQL+zTSZecXhTDC
wFUsftQGrA2hRvT0XUrkVDmqKa/lSkibYqORhS/BRTsVo5J3xkNcOr+or5eJ/OmY
xt3CuisSW9TDCbtT1uWCtaqGaDWG+giXt51EnUmQhL55mYz/M7qFHLknDQKBgH3b
yju4zSS2bJ5a6A0lnHaOlGHuc92oEzifY3xc9l3WD8rhzrC7FIQuJLKGaCWkFuuR
arOyR1Kn7s1alLRwGbWMBX4MtD9y1B9R4VJ3YR7b5N++PW3hLHVL8HAKPLZhxTr6
fvuB4KXjCeB2/CpUiv4QtkExDiHliPeiPeu+dm+ZAoGBANO/hVr4wWbvoz0za0bZ
bWxtz2dcK5YU/61pVHODplzoC/gnYGZf8yfQdjdCNX3RolfT5f9lGMqUsUlMpHdF
SDJqe0A4vroJiNRUX8j0Hp4+xA2U3BnVqN5OePOpNs1rpF153ap5DyRnc9UvMcnS
7sbO/mq0h9XEEIkxYtZb0Mvo
-----END PRIVATE KEY-----`;
// SA_EMAIL = service_account.json 의 "client_email" 값
// SA_PRIVATE_KEY = service_account.json 의 "private_key" 값 (\\n 을 실제 줄바꿈으로)

const VEHICLES = ["8971","3661","3622","7305","3531","3532","2135","2138"];
const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;
const STORAGE_USER = "vlw_user";
const STORAGE_SYNC = "vlw_sync_interval";

// ── 로컬 저장소 (React state 기반, 세션 유지) ──────────────────────
// React 아티팩트 환경에서는 localStorage 불가. 메모리 스토어로 대체.
const memStore = {};
function storageGet(key) { return memStore[key] || null; }
function storageSet(key, val) { memStore[key] = val; }
function getSavedUser() {
  const raw = storageGet(STORAGE_USER);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function saveUser(name, phone) { storageSet(STORAGE_USER, JSON.stringify({ name, phone })); }
function getSyncInterval() { return parseInt(storageGet(STORAGE_SYNC)) || 0; }
function setSyncInterval(min) { storageSet(STORAGE_SYNC, String(min)); }

// ── JWT + OAuth Token ───────────────────────────────────────────────
let cachedToken = null, tokenExpiresAt = 0;
async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60000) return cachedToken;
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const nowSec = Math.floor(now / 1000);
  const claims = btoa(JSON.stringify({ iss: SA_EMAIL, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", exp: nowSec + 3600, iat: nowSec }));
  const signingInput = header + "." + claims;
  const keyData = SA_PRIVATE_KEY.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey("pkcs8", keyBytes.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sigBytes = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signingInput));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const resp = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${header}.${claims}.${sig}` });
  if (!resp.ok) throw new Error(`토큰 발급 실패 (${resp.status})`);
  const data = await resp.json();
  cachedToken = data.access_token; tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken;
}

// ── Sheets API ──────────────────────────────────────────────────────
async function sheetsGet(range) {
  const t = await getAccessToken();
  const r = await fetch(`${BASE}/values/${encodeURIComponent(range)}`, { headers: { Authorization: `Bearer ${t}` } });
  if (!r.ok) throw new Error(`읽기 실패 (${r.status})`); return (await r.json()).values || [];
}
async function sheetsAppend(sn, row) {
  const t = await getAccessToken();
  const colEnd = row.length <= 3 ? "C" : "H";
  const r = await fetch(`${BASE}/values/${encodeURIComponent(sn+"!A:"+colEnd)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify({ values: [row] }) });
  if (!r.ok) throw new Error(`쓰기 실패 (${r.status})`);
  const d = await r.json(); const m = d.updates?.updatedRange?.match(/!A(\d+):/); return m ? parseInt(m[1]) : -1;
}
async function sheetsUpdate(sn, ri, updates) {
  const t = await getAccessToken();
  const data = updates.map(([c, v]) => ({ range: `${sn}!${c}${ri}`, values: [[v]] }));
  const r = await fetch(`${BASE}/values:batchUpdate`, { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }) });
  if (!r.ok) throw new Error(`업데이트 실패 (${r.status})`);
}
async function sheetsEnsureTab(v) {
  const t = await getAccessToken(); const name = `차량_${v}`;
  try { const m = await fetch(`${BASE}?fields=sheets.properties.title`, { headers: { Authorization: `Bearer ${t}` } }); const d = await m.json(); if ((d.sheets||[]).map(s=>s.properties.title).includes(name)) return; } catch {}
  try { await fetch(`${BASE}:batchUpdate`, { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify({ requests: [{ addSheet: { properties: { title: name } } }] }) });
    await fetch(`${BASE}/values/${encodeURIComponent(name+"!A1:H1")}?valueInputOption=RAW`, { method: "PUT", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify({ values: [["날짜","시작시각","종료시각","운행자","주행거리(km)","이용목적","최종주행거리(km)","기타"]] }) });
  } catch (e) { console.warn("탭:", e); }
}
async function ensureUsersTab() {
  const t = await getAccessToken();
  try {
    const m = await fetch(`${BASE}?fields=sheets.properties.title`, { headers: { Authorization: `Bearer ${t}` } });
    const d = await m.json();
    if ((d.sheets||[]).map(s=>s.properties.title).includes("Users")) return;
  } catch {}
  try {
    await fetch(`${BASE}:batchUpdate`, { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: "Users" } } }] }) });
    await fetch(`${BASE}/values/${encodeURIComponent("Users!A1:C1")}?valueInputOption=RAW`, {
      method: "PUT", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [["이름","휴대폰번호","등록일시"]] }) });
  } catch (e) { console.warn("Users 탭:", e); }
}

async function registerUserToSheet(name, phone) {
  try {
    await ensureUsersTab();
    // 중복 체크: 이름+번호 조합이 이미 있으면 skip
    const rows = await sheetsGet("Users!A:B");
    const exists = rows.slice(1).some(r => (r[0]||"") === name && (r[1]||"") === phone);
    if (exists) return;
    const now = nowKST();
    await sheetsAppend("Users", [name, phone, `${now.date} ${now.time}`]);
  } catch (e) { console.warn("사용자 시트 등록:", e); }
}

async function getLastOdometer(v) {
  try { const rows = await sheetsGet(`차량_${v}!G:G`); const vals = rows.slice(1).map(r=>parseFloat(r[0])).filter(v=>v>0); return vals.length>0?vals[vals.length-1]:null; } catch { return null; }
}
async function getRecentLogs(v, limit=30) {
  try { const rows = await sheetsGet(`차량_${v}!A:H`); if(rows.length<=1)return[];
    return rows.slice(1).reverse().slice(0,limit).map(r=>({ date:r[0]||"",start:r[1]||"",end:r[2]||"",driver:r[3]||"",dist:r[4]||"",purpose:r[5]||"",odometer:r[6]||"",note:r[7]||"" })); } catch { return []; }
}
async function fetchVehicleStatuses() {
  const t = await getAccessToken(); const st = {}; let tabs = [];
  try { const m = await fetch(`${BASE}?fields=sheets.properties.title`, { headers: { Authorization: `Bearer ${t}` } }); const d = await m.json(); tabs = (d.sheets||[]).map(s=>s.properties.title); } catch { return st; }
  for (const v of VEHICLES) { const name=`차량_${v}`; if(!tabs.includes(name))continue;
    try { const rows=await sheetsGet(`${name}!A:H`); if(rows.length<=1)continue; const last=rows[rows.length-1];
      if((last[7]||"").includes("운행중")&&!(last[2]||"").trim()) st[v]={driver:last[3]||"",startTime:last[1]||"",purpose:last[5]||""}; } catch {} }
  return st;
}
function nowKST() { const d=new Date(),k=new Date(d.getTime()+9*3600000); return{date:k.toISOString().slice(0,10),time:k.toISOString().slice(11,19),ms:d.getTime()}; }

// ── App ─────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState(() => getSavedUser() ? "select" : "register");
  const [user, setUser] = useState(() => getSavedUser());
  const [vehicle, setVehicle] = useState(VEHICLES[0]);
  const [purpose, setPurpose] = useState("");
  const [startInfo, setStartInfo] = useState(null);
  const [sheetRow, setSheetRow] = useState(-1);
  const [error, setError] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [syncIntervalMin, setSyncIntervalMin] = useState(() => getSyncInterval());
  const syncRef = useRef(null);

  const go = useCallback(s => { setError(null); setScreen(s); }, []);

  const handleRegister = (name, phone) => {
    saveUser(name, phone); setUser({ name, phone }); go("select");
    // 백그라운드로 시트에도 등록 (실패해도 앱 사용에 지장 없음)
    registerUserToSheet(name, phone).catch(() => {});
  };

  // 자동 동기화
  useEffect(() => {
    if (syncRef.current) clearInterval(syncRef.current);
    if (syncIntervalMin > 0) {
      syncRef.current = setInterval(() => {
        fetchVehicleStatuses().then(setStatuses).catch(() => {});
      }, syncIntervalMin * 60 * 1000);
    }
    return () => { if (syncRef.current) clearInterval(syncRef.current); };
  }, [syncIntervalMin]);

  return (
    <div style={{ maxWidth: 440, margin: "0 auto", fontFamily: "'Pretendard',system-ui,-apple-system,sans-serif", color: "#1a1a1a", minHeight: "100dvh", paddingBottom: 20 }}>
      {screen === "register" && <RegisterScreen onRegister={handleRegister} />}
      {screen === "select" && <SelectScreen v={vehicle} setV={setVehicle} go={go} statuses={statuses} setStatuses={setStatuses} user={user} syncMin={syncIntervalMin} />}
      {screen === "predepart" && <PreDepartScreen v={vehicle} user={user} purpose={purpose} setPurpose={setPurpose} setStartInfo={setStartInfo} setSheetRow={setSheetRow} go={go} err={error} setErr={setError} />}
      {screen === "active" && <ActiveScreen v={vehicle} driver={user?.name||""} purpose={purpose} start={startInfo} go={go} />}
      {screen === "finish" && <FinishScreen v={vehicle} driver={user?.name||""} purpose={purpose} start={startInfo} row={sheetRow} go={go} err={error} setErr={setError} />}
      {screen === "history" && <HistoryScreen v={vehicle} go={go} />}
      {screen === "settings" && <SettingsScreen user={user} setUser={setUser} syncMin={syncIntervalMin} setSyncMin={(m) => { setSyncIntervalMin(m); setSyncInterval(m); }} go={go} />}
    </div>
  );
}

// ── 0. 회원 등록 ────────────────────────────────────────────────────
function RegisterScreen({ onRegister }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const ok = name.trim().length > 0 && phone.trim().length > 0;
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "80vh" }}>
      <h1 style={{ fontSize: 24, fontWeight: 500, margin: "0 0 4px" }}>차량 운행일지</h1>
      <p style={{ fontSize: 13, color: "#888", margin: "0 0 32px" }}>사용자 등록</p>
      <Field label="이름" value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" autoFocus />
      <Field label="휴대폰 번호" value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" type="tel" />
      <Btn variant="primary" full onClick={() => onRegister(name.trim(), phone.trim())} disabled={!ok} style={{ marginTop: 20 }}>등록</Btn>
      <p style={{ fontSize: 12, color: "#aaa", marginTop: 12, textAlign: "center" }}>등록 정보는 이 기기에만 저장됩니다</p>
    </div>
  );
}

// ── 1. 차량 선택 ────────────────────────────────────────────────────
function SelectScreen({ v, setV, go, statuses, setStatuses, user, syncMin }) {
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState(null);
  const sync = async () => {
    setSyncing(true); setMsg(null);
    try { const st = await fetchVehicleStatuses(); setStatuses(st);
      let n=0; for(const ve of VEHICLES){if(await getLastOdometer(ve)!==null)n++;} setMsg({ok:true,text:`동기화 완료 · ${n}대 주행거리 · ${Object.keys(st).length}대 운행중`});
    } catch(e){setMsg({ok:false,text:`실패: ${e.message}`});} setSyncing(false);
  };
  useEffect(()=>{fetchVehicleStatuses().then(setStatuses).catch(()=>{});},[]);
  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>차량 운행일지</h1>
        <Btn variant="text" onClick={() => go("settings")} style={{ fontSize: 13 }}>설정</Btn>
      </div>
      <p style={{ fontSize: 13, color: "#888", margin: "0 0 4px" }}>{user?.name}님{syncMin > 0 ? ` · 자동 동기화 ${syncMin}분` : ""}</p>
      <p style={{ fontSize: 12, color: "#aaa", margin: "0 0 16px" }}>웹 버전</p>

      <Box><div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1 }}><p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>구글 시트 동기화</p><p style={{ fontSize: 12, color: "#888", margin: 0 }}>주행거리 + 운행 현황 갱신</p></div>
        <Btn variant="tonal" onClick={sync} disabled={syncing}>{syncing ? "..." : "동기화"}</Btn>
      </div>{msg && <Toast ok={msg.ok} text={msg.text} onClose={() => setMsg(null)} />}</Box>

      <p style={{ fontSize: 15, fontWeight: 500, margin: "20px 0 8px" }}>차량 선택</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {VEHICLES.map(ve => {
          const active=statuses[ve]; const isSel=ve===v;
          let bg="transparent",border="0.5px solid #ddd",color="inherit";
          if(isSel){bg="#534AB7";border="none";color="#fff";}
          else if(active){bg="#EEEDFE";border="2px solid #534AB7";color="#3C3489";}
          return (<button key={ve} onClick={()=>setV(ve)} style={{padding:"10px 6px",fontSize:14,fontWeight:isSel||active?500:400,borderRadius:12,border,background:bg,color,cursor:"pointer",textAlign:"center"}}>
            <div>차량 {ve}</div>
            {active&&!isSel&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,marginTop:4}}><span style={{width:6,height:6,background:"#534AB7",borderRadius:"50%",flexShrink:0}}/><span style={{fontSize:10,color:"#3C3489"}}>{active.driver} · {active.startTime?.slice(0,5)}~</span></div>}
            {!active&&!isSel&&<div style={{fontSize:10,color:"#aaa",marginTop:3}}>비어있음</div>}
            {isSel&&active&&<div style={{fontSize:10,color:"rgba(255,255,255,0.8)",marginTop:3}}>{active.driver} 운행중</div>}
            {isSel&&!active&&<div style={{fontSize:10,color:"rgba(255,255,255,0.7)",marginTop:3}}>선택됨</div>}
          </button>);
        })}
      </div>
      <Btn variant="primary" full onClick={()=>go("predepart")} style={{marginTop:16}}>출발</Btn>
      <Btn variant="outline" full onClick={()=>go("history")} style={{marginTop:8}}>운행 기록</Btn>
    </div>
  );
}

// ── 2. 출발 전 입력 (이름 자동 채움) ────────────────────────────────
function PreDepartScreen({ v, user, purpose, setPurpose, setStartInfo, setSheetRow, go, err, setErr }) {
  const [busy, setBusy] = useState(false);
  const driverName = user?.name || "";
  const depart = async () => {
    setBusy(true); setErr(null); const info = nowKST(); setStartInfo(info);
    try { await sheetsEnsureTab(v); const idx = await sheetsAppend(`차량_${v}`, [info.date, info.time, "", driverName, "", purpose.trim()||"미기재", "", "운행중"]); setSheetRow(idx); }
    catch(e){console.warn("출발 기록:",e);setSheetRow(-1);} setBusy(false); go("active");
  };
  return (
    <div style={{ padding: 24 }}>
      <Box style={{ textAlign: "center", marginBottom: 24 }}>
        <p style={{ fontSize: 24, fontWeight: 500, margin: "0 0 4px" }}>차량 {v}</p>
        <p style={{ fontSize: 13, color: "#888", margin: 0 }}>출발 전 정보를 확인해주세요</p>
      </Box>
      <Box style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 12, color: "#888", margin: "0 0 2px" }}>운행자</p>
        <p style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{driverName}</p>
      </Box>
      <Field label="이용 목적" value={purpose} onChange={e => setPurpose(e.target.value)} autoFocus />
      {err && <p style={{ color: "#A32D2D", fontSize: 13 }}>{err}</p>}
      <Btn variant="primary" full onClick={depart} disabled={busy} style={{ marginTop: 16 }}>
        {busy ? "시트 기록 중..." : "출발 (운행 시작)"}
      </Btn>
      <Btn variant="text" onClick={() => go("select")} style={{ marginTop: 8 }}>← 차량 선택으로</Btn>
    </div>
  );
}

// ── 3. 운행 중 ──────────────────────────────────────────────────────
function ActiveScreen({ v, driver, purpose, start, go }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const el = now - (start?.ms || now);
  const h = Math.floor(el/3600000), m = Math.floor((el%3600000)/60000), s = Math.floor((el%60000)/1000);
  const fmt = h > 0 ? `${h}:${p2(m)}:${p2(s)}` : `${m}:${p2(s)}`;
  return (
    <div style={{ padding: 20, textAlign: "center" }}>
      <Pill>운행 중</Pill>
      <p style={{ fontSize: 14, color: "#888", marginTop: 16 }}>차량 {v} · {driver}</p>
      {purpose && <p style={{ fontSize: 13, color: "#888", margin: "2px 0 0" }}>{purpose}</p>}
      <p style={{ fontSize: 64, fontWeight: 500, margin: "36px 0 0", lineHeight: 1, letterSpacing: -1 }}>{fmt}</p>
      <p style={{ fontSize: 14, color: "#888", marginTop: 4 }}>경과 시간</p>
      <div style={{ display: "flex", gap: 8, margin: "32px 0" }}>
        <StatBox label="출발 시각" value={start?.time?.slice(0,5)||"--:--"} />
        <StatBox label="GPS 추적" value="미사용" sub="(웹 버전)" />
      </div>
      <Btn variant="danger" full onClick={() => go("finish")} style={{ padding: "15px 0" }}>종료 (운행 끝)</Btn>
    </div>
  );
}

// ── 4. 운행 완료 ────────────────────────────────────────────────────
function FinishScreen({ v, driver, purpose, start, row, go, err, setErr }) {
  const [lastOdo, setLastOdo] = useState(null);
  const [loadOdo, setLoadOdo] = useState(true);
  const [dist, setDist] = useState("");
  const [odo, setOdo] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const endRef = useRef(nowKST());
  useEffect(() => { (async () => { setLoadOdo(true); setLastOdo(await getLastOdometer(v)); setLoadOdo(false); })(); }, [v]);

  const distV = parseFloat(dist), odoV = parseFloat(odo);
  const distOk = !isNaN(distV) && distV > 0;
  const odoOk = !isNaN(odoV) && odoV > 0;
  const isFirstTrip = !loadOdo && lastOdo === null;

  // 첫 운행: 최종 주행거리만 있으면 저장 가능
  // 이후 운행: 주행거리 + 최종 주행거리 둘 다 필요
  const canSave = isFirstTrip
    ? (odoOk && !saving)
    : (distOk && odoOk && !saving);

  const save = async () => {
    setSaving(true); setErr(null); const end = endRef.current, purp = purpose || "미기재";
    const finalDist = isFirstTrip ? (dist || "0") : dist;
    try { const sn = `차량_${v}`;
      if (row > 0) { await sheetsUpdate(sn, row, [["C", end.time], ["E", finalDist], ["F", purp], ["G", odo], ["H", note || ""]]); }
      else { await sheetsEnsureTab(v); await sheetsAppend(sn, [start?.date||end.date, start?.time||"", end.time, driver, finalDist, purp, odo, note||""]); }
      go("select");
    } catch (e) { setErr(`저장 실패: ${e.message}`); } setSaving(false);
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 4px" }}>운행 기록 완료</h2>
      <p style={{ fontSize: 13, color: "#888", margin: "0 0 2px" }}>차량 {v} · {driver} · {purpose || "미기재"}</p>
      <p style={{ fontSize: 12, color: "#aaa", margin: "0 0 20px" }}>{start?.time?.slice(0, 5)} ~ {endRef.current.time.slice(0, 5)}</p>

      {/* 직전 최종 주행거리 참고 카드 */}
      <Box style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: "#888", margin: "0 0 4px" }}>직전 최종 주행거리 (시트 기준)</p>
        <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>
          {loadOdo ? "로딩 중..." : lastOdo !== null ? `${lastOdo.toLocaleString()} km` : "기록 없음 (첫 운행)"}
        </p>
      </Box>

      {/* 주행거리: 첫 운행이면 선택 입력, 이후는 필수 */}
      {isFirstTrip ? (
        <div style={{ marginBottom: 12 }}>
          <Field label="주행거리 (km) — 선택 (첫 운행이라 생략 가능)" value={dist} onChange={e => setDist(e.target.value)} type="number" placeholder="모르면 비워두세요" />
        </div>
      ) : (
        <div>
          <Field label="주행거리 (km) — 계기판 보고 직접 입력" value={dist} onChange={e => setDist(e.target.value)} type="number" placeholder="예: 23.1" autoFocus />
          {dist && !distOk && <p style={{ fontSize: 12, color: "#A32D2D", margin: "-8px 0 8px" }}>올바른 숫자를 입력하세요</p>}
        </div>
      )}

      <Field label="최종 주행거리 (km) — 계기판의 누적 값" value={odo} onChange={e => setOdo(e.target.value)} type="number"
        placeholder={lastOdo ? `직전: ${lastOdo.toLocaleString()}` : "계기판 값"} autoFocus={isFirstTrip} />
      {lastOdo && !odo && <p style={{ fontSize: 11, color: "#aaa", margin: "-6px 0 10px 2px" }}>직전 {lastOdo.toLocaleString()} km 참고해서 입력하세요</p>}
      {isFirstTrip && !odo && <p style={{ fontSize: 11, color: "#534AB7", margin: "-6px 0 10px 2px" }}>첫 운행입니다. 현재 계기판의 누적 km 를 입력해주세요</p>}

      <Field label="기타 (주유 필요, 엔진경고등 등)" value={note} onChange={e => setNote(e.target.value)} placeholder="없으면 비워두세요" />

      {err && <p style={{ color: "#A32D2D", fontSize: 13, margin: "8px 0" }}>{err}</p>}
      <Btn variant="primary" full onClick={save} disabled={!canSave} style={{ marginTop: 16 }}>{saving ? "저장 중..." : "저장"}</Btn>

      {!canSave && !saving && (
        <p style={{ fontSize: 12, color: "#A32D2D", marginTop: 6, textAlign: "center" }}>
          {!odoOk ? "최종 주행거리를 입력해주세요" : "주행거리를 입력해주세요"}
        </p>
      )}
    </div>
  );
}

// ── 5. 운행 기록 ────────────────────────────────────────────────────
function HistoryScreen({ v, go }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { setLoading(true); setLogs(await getRecentLogs(v)); setLoading(false); })(); }, [v]);
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Btn variant="text" onClick={() => go("select")}>← 돌아가기</Btn>
        <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>차량 {v} 운행 기록</p>
      </div>
      {loading && <p style={{ color: "#aaa" }}>로딩 중...</p>}
      {!loading && logs.length === 0 && <p style={{ color: "#aaa" }}>기록이 없습니다</p>}
      {logs.map((l, i) => (
        <Box key={i} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{l.driver || "미기재"}</span>
            {l.note === "운행중" && <Pill small>운행중</Pill>}
          </div>
          <p style={{ fontSize: 12, color: "#888", margin: "3px 0" }}>{l.date} {l.start}{l.end ? ` ~ ${l.end}` : ""}</p>
          {l.purpose && l.note !== "운행중" && <p style={{ fontSize: 13, margin: "2px 0" }}>{l.purpose}</p>}
          {l.dist && <p style={{ fontSize: 13, margin: "2px 0" }}>주행 {l.dist} km{l.odometer ? ` · 최종 ${l.odometer} km` : ""}</p>}
          {l.note && l.note !== "운행중" && <p style={{ fontSize: 12, color: "#888", margin: "2px 0" }}>기타: {l.note}</p>}
          {l.end && l.note !== "운행중" && <p style={{ fontSize: 11, color: "#3B6D11", marginTop: 3 }}>✓ 완료</p>}
          {!l.end && l.note === "운행중" && <p style={{ fontSize: 11, color: "#534AB7", marginTop: 3 }}>종료 대기 중</p>}
        </Box>
      ))}
    </div>
  );
}

// ── 6. 설정 ─────────────────────────────────────────────────────────
function SettingsScreen({ user, setUser, syncMin, setSyncMin, go }) {
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [interval, setInterval_] = useState(String(syncMin || ""));
  const saveProfile = () => {
    if (name.trim() && phone.trim()) {
      saveUser(name.trim(), phone.trim()); setUser({ name: name.trim(), phone: phone.trim() });
      registerUserToSheet(name.trim(), phone.trim()).catch(() => {});
    }
  };
  const saveSync = () => {
    const v = parseInt(interval) || 0;
    setSyncMin(v);
  };
  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <Btn variant="text" onClick={() => go("select")}>← 돌아가기</Btn>
        <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>설정</h2>
      </div>

      <p style={{ fontSize: 15, fontWeight: 500, margin: "0 0 8px" }}>내 정보</p>
      <Field label="이름" value={name} onChange={e => setName(e.target.value)} />
      <Field label="휴대폰 번호" value={phone} onChange={e => setPhone(e.target.value)} type="tel" />
      <Btn variant="primary" onClick={saveProfile} style={{ marginBottom: 24 }}>저장</Btn>

      <p style={{ fontSize: 15, fontWeight: 500, margin: "0 0 8px" }}>자동 동기화</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Field label="" value={interval} onChange={e => setInterval_(e.target.value)} type="number" placeholder="0" />
        <span style={{ fontSize: 13, color: "#888", whiteSpace: "nowrap" }}>분 (0 = 끄기)</span>
      </div>
      <Btn variant="primary" onClick={saveSync}>적용</Btn>
      <p style={{ fontSize: 12, color: "#aaa", marginTop: 8 }}>
        {syncMin > 0 ? `${syncMin}분마다 차량 현황을 자동 갱신합니다` : "자동 동기화가 꺼져 있습니다. 수동 동기화 버튼을 사용하세요."}
      </p>
    </div>
  );
}

// ── Shared ───────────────────────────────────────────────────────────
function Box({children,style}){return<div style={{background:"#f5f5f3",borderRadius:12,padding:"12px 16px",...style}}>{children}</div>}
function Field({label,...rest}){return(<div style={{marginBottom:12}}>{label&&<label style={{fontSize:12,color:"#888",display:"block",marginBottom:4}}>{label}</label>}<input {...rest} style={{width:"100%",padding:"11px 14px",fontSize:16,borderRadius:10,border:"0.5px solid #ddd",background:"#fff",color:"#1a1a1a",outline:"none",boxSizing:"border-box"}}/></div>)}
function Btn({variant="primary",full,children,style,...rest}){const base={fontSize:14,fontWeight:500,border:"none",borderRadius:10,cursor:"pointer",padding:"12px 16px",width:full?"100%":"auto",...style};const styles={primary:{...base,background:"#534AB7",color:"#fff"},danger:{...base,background:"#A32D2D",color:"#fff"},outline:{...base,background:"transparent",border:"0.5px solid #ccc",color:"inherit"},tonal:{...base,background:"#EEEDFE",color:"#534AB7",padding:"8px 16px"},text:{...base,background:"none",color:"#534AB7",padding:"4px 0",fontWeight:400}};return<button style={{...styles[variant],opacity:rest.disabled?0.45:1}} {...rest}>{children}</button>}
function Pill({children,small}){return<span style={{display:"inline-flex",alignItems:"center",gap:6,padding:small?"2px 10px":"6px 14px",background:"#EEEDFE",borderRadius:99,fontSize:small?11:13,fontWeight:500,color:"#534AB7"}}>{!small&&<span style={{width:8,height:8,background:"#534AB7",borderRadius:"50%"}}/>}{children}</span>}
function StatBox({label,value,sub}){return<div style={{flex:1,background:"#f5f5f3",borderRadius:10,padding:"10px 8px",textAlign:"center"}}><p style={{fontSize:16,fontWeight:500,margin:0}}>{value}</p><p style={{fontSize:11,color:"#888",margin:"2px 0 0"}}>{label}</p>{sub&&<p style={{fontSize:10,color:"#aaa",margin:0}}>{sub}</p>}</div>}
function Toast({ok,text,onClose}){return<div style={{display:"flex",alignItems:"center",gap:6,marginTop:8,padding:"7px 12px",borderRadius:8,fontSize:12,background:ok?"#EAF3DE":"#FCEBEB",color:ok?"#3B6D11":"#A32D2D"}}><span style={{flex:1}}>{text}</span><button onClick={onClose} style={{background:"none",border:"none",fontSize:11,color:"inherit",cursor:"pointer"}}>닫기</button></div>}
function p2(n){return String(n).padStart(2,"0")}