// 1. D-Day 자동 계산 설정
const DATES = {
  baby: "2026-05-06",
  wedding: "2026-02-23",
  love: "2022-10-17"
};

function calcDays(dateStr) {
  const start = new Date(dateStr);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
  return diff.toLocaleString();
}

document.getElementById("dday-baby").textContent = `👶 아기 +${calcDays(DATES.baby)}일`;
document.getElementById("dday-wedding").textContent = `💍 결혼 +${calcDays(DATES.wedding)}일`;
document.getElementById("dday-love").textContent = `❤️ 연애 +${calcDays(DATES.love)}일`;

// 2. 실시간 날짜(요일 포함) 및 시계 업데이트
function updateDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = days[now.getDay()];

  const fullDateStr = `${year}년 ${month}월 ${date}일 (${dayName})`;
  document.getElementById("live-date").textContent = fullDateStr;
  
  const modalDateEl = document.getElementById("modal-weather-date");
  if (modalDateEl) {
    modalDateEl.textContent = `${fullDateStr} 기준`;
  }

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  document.getElementById("live-clock").textContent = `${hh}:${mm}`;
}
setInterval(updateDateTime, 1000);
updateDateTime();

// 3. Firebase 인증 & 보안 화이트리스트 로직
window.addEventListener('DOMContentLoaded', () => {
  const authInterval = setInterval(() => {
    if (window.firebaseAuth) {
      clearInterval(authInterval);
      const { auth, onAuthStateChanged, signOut } = window.firebaseAuth;

      onAuthStateChanged(auth, (user) => {
        const overlay = document.getElementById("auth-overlay");
        if (!user) {
          overlay.style.display = "flex";
        } else {
          if (!window.ALLOWED_EMAILS.includes(user.email)) {
            document.getElementById("login-error").textContent = `접근 권한이 없는 계정입니다 (${user.email}).`;
            signOut(auth);
            overlay.style.display = "flex";
          } else {
            overlay.style.display = "none";
            initFirestoreRealtime();
          }
        }
      });
    }
  }, 100);
});

function loginWithGoogle() {
  const { auth, provider, signInWithPopup } = window.firebaseAuth;
  signInWithPopup(auth, provider).catch((error) => {
    document.getElementById("login-error").textContent = "로그인 실패: " + error.message;
  });
}

function logout() {
  const { auth, signOut } = window.firebaseAuth;
  signOut(auth);
}

// 4. Firestore 실시간 DB 동기화
function initFirestoreRealtime() {
  const { db, collection, onSnapshot, query, orderBy } = window.firebaseDb;

  const todoQuery = query(collection(db, "todos"), orderBy("createdAt", "desc"));
  onSnapshot(todoQuery, (snapshot) => {
    const todoListEl = document.getElementById("todo-list");
    todoListEl.innerHTML = "";
    snapshot.forEach((documentSnap) => {
      const data = documentSnap.data();
      const id = documentSnap.id;
      const li = document.createElement("li");
      li.innerHTML = `
        <label>
          <input type="checkbox" ${data.isDone ? "checked" : ""} onclick="toggleTodo('${id}', ${!data.isDone})" />
          <span style="${data.isDone ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">${data.text}</span>
        </label>
        <button onclick="deleteTodo('${id}')" class="btn-sm" style="background:none; border:none; color:#adb5bd; cursor:pointer;">✕</button>
      `;
      todoListEl.appendChild(li);
    });
  });

  const noteQuery = query(collection(db, "notes"), orderBy("createdAt", "desc"));
  onSnapshot(noteQuery, (snapshot) => {
    const notesContainer = document.getElementById("notes-container");
    notesContainer.innerHTML = "";
    snapshot.forEach((documentSnap) => {
      const data = documentSnap.data();
      const id = documentSnap.id;
      const div = document.createElement("div");
      div.className = "note-item";
      div.innerHTML = `
        ${data.text}
        <div class="note-meta">${data.author || '가족'} · ${data.time || ''}</div>
        <button class="delete-btn" onclick="deleteNote('${id}')">삭제</button>
      `;
      notesContainer.appendChild(div);
    });
  });
}

