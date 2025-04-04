# 🔧 FastAPI 백엔드 코드 (팀 대표 위치만 저장)
#Server.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pymysql
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MySQL 연결 함수
def get_cursor():
    conn = pymysql.connect(
        host="localhost",
        user="root",
        password="5625",
        database="marine_db",
        autocommit=True
    )
    return conn, conn.cursor()

teams = {}  # 팀별 접속자 관리

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    team_name = None

    try:
        while True:
            data = await websocket.receive_json()
            team_name = data.get("team")

            if not team_name:
                await websocket.send_json({"error": "팀명이 필요합니다."})
                continue

            # 팀 정보 등록 또는 갱신
            if team_name not in teams:
                teams[team_name] = {
                    "leader": websocket,
                    "members": [websocket]
                }
                await websocket.send_json({"role": "leader"})
            elif websocket not in teams[team_name]["members"]:
                teams[team_name]["members"].append(websocket)
                if teams[team_name]["leader"] is None:
                    teams[team_name]["leader"] = websocket
                    await websocket.send_json({"role": "leader"})
                else:
                    await websocket.send_json({"role": "member"})

            # 위치 저장은 leader만
            if teams[team_name]["leader"] == websocket:
                lat = data["lat"]
                lon = data["lon"]
                timestamp = data["timestamp"]

                conn, cursor = get_cursor()
                cursor.execute(
                    """
                    INSERT INTO gps_logs (team_name, latitude, longitude, timestamp)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (team_name, lat, lon, timestamp)
                )
                conn.close()

    except WebSocketDisconnect:
        print(f"[연결 종료] 팀: {team_name}")
        if team_name and team_name in teams:
            team = teams[team_name]
            if websocket in team["members"]:
                team["members"].remove(websocket)

                if team["leader"] == websocket:
                    if team["members"]:
                        team["leader"] = team["members"][0]
                        await team["leader"].send_json({"role": "leader"})
                    else:
                        del teams[team_name]

@app.get("/locations")
def get_locations():
    conn, cursor = get_cursor()
    cursor.execute("""
        SELECT g.team_name, g.latitude, g.longitude, g.timestamp
        FROM gps_logs g
        INNER JOIN (
            SELECT team_name, MAX(timestamp) AS max_time
            FROM gps_logs
            GROUP BY team_name
        ) latest
        ON g.team_name = latest.team_name AND g.timestamp = latest.max_time
    """)
    rows = cursor.fetchall()
    conn.close()
    return [
        {"team": row[0], "lat": row[1], "lon": row[2], "timestamp": row[3]} for row in rows
    ]

@app.get("/path/{team_name}")
def get_path(team_name: str):
    conn, cursor = get_cursor()
    cursor.execute(
        "SELECT latitude, longitude, timestamp FROM gps_logs WHERE team_name = %s ORDER BY timestamp",
        (team_name,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {"lat": row[0], "lon": row[1], "timestamp": row[2]} for row in rows
    ]

# 실행용
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)