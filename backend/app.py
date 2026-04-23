import os
import base64
import requests
import time
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import pandas as pd

load_dotenv()

app = FastAPI(title="Spotify Analytics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load data
DATASET_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'dataset.csv')

def prepare_data():
    if not os.path.exists(DATASET_PATH):
        print(f"Warning: {DATASET_PATH} not found.")
        return pd.DataFrame()

    df = pd.read_csv(DATASET_PATH)
    df = df.drop(columns=['Unnamed: 0'], errors='ignore').dropna()
    df = df.drop_duplicates(subset=['track_name', 'artists'])

    def categorize_mood(row):
        if row['energy'] > 0.8 and row['danceability'] > 0.7: return 'Party'
        if row['instrumentalness'] > 0.5 and row['energy'] < 0.4: return 'Study'
        if row['valence'] >= 0.6 and row['energy'] >= 0.5: return 'Happy'
        if row['valence'] < 0.4 and row['energy'] < 0.4: return 'Sad'
        if row['energy'] >= 0.7: return 'Energetic'
        return 'Calm'

    df['mood'] = df.apply(categorize_mood, axis=1)
    return df

df = prepare_data()
indian_genres = ['indian', 'hindi', 'tamil', 'telugu', 'punjabi', 'bollywood']

# Pre-compute exploded artist data for faster lookups
_exploded_df = None
if not df.empty:
    _exploded_df = df.copy()
    _exploded_df['artist_list'] = _exploded_df['artists'].str.split(';')
    _exploded_df = _exploded_df.explode('artist_list')
    _exploded_df['artist_list'] = _exploded_df['artist_list'].str.strip()

# Spotify API Helpers
SPOTIFY_CLIENT_ID = os.environ.get("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.environ.get("SPOTIFY_CLIENT_SECRET")
_spotify_token = None
_token_expiry = 0

# In-memory image cache so we never ask Spotify for the same artist twice
_image_cache = {}

def get_spotify_token():
    global _spotify_token, _token_expiry
    if _spotify_token and time.time() < _token_expiry:
        return _spotify_token
    
    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        return None
        
    auth_str = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
    b64_auth_str = base64.b64encode(auth_str.encode()).decode()

    headers = {
        "Authorization": f"Basic {b64_auth_str}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    data = {"grant_type": "client_credentials"}
    
    try:
        response = requests.post("https://accounts.spotify.com/api/token", headers=headers, data=data, timeout=5)
        if response.status_code == 200:
            token_data = response.json()
            _spotify_token = token_data.get("access_token")
            _token_expiry = time.time() + token_data.get("expires_in", 3600) - 60
            return _spotify_token
    except Exception as e:
        print("Token fetch error:", e)
    return None

def fetch_artist_image(artist_name: str):
    # Check cache first
    if artist_name in _image_cache:
        return _image_cache[artist_name]
    
    token = get_spotify_token()
    if not token:
        url = f"https://ui-avatars.com/api/?name={artist_name}&background=random&size=200"
        _image_cache[artist_name] = url
        return url
        
    headers = {"Authorization": f"Bearer {token}"}
    params = {"q": artist_name, "type": "artist", "limit": 1}
    
    try:
        res = requests.get("https://api.spotify.com/v1/search", headers=headers, params=params, timeout=5)
        data = res.json()
        if data.get("artists") and data["artists"]["items"]:
            images = data["artists"]["items"][0].get("images", [])
            if images:
                url = images[0]["url"]
                _image_cache[artist_name] = url
                return url
    except Exception as e:
        print("Spotify API Error:", e)
        
    # Fallback
    url = f"https://ui-avatars.com/api/?name={artist_name}&background=random&size=200"
    _image_cache[artist_name] = url
    return url

@app.get("/api/artists")
def get_artists(mood: str, region: str):
    if _exploded_df is None:
        return {"error": "Dataset not loaded."}

    temp = _exploded_df[_exploded_df['mood'] == mood]
    if region == 'Bollywood':
        temp = temp[temp['track_genre'].isin(indian_genres)]
    else:
        temp = temp[~temp['track_genre'].isin(indian_genres)]
        
    artist_names = temp.groupby('artist_list')['popularity'].sum().sort_values(ascending=False).head(10).index.tolist()
    
    # Fetch all images in parallel using a thread pool
    with ThreadPoolExecutor(max_workers=10) as executor:
        images = list(executor.map(fetch_artist_image, artist_names))
    
    results = []
    for name, image in zip(artist_names, images):
        results.append({
            "id": name,
            "name": name,
            "image": image
        })
        
    return {"artists": results}

@app.get("/api/recommendations")
def get_recommendations(mood: str, region: str, singer: str):
    if df.empty:
        return {"error": "Dataset not loaded."}

    temp = df[df['mood'] == mood]
    if region == 'Bollywood':
        temp = temp[temp['track_genre'].isin(indian_genres)]
    else:
        temp = temp[~temp['track_genre'].isin(indian_genres)]

    mask = temp['artists'].str.contains(singer, regex=False, na=False)
    final_songs = temp[mask].sort_values(by='popularity', ascending=False).head(10)
    
    songs = []
    for _, row in final_songs.iterrows():
        songs.append({
            "track_id": row['track_id'],
            "track_name": row['track_name'],
            "artists": row['artists'].replace(';', ', '),
            "popularity": int(row['popularity']),
            "duration_ms": int(row['duration_ms']),
            "explicit": bool(row['explicit'])
        })
        
    return {"songs": songs}

@app.get("/api/search")
def search_songs(q: str):
    if df.empty:
        return {"results": []}

    query = q.lower()
    mask = df['track_name'].str.lower().str.contains(query, na=False) | \
           df['artists'].str.lower().str.contains(query, na=False)
    
    matches = df[mask].sort_values(by='popularity', ascending=False).head(20)
    
    results = []
    for _, row in matches.iterrows():
        results.append({
            "track_id": row['track_id'],
            "track_name": row['track_name'],
            "artists": row['artists'].replace(';', ', '),
            "popularity": int(row['popularity']),
            "duration_ms": int(row['duration_ms']),
            "explicit": bool(row['explicit'])
        })
        
    return {"results": results}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
