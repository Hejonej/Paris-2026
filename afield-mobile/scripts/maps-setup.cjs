const http = require("node:http"),
  crypto = require("node:crypto");
const { readConfig, saveKey, computeRoute } = require("./maps-dev.cjs");
const origin = "http://127.0.0.1:8096",
  nonce = crypto.randomBytes(24).toString("hex");
let queries = 0;
const page = () =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Afield 개발용 지도 연결</title><style>body{font:16px system-ui;max-width:620px;margin:48px auto;padding:20px;color:#161616;background:#fafafa}input,select,button{font:inherit;box-sizing:border-box;width:100%;padding:14px;margin:8px 0 20px;border:1px solid #ddd;border-radius:8px}button{background:#161616;color:white;cursor:pointer}p{line-height:1.7;color:#555}a{color:#245bdb}.block{padding:24px 0;border-top:1px solid #ddd}#result{white-space:pre-wrap;line-height:1.7}</style><h1>개발용 지도 연결</h1><p>운영 Cloudflare와 별개로 맥북에서 Google 경로 조회를 확인해요. 키는 이 컴퓨터의 비공개 파일에만 저장하고 앱·GitHub·채팅으로 보내지 않아요.</p><p><a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">1. 별도 개발 프로젝트 만들기 ↗</a><br><a href="https://console.cloud.google.com/apis/library/routes.googleapis.com" target="_blank" rel="noreferrer">2. 개발 프로젝트에서 Routes API 설정 ↗</a><br><a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">3. 개발용 API 키 만들기 ↗</a></p><p>Google의 결제 계정 연결이 필요할 수 있어요. 비용과 사용량 한도는 Google 화면에서 확인하고 직접 설정하세요. 키의 API 제한은 Routes API로 설정하세요.</p><div class="block"><label>개발용 API 키</label><input id="key" type="password" autocomplete="off" placeholder="채팅 대신 여기에 붙여넣기"><button onclick="save()">이 맥북에 키 저장</button><p id="state">${readConfig().apiKey ? "키가 저장돼 있어요. 아래에서 실제 조회를 확인하세요." : "아직 키가 없어요. 위 Google 설정을 완료한 뒤 저장해 주세요."}</p></div><div class="block"><h2>주소로 실제 거리·시간 확인</h2><label>출발 주소</label><input id="from" placeholder="예: 숙소의 정확한 주소"><label>도착 주소</label><input id="to" placeholder="예: 방문할 가게의 정확한 주소"><select id="mode"><option value="walking">도보</option><option value="transit">대중교통</option><option value="driving">차</option></select><button onclick="check()">Google Maps에서 거리·시간 조회</button><div id="result"></div></div><p>이 화면의 조회가 성공하면 앱의 거리 기반 계획 연결을 이어서 검증할 수 있어요. 현재 앱의 AI 초안이 이미 실제 동선 최적화가 됐다는 뜻은 아니에요.</p><script>const nonce=${JSON.stringify(nonce)};async function send(path,data){const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...data,nonce})});const v=await r.json();if(!r.ok)throw Error(v.message);return v}async function save(){try{await send('/key',{key:document.getElementById('key').value});document.getElementById('key').value='';document.getElementById('state').textContent='키를 저장했어요. 키 값은 다시 표시하지 않아요.'}catch(e){document.getElementById('state').textContent=e.message}}async function check(){const el=document.getElementById('result');el.textContent='Google 경로 조회 중…';try{const r=await send('/test',{from:document.getElementById('from').value,to:document.getElementById('to').value,mode:document.getElementById('mode').value});el.textContent='Google Maps · '+Math.ceil(r.durationSeconds/60)+'분 · '+(r.distanceMeters/1000).toFixed(2)+'km\\n'+r.timeBasis+'\\n조회: '+r.retrievedAt}catch(e){el.textContent=e.message}}</script>`;
const server = http.createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  const json = (code, value) => {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(value));
  };
  if (req.headers.host !== "127.0.0.1:8096")
    return json(403, { message: "이 맥북의 로컬 주소에서만 열 수 있어요." });
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(page());
  }
  if (req.method !== "POST" || req.headers.origin !== origin)
    return json(403, { message: "로컬 설정 화면에서 다시 시도해 주세요." });
  try {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 16000) throw Error("입력 내용이 너무 커요.");
    }
    const data = JSON.parse(raw);
    if (data.nonce !== nonce)
      return json(403, { message: "설정 화면을 새로 열어 주세요." });
    if (req.url === "/key") {
      saveKey(data.key);
      return json(200, { configured: true });
    }
    if (req.url === "/test") {
      if (queries >= 20)
        return json(429, {
          message:
            "이번 설정 세션의 20회 조회 한도예요. 필요하면 설정 화면을 다시 실행해 주세요.",
        });
      queries++;
      return json(200, await computeRoute(data));
    }
    return json(404, { message: "설정 경로를 확인해 주세요." });
  } catch (e) {
    return json(400, {
      message: e instanceof Error ? e.message : "설정을 완료하지 못했어요.",
    });
  }
});
server.listen(8096, "127.0.0.1", () =>
  console.log("Afield 개발용 지도 설정: " + origin),
);