window.addTodo = async function(e) {
  e.preventDefault();
  const input = document.getElementById("todo-input");
  if (!input.value.trim()) return;
  const { db, collection, addDoc } = window.firebaseDb;
  await addDoc(collection(db, "todos"), {
    text: input.value.trim(),
    isDone: false,
    createdAt: Date.now()
  });
  input.value = "";
};

window.toggleTodo = async function(id, isDone) {
  const { db, doc, updateDoc } = window.firebaseDb;
  await updateDoc(doc(db, "todos", id), { isDone: isDone });
};

window.deleteTodo = async function(id) {
  const { db, doc, deleteDoc } = window.firebaseDb;
  await deleteDoc(doc(db, "todos", id));
};

window.addNote = async function(e) {
  e.preventDefault();
  const input = document.getElementById("note-input");
  if (!input.value.trim()) return;
  const { db, collection, addDoc } = window.firebaseDb;
  const auth = window.firebaseAuth.auth;
  const user = auth.currentUser;
  const authorName = user ? user.displayName || user.email.split('@')[0] : "가족";
  const now = new Date();
  const dateTimeStr = `${now.getMonth()+1}/${now.getDate()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  
  await addDoc(collection(db, "notes"), {
    text: input.value.trim(),
    author: authorName,
    time: dateTimeStr,
    createdAt: Date.now()
  });
  input.value = "";
};

window.deleteNote = async function(id) {
  const { db, doc, deleteDoc } = window.firebaseDb;
  await deleteDoc(doc(db, "notes", id));
};

window.quickSave = async function(e) {
  e.preventDefault();
  const type = document.getElementById("quick-type").value;
  const text = document.getElementById("quick-text").value;
  if (!text.trim()) return;

  if (type === "todo") {
    const { db, collection, addDoc } = window.firebaseDb;
    await addDoc(collection(db, "todos"), { text: text.trim(), isDone: false, createdAt: Date.now() });
  } else {
    const { db, collection, addDoc } = window.firebaseDb;
    const auth = window.firebaseAuth.auth;
    const user = auth.currentUser;
    const authorName = user ? user.displayName || user.email.split('@')[0] : "가족";
    const now = new Date();
    const dateTimeStr = `${now.getMonth()+1}/${now.getDate()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    await addDoc(collection(db, "notes"), { text: text.trim(), author: authorName, time: dateTimeStr, createdAt: Date.now() });
  }
  document.getElementById("quick-text").value = "";
  closeModals();
};

// 5. Open-Meteo 실시간 날씨 & 대기오염 연동
const REGIONS = {
  seoul_gangnam: { name: "강남구", lat: 37.5172, lon: 127.0473 },
  seoul_gwangjin: { name: "광진구", lat: 37.5385, lon: 127.0823 },
  seoul_seongdong: { name: "성동구", lat: 37.5635, lon: 127.0365 }
};

async function fetchWeather(regionKey) {
  const reg = REGIONS[regionKey] || REGIONS.seoul_gangnam;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${reg.lat}&longitude=${reg.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code&hourly=temperature_2m,precipitation_probability,weather_code&timezone=Asia%2FSeoul`;
  const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${reg.lat}&longitude=${reg.lon}&current=pm10,pm2_5&timezone=Asia%2FSeoul`;

  try {
    const [resW, resA] = await Promise.all([fetch(url), fetch(airUrl)]);
    const dataW = await resW.json();
    const dataA = await resA.json();

    const currentTemp = Math.round(dataW.current.temperature_2m);
    const apparent = Math.round(dataW.current.apparent_temperature);
    const humid = dataW.current.relative_humidity_2m;
    const wcode = dataW.current.weather_code;

    const pm10Val = dataA.current ? Math.round(dataA.current.pm10) : 25;
    const pm25Val = dataA.current ? Math.round(dataA.current.pm2_5) : 12;

    let icon = "🌤️", desc = "구름 조금";
    if (wcode === 0) { icon = "☀️"; desc = "맑음"; }
    else if (wcode >= 1 && wcode <= 3) { icon = "⛅"; desc = "구름 많음"; }
    else if (wcode >= 51 && wcode <= 67) { icon = "🌧️"; desc = "비"; }
    else if (wcode >= 71 && wcode <= 77) { icon = "❄️"; desc = "눈"; }

    let pm10Status = "좋음", pm10Class = "good";
    if (pm10Val > 80) { pm10Status = "나쁨"; pm10Class = "bad"; }
    else if (pm10Val > 30) { pm10Status = "보통"; pm10Class = "moderate"; }

    let pm25Status = "좋음", pm25Class = "good";
    if (pm25Val > 35) { pm25Status = "나쁨"; pm25Class = "bad"; }
    else if (pm25Val > 15) { pm25Status = "보통"; pm25Class = "moderate"; }

    document.getElementById("header-weather-icon").textContent = icon;
    document.getElementById("header-weather-text").textContent = `${reg.name} ${currentTemp}°C · 미세먼지 ${pm10Status}`;

    document.getElementById("modal-w-icon").textContent = icon;
    document.getElementById("modal-w-temp").textContent = `${currentTemp}°C`;
    document.getElementById("modal-w-desc").textContent = `${desc} · 체감 ${apparent}°C (습도 ${humid}%)`;

    const pm10El = document.getElementById("modal-pm10");
    const pm25El = document.getElementById("modal-pm25");
    pm10El.textContent = `${pm10Val} ㎍/㎥ (${pm10Status})`;
    pm25El.textContent = `${pm25Val} ㎍/㎥ (${pm25Status})`;
    pm10El.className = `air-val ${pm10Class}`;
    pm25El.className = `air-val ${pm25Class}`;
    document.getElementById("modal-rain-humid").textContent = `${dataW.current.precipitation}mm · ${humid}%`;

    const now = new Date();
    const nowIdx = now.getHours();
    const hourlyList = document.getElementById("hourly-forecast-list");
    hourlyList.innerHTML = "";
    for (let i = 0; i < 6; i++) {
      const idx = nowIdx + i;
      const isNextDay = idx >= 24;
      const displayHour = idx % 24;
      const tStr = isNextDay && displayHour === 0 ? `내일 0시` : `${displayHour}시`;
      const tTemp = Math.round(dataW.hourly.temperature_2m[idx]);
      const tRain = dataW.hourly.precipitation_probability[idx] || 0;
      
      hourlyList.innerHTML += `
        <div class="hour-item">
          <div class="hour-time">${tStr}</div>
          <div class="hour-icon">${icon}</div>
          <div class="hour-temp">${tTemp}°</div>
          <div class="hour-rain">💧${tRain}%</div>
        </div>
      `;
    }

  } catch (err) {
    console.error("날씨 정보 로드 실패:", err);
  }
}

function changeWeatherRegion(regionKey) {
  localStorage.setItem("family_weather_region", regionKey);
  fetchWeather(regionKey);
}

const savedRegion = localStorage.getItem("family_weather_region") || "seoul_gangnam";
document.getElementById("region-select").value = savedRegion;
fetchWeather(savedRegion);

function openWeatherModal() {
  document.getElementById("weather-modal").classList.add("open");
}

// 6. UI 네비게이션 및 모달 제어
document.querySelectorAll("#desktop-nav .nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#desktop-nav .nav-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.getAttribute("data-target");
    document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
    document.getElementById(target).classList.add("active");
  });
});

window.switchTab = function(targetId, btnEl) {
  document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
  document.getElementById(targetId).classList.add("active");
  if (btnEl) {
    document.querySelectorAll(".mob-nav-btn").forEach(b => b.classList.remove("active"));
    btnEl.classList.add("active");
  }
};

window.openMenuModal = function() { document.getElementById("menu-modal").classList.add("open"); };
window.openQuickModal = function() { document.getElementById("quick-modal").classList.add("open"); };
window.closeModals = function() {
  document.getElementById("weather-modal").classList.remove("open");
  document.getElementById("menu-modal").classList.remove("open");
  document.getElementById("quick-modal").classList.remove("open");
};
window.switchTabFromModal = function(targetId) {
  window.switchTab(targetId, null);
  window.closeModals();
};
