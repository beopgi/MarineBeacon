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
  host: "mysql-container", // 도커 네트워크 기반 주소
  user: "root",
  password: "5625",
  database: "marine_db",
  charset: "utf8mb4"
});

db.connect(err => {
  if (err) {
    console.error("MySQL 연결 실패:", err);
  } else {
    console.log("MySQL 연결 성공");
  }
});

// WebSocket 처리
wss.on("connection", (ws) => {
  console.log("클라이언트 WebSocket 연결됨");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      const { team, lat, lon, timestamp } = data;

      //한국 시간대로 변환
      const original = new Date(timestamp);
      const mysqlTimestamp = new Date(original.getTime() + 9 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      // DB 저장
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

      //데이터 브로드캐스트
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });

    } catch (e) {
      console.error("WebSocket 메시지 파싱 실패:", e);
    }
  });

  ws.on("close", () => {
    console.log("클라이언트 WebSocket 연결 종료");
  });
});

// index.html 직접 라우팅
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 서버 실행
server.listen(8000, () => {
  console.log("서버 실행 중: ws://14.63.214.199:8050");
});
