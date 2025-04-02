# pydeck 기반 GPS 실시간 위치 추적 시스템 (기존 구조 유지, 지도만 교체)

from dash import Dash, html, dcc, Input, Output, State
import dash_deck
import pydeck as pdk
import json
import websocket
import threading
import time

WEBSOCKET_SERVER = "ws://localhost:8000/ws"

initial_view = pdk.ViewState(
    latitude=35.0,
    longitude=128.0,
    zoom=7,
    pitch=0,
)

real_time_data = []

def websocket_listener():
    global real_time_data
    while True:
        try:
            ws = websocket.WebSocketApp(
                WEBSOCKET_SERVER,
                on_message=lambda ws, msg: on_message(ws, msg),
                on_error=lambda ws, err: print(f"[WebSocket 오류] {err}"),
                on_close=lambda ws, close_status, msg: print("[WebSocket 종료] 재연결 중..."),
            )
            print("[WebSocket 연결 시도]")
            ws.run_forever()
        except Exception as e:
            print(f"[WebSocket 예외] {e}")
        time.sleep(5)

def on_message(ws, message):
    global real_time_data
    try:
        real_time_data = json.loads(message)
    except Exception as e:
        print(f"[파싱 오류] {e}")

app = Dash(__name__)

app.layout = html.Div([
    html.H2("MarineBeacon 실시간 위치 추적"),
    dcc.Input(id="team-name", type="text", placeholder="팀명을 입력하세요", debounce=True),
    html.Div(id="ws-status"),

    html.Div(id="main-content", children=[
        dash_deck.DeckGL(
            id="deck-gl",
            mapboxKey="",
            style={"position": "relative", "width": "100%", "height": "80vh"},
            data={},
            tooltip={"text": "팀명: {team}\n위도: {lat}\n경도: {lon}"}
        )
    ], style={"display": "none"}),

    dcc.Interval(id="interval", interval=5000, n_intervals=0)
])

@app.callback(
    Output("ws-status", "children"),
    Output("main-content", "style"),
    Input("team-name", "value")
)
def show_map(team_name):
    if team_name:
        return f"✅ WebSocket 연결됨 (팀명: {team_name})", {"display": "block"}
    return "⏳ 팀명을 입력하세요.", {"display": "none"}

def create_layer(data):
    if not data:
        return []

    return [
        pdk.Layer(
            "ScatterplotLayer",
            data=[
                {
                    "position": [d["lon"], d["lat"]],
                    "team": d["team"],
                    "lat": d["lat"],
                    "lon": d["lon"]
                }
                for d in data
            ],
            get_position="position",
            get_fill_color="[200, 30, 0, 160]",
            get_radius=300,
            pickable=True
        )
    ]

@app.callback(
    Output("deck-gl", "data"),
    Input("interval", "n_intervals"),
    State("team-name", "value")
)
def update_map(n, team_name):
    if not real_time_data:
        return pdk.Deck(initial_view_state=initial_view).to_json()

    filtered = [d for d in real_time_data if not team_name or d["team"].lower() == team_name.lower()]
    layers = create_layer(filtered)
    deck = pdk.Deck(layers=layers, initial_view_state=initial_view)
    return deck.to_json()

threading.Thread(target=websocket_listener, daemon=True).start()

if __name__ == "__main__":
    app.run_server(debug=True, port=8050)