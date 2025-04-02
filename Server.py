from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pymysql
from datetime import datetime
from typing import List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

conn = pymysql.connect(
    host="localhost",
    user="root",
    password="5625",
    database="marine_db",
    autocommit=True
)
cursor = conn.cursor()

class Location(BaseModel):
    lat: float
    lon: float
    timestamp: str

clients = {}

@app.websocket("/ws/{team_name}")
async def websocket_endpoint(websocket: WebSocket, team_name: str):
    await websocket.accept()
    clients[websocket] = team_name
    print(f"[연결됨] 팀명: {team_name}")
    try:
        while True:
            data = await websocket.receive_json()
            lat = data["lat"]
            lon = data["lon"]
            timestamp = data["timestamp"]

            print(f"[위치 수신] 팀명: {team_name}, 위도: {lat}, 경도: {lon}")
            cursor.execute(
                """
                INSERT INTO gps_logs (team_name, latitude, longitude, timestamp)
                VALUES (%s, %s, %s, %s)
                """,
                (team_name, lat, lon, timestamp)
            )
    except WebSocketDisconnect:
        print(f"[연결 종료] 팀명: {team_name}")
        del clients[websocket]

@app.get("/locations")
def get_locations():
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
    result = [
        {"team": row[0], "lat": row[1], "lon": row[2], "timestamp": row[3]} for row in rows
    ]
    return result

@app.get("/path/{team_name}")
def get_path(team_name: str):
    cursor.execute(
        "SELECT latitude, longitude FROM gps_logs WHERE team_name = %s ORDER BY timestamp",
        (team_name,)
    )
    rows = cursor.fetchall()
    return [[row[0], row[1]] for row in rows]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
