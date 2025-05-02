let socket = null;
let map = null;
let team = "";
let intervalId = null;
const markers = {};      // 팀별 마커 저장
const teamColors = {};   // 팀별 색상 저장

function getTeamColor(team) {
  if (!teamColors[team]) {
    const hue = (Object.keys(teamColors).length * 47) % 360;
    teamColors[team] = `hsl(${hue}, 85%, 50%)`;
  }
  return teamColors[team];
}

function updateTeamList(team, isMine) {
  const list = document.getElementById("team-list");
  if (document.getElementById(`team-${team}`)) return;

  const color = getTeamColor(team);
  const entry = document.createElement("span");
  entry.id = `team-${team}`;
  entry.style = `
    display: inline-block; padding: 4px 10px; margin: 2px;
    background: ${color}; color: white; border-radius: 5px;
    font-weight: ${isMine ? "bold" : "normal"}; cursor: pointer;
  `;
  entry.innerText = `${team}${isMine ? " (내 팀)" : ""}`;
  entry.onclick = () => {
    if (markers[team]) map.setView(markers[team].getLatLng(), 13);
  };
  list.appendChild(entry);
}

function startTracking() {
  team = document.getElementById("team-name").value.trim();
  const statusEl = document.getElementById("status");

  if (!team) {
    alert("팀명을 입력하세요.");
    return;
  }

  if (socket && socket.readyState === WebSocket.OPEN) return;

  if (!map) {
    map = L.map("map").setView([35.0, 128.0], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
  }

  updateTeamList(team, true); // 내 팀 리스트에 추가

  socket = new WebSocket("ws://14.63.214.199:8050");

  socket.onopen = () => {
    console.log("WebSocket 연결됨");
    statusEl.textContent = `추적 중 (${team})`;

    intervalId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        position => {
          const data = {
            team: team,
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            timestamp: new Date().toISOString()
          };

          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(data));
            console.log("위치 전송:", data);
          }
        },
        error => {
          console.error("위치 추적 오류:", error);

          let msg = "위치 정보를 가져올 수 없습니다.";
          if (error.code === error.PERMISSION_DENIED) {
            msg += "\n위치 권한이 차단되어 있습니다.";
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            msg += "\n위치 정보를 사용할 수 없습니다.";
          } else if (error.code === error.TIMEOUT) {
            msg += "\n위치 요청이 시간 초과되었습니다.";
          }

          alert(msg + "\n브라우저 위치 권한을 확인해주세요.");
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    }, 5000); // 5초마다 실행
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const { team: incomingTeam, lat, lon } = data;
      const latlng = [lat, lon];
      const color = getTeamColor(incomingTeam);

      updateTeamList(incomingTeam, incomingTeam === team);

      if (!markers[incomingTeam]) {
        markers[incomingTeam] = L.circleMarker(latlng, {
          radius: 10,
          color: color,
          fillColor: color,
          fillOpacity: 1
        }).addTo(map).bindPopup(`팀: ${incomingTeam}`);
      } else {
        markers[incomingTeam].setLatLng(latlng);
      }

      // 내 팀이면 지도 중심 이동
      if (incomingTeam === team) {
        map.setView(latlng, map.getZoom());
        markers[incomingTeam].openPopup();
      }

    } catch (e) {
      console.error("WebSocket 메시지 처리 오류:", e);
    }
  };

  socket.onerror = err => {
    console.error("WebSocket 오류:", err);
    statusEl.textContent = "WebSocket 연결 실패";
    clearInterval(intervalId);
  };
}
