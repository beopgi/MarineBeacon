// server.js
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const mysql = require("mysql2");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, "public")));

// MySQL 연결 설정
const db = mysql.createConnection({
  host: "mysql-container",
  user: "root",
  password: "5625",
  database: "marine_db"
});

db.connect();

// WebSocket 처리
wss.on("connection", (ws) => {
  console.log("📡 WebSocket 연결됨");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      const { team, lat, lon, timestamp } = data;

      // ✅ MySQL에서 인식 가능한 DATETIME 포맷으로 변환
      const mysqlTimestamp = new Date(timestamp).toISOString().slice(0, 19).replace("T", " ");

      db.query(
        "INSERT INTO gps_logs (team_name, latitude, longitude, timestamp) VALUES (?, ?, ?, ?)",
        [team, lat, lon, mysqlTimestamp],
        (err) => {
          if (err) {
            console.error("DB 저장 오류:", err);
          } else {
            console.log("위치 저장됨:", team, lat, lon, mysqlTimestamp);
          }
        }
      );
    } catch (e) {
      console.error("메시지 파싱 실패:", e);
    }
  });
});

// 라우팅
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 서버 실행
server.listen(8050, () => {
  console.log("서버 실행 중: http://14.63.214.199:8050");
});
