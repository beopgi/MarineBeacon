let socket = null;
let map = null;
let marker = null;
let team = "";
let intervalId = null;

function startTracking() {
  team = document.getElementById("team-name").value.trim();
  const statusEl = document.getElementById("status");

  if (!team) {
    alert("팀명을 입력하세요.");
    return;
  }

  if (socket && socket.readyState === WebSocket.OPEN) return;

  // 지도 초기화
  if (!map) {
    map = L.map("map").setView([35.0, 128.0], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
  }

  // WebSocket 연결
  socket = new WebSocket("ws://14.63.214.199:8050");

  socket.onopen = () => {
    console.log("WebSocket 연결됨");
    statusEl.textContent = `추적 중 (${team})`;

    // 5초마다 위치 가져오기
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
            console.log("📡 위치 전송:", data);
          }

          const latlng = [data.lat, data.lon];
          if (!marker) {
            marker = L.marker(latlng).addTo(map).bindPopup(`팀: ${team}`).openPopup();
          } else {
            marker.setLatLng(latlng);
          }
          map.setView(latlng, map.getZoom());
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
    }, 5000); // 🔁 5초마다 실행
  };

  socket.onerror = err => {
    console.error("WebSocket 오류:", err);
    statusEl.textContent = "WebSocket 연결 실패";
    clearInterval(intervalId);
  };
}
