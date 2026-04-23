import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import axios from 'axios';
import { supabase } from './supabaseClient';
import { Music, Home, Search, Library, Sun, Moon, ArrowLeft, Heart, Plus, User as UserIcon, List, LogIn } from 'lucide-react';

const MOODS = ['Happy', 'Sad', 'Energetic', 'Calm', 'Party', 'Study'];
const REGIONS = ['Bollywood', 'Hollywood'];
const MOOD_COLORS = { Happy: '#FFD700', Sad: '#1E90FF', Energetic: '#FF4500', Calm: '#1DB954', Party: '#FF1493', Study: '#A020F0' };
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api';

function formatDuration(ms) {
  if (!ms) return '';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Memoized SongCard to prevent unnecessary re-renders of Spotify iframes
const SongCard = memo(function SongCard({ song, isLiked, onToggleLike, playlists, onAddToPlaylist }) {
  const [showPlaylists, setShowPlaylists] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowPlaylists(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="song-card-wrapper">
      <div className="spotify-embed-container">
        <iframe 
          src={`https://open.spotify.com/embed/track/${song.track_id}?theme=0`} 
          className="spotify-embed"
          allowtransparency="true" 
          allow="encrypted-media"
          loading="lazy"
          title={song.track_name}
        ></iframe>
      </div>
      <div className="song-actions">
        <div className="song-meta">
          {song.explicit && <span className="explicit-badge">E</span>}
          <span className="song-duration">{formatDuration(song.duration_ms)}</span>
        </div>
        <div style={{display: 'flex', gap: '8px'}}>
          <button 
            className={`action-btn ${isLiked ? 'liked' : ''}`} 
            onClick={() => onToggleLike(song)}
            title={isLiked ? "Remove from Library" : "Save to Library"}
          >
            <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
          </button>
          <div className="action-btn" ref={menuRef}>
            <button className="action-btn" onClick={() => setShowPlaylists(!showPlaylists)} title="Add to Playlist">
              <Plus size={22} />
            </button>
            {showPlaylists && (
              <div className="playlist-dropdown">
                {playlists.length > 0 ? playlists.map(pl => (
                  <div key={pl.id} className="dropdown-item" onClick={() => { onAddToPlaylist(pl.id, song); setShowPlaylists(false); }}>
                    {pl.name}
                  </div>
                )) : (
                  <div className="dropdown-item" style={{color: 'var(--text-sub)'}}>No playlists yet</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// Main App Component
function App() {
  // Auth State
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  // User Profile Data
  const [profile, setProfile] = useState({ display_name: 'Guest' });
  const [editingProfile, setEditingProfile] = useState(false);
  const [newName, setNewName] = useState('');

  // User Music Data
  const [likedSongs, setLikedSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  
  // App View State
  const [currentView, setCurrentView] = useState('home');
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [theme, setTheme] = useState('dark');

  // Home Dashboard State
  const [mood, setMood] = useState('Happy');
  const [region, setRegion] = useState('Bollywood');
  const [singer, setSinger] = useState(null);
  const [artists, setArtists] = useState([]);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // ── Auth Listener ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (session) fetchUserData(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserData(session.user.id);
        setIsGuest(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId) => {
    // Run all 3 queries in parallel
    const [profRes, likesRes, plsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('liked_songs').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('playlists').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    ]);

    if (profRes.data) setProfile(profRes.data);
    else {
      const newProf = { id: userId, display_name: email.split('@')[0] || 'User' };
      await supabase.from('profiles').insert([newProf]);
      setProfile(newProf);
    }

    if (likesRes.data) setLikedSongs(likesRes.data);
    if (plsRes.data) setPlaylists(plsRes.data);
  };

  // ── Auth Handlers ──
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    let error;
    if (authMode === 'login') {
      const res = await supabase.auth.signInWithPassword({ email, password });
      error = res.error;
    } else {
      const res = await supabase.auth.signUp({ email, password });
      error = res.error;
    }
    if (error) setAuthError(error.message);
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsGuest(false);
    setSession(null);
    setProfile({ display_name: 'Guest' });
    setLikedSongs([]);
    setPlaylists([]);
    setCurrentView('home');
  };

  // ── Profile Update ──
  const updateProfile = async () => {
    if (isGuest) return alert("Guests cannot edit profiles. Please log in.");
    if (!newName) return;
    const { error } = await supabase.from('profiles').update({ display_name: newName }).eq('id', session.user.id);
    if (!error) {
      setProfile({ ...profile, display_name: newName });
      setEditingProfile(false);
    }
  };

  // ── Like Handler ──
  const toggleLike = useCallback(async (song) => {
    if (isGuest || !session) {
      alert("Please log in or sign up to save songs to your Library!");
      return;
    }
    const isLiked = likedSongs.some(ls => ls.track_id === song.track_id);
    if (isLiked) {
      await supabase.from('liked_songs').delete().eq('user_id', session.user.id).eq('track_id', song.track_id);
      setLikedSongs(prev => prev.filter(ls => ls.track_id !== song.track_id));
    } else {
      const newLike = { user_id: session.user.id, track_id: song.track_id, track_name: song.track_name, artists: song.artists };
      await supabase.from('liked_songs').insert([newLike]);
      setLikedSongs(prev => [newLike, ...prev]);
    }
  }, [session, isGuest, likedSongs]);

  // ── Playlist Handlers ──
  const createPlaylist = async () => {
    if (isGuest || !session) return alert("Please log in to create custom playlists!");
    const name = prompt("Enter playlist name:");
    if (!name) return;
    const { data } = await supabase.from('playlists').insert([{ user_id: session.user.id, name }]).select();
    if (data) setPlaylists(prev => [data[0], ...prev]);
  };

  const addToPlaylist = useCallback(async (playlistId, song) => {
    if (isGuest || !session) return alert("Please log in to add songs to playlists!");
    const { error } = await supabase.from('playlist_songs').insert([{
      playlist_id: playlistId,
      track_id: song.track_id,
      track_name: song.track_name,
      artists: song.artists
    }]);
    if (error) alert("Could not add — it might already be in the playlist.");
    else alert(`Added "${song.track_name}" to playlist!`);
  }, [session, isGuest]);

  const viewPlaylist = async (pl) => {
    setActivePlaylist(pl);
    setCurrentView('playlist');
    setLoading(true);
    const { data } = await supabase.from('playlist_songs').select('*').eq('playlist_id', pl.id).order('added_at', { ascending: true });
    setSongs(data || []);
    setLoading(false);
  };

  // ── Theme ──
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.body.classList.toggle('light-theme', next === 'light');
  };

  // ── Accent Color ──
  useEffect(() => {
    const hex = MOOD_COLORS[mood];
    document.documentElement.style.setProperty('--current-accent', hex);
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    document.documentElement.style.setProperty('--current-accent-rgb', `${r},${g},${b}`);
  }, [mood]);

  // ── Search (debounced) ──
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    const delay = setTimeout(async () => {
      try {
        const res = await axios.get(`${API_BASE}/search`, { params: { q: searchQuery } });
        setSearchResults(res.data.results || []);
      } catch (err) { console.error(err); }
      setSearchLoading(false);
    }, 400);
    return () => { clearTimeout(delay); setSearchLoading(false); };
  }, [searchQuery]);

  // ── Fetch Artists ──
  useEffect(() => {
    if (currentView !== 'home') return;
    setSinger(null);
    setLoading(true);
    const controller = new AbortController();
    
    axios.get(`${API_BASE}/artists`, { params: { mood, region }, signal: controller.signal })
      .then(res => { if (res.data.artists) setArtists(res.data.artists); })
      .catch(err => { if (!axios.isCancel(err)) console.error(err); })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [mood, region, currentView]);

  // ── Fetch Songs for selected artist ──
  useEffect(() => {
    if (currentView !== 'home' || !singer) return;
    setLoading(true);
    
    axios.get(`${API_BASE}/recommendations`, { params: { mood, region, singer: singer.id } })
      .then(res => { if (res.data.songs) setSongs(res.data.songs); })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [singer]);

  // ── Auth Screen ──
  if (authLoading) return <div className="loading"><div className="loader-spinner"></div></div>;
  if (!session && !isGuest) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <h2><Music /> Spotify Pro</h2>
          <p style={{marginBottom: '24px', color: 'var(--text-sub)'}}>
            {authMode === 'login' ? 'Welcome back! Log in to continue' : 'Create a new account'}
          </p>
          <form onSubmit={handleAuth}>
            <input type="email" placeholder="Email" className="auth-input" value={email} onChange={e=>setEmail(e.target.value)} required />
            <input type="password" placeholder="Password (min 6 chars)" className="auth-input" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} />
            {authError && <div className="error-msg">{authError}</div>}
            <button type="submit" className="auth-btn">{authMode === 'login' ? 'Log In' : 'Sign Up'}</button>
          </form>
          <button className="auth-btn guest-btn" onClick={() => { setIsGuest(true); setProfile({ display_name: 'Guest' }); }}>
            Continue as Guest
          </button>
          <button className="auth-link" style={{marginTop: '16px'}} onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }}>
            {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Log in"}
          </button>
        </div>
      </div>
    );
  }

  const displayName = isGuest ? 'Guest' : (profile?.display_name || 'User');

  // ── Main App ──
  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo">
          <Music size={28} color={MOOD_COLORS[mood]} />
          <span>Spotify Pro</span>
        </div>
        
        <div className="nav-links">
          <div className={`nav-link ${currentView === 'home' ? 'active' : ''}`} onClick={() => setCurrentView('home')}>
            <Home size={20} /> Home
          </div>
          <div className={`nav-link ${currentView === 'search' ? 'active' : ''}`} onClick={() => setCurrentView('search')}>
            <Search size={20} /> Search
          </div>
          <div className={`nav-link ${currentView === 'library' ? 'active' : ''}`} onClick={() => setCurrentView('library')}>
            <Library size={20} /> Your Library
          </div>
        </div>

        <div className="sidebar-divider"></div>
        <div className="sidebar-section">
          <button className="create-playlist-btn" onClick={createPlaylist}>
            <Plus size={20} /> Create Playlist
          </button>
          {playlists.length > 0 && (
            <div style={{marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px'}}>
              {playlists.map(pl => (
                <div key={pl.id} className={`playlist-item ${currentView === 'playlist' && activePlaylist?.id === pl.id ? 'active' : ''}`} onClick={() => viewPlaylist(pl)}>
                  # {pl.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {isGuest && (
          <div className="sidebar-login-prompt">
            <LogIn size={16} />
            <span onClick={handleLogout}>Log in for full features</span>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="topbar">
          <div></div>
          <div className="topbar-right">
            <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}>
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="profile-section" onClick={() => setCurrentView('profile')}>
              <div className="profile-avatar">{displayName.charAt(0)}</div>
              <span style={{fontWeight: '600', fontSize: '0.9rem', marginRight: '8px'}}>{displayName}</span>
            </div>
          </div>
        </div>

        {/* ── Home View ── */}
        {currentView === 'home' && (
          <>
            <div className="dashboard-controls">
              <div className="pills-group">
                {MOODS.map(m => <button key={m} className={`pill-btn ${mood === m ? 'active' : ''}`} onClick={() => setMood(m)}>{m}</button>)}
              </div>
              <div className="pills-group">
                {REGIONS.map(r => <button key={r} className={`pill-btn ${region === r ? 'active' : ''}`} onClick={() => setRegion(r)}>{r}</button>)}
              </div>
            </div>

            <div className="results-area">
              {loading ? (
                <div className="loading"><div className="loader-spinner"></div><p>{singer ? 'Loading tracks...' : 'Discovering artists...'}</p></div>
              ) : !singer ? (
                <>
                  <div className="results-header"><h2>Top Artists</h2></div>
                  <div className="artists-grid">
                    {artists.map(a => (
                      <div className="artist-card" key={a.id} onClick={() => setSinger({id: a.id, name: a.name})}>
                        <img src={a.image} alt={a.name} className="artist-img" loading="lazy" />
                        <h4 className="artist-name">{a.name}</h4>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="results-header">
                    <button className="back-btn" onClick={() => setSinger(null)}><ArrowLeft size={24} /></button>
                    <div><h2>{singer.name}</h2><p style={{color:'var(--text-sub)'}}>{mood} • Top 10</p></div>
                  </div>
                  <div className="songs-grid">
                    {songs.map(song => (
                      <SongCard key={song.track_id} song={song} isLiked={likedSongs.some(ls => ls.track_id === song.track_id)} onToggleLike={toggleLike} playlists={playlists} onAddToPlaylist={addToPlaylist} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ── Search View ── */}
        {currentView === 'search' && (
          <div className="results-area">
            <div className="search-container">
              <div className="search-input-wrapper">
                <Search size={20} className="search-icon" />
                <input type="text" className="search-input" placeholder="What do you want to listen to?" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
              </div>
            </div>
            {searchLoading ? (
              <div className="loading"><div className="loader-spinner"></div></div>
            ) : searchResults.length > 0 ? (
              <div className="songs-grid">
                {searchResults.map(song => (
                  <SongCard key={song.track_id} song={song} isLiked={likedSongs.some(ls => ls.track_id === song.track_id)} onToggleLike={toggleLike} playlists={playlists} onAddToPlaylist={addToPlaylist} />
                ))}
              </div>
            ) : searchQuery.length >= 2 ? (
              <div className="placeholder-view"><h3>No results found</h3><p style={{color: 'var(--text-sub)'}}>Try different keywords.</p></div>
            ) : (
              <div className="placeholder-view">
                <Search size={64} style={{color: 'var(--text-sub)', marginBottom: '16px'}} />
                <h2>Search for Songs or Artists</h2>
                <p style={{color: 'var(--text-sub)'}}>Type at least 2 characters to search.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Library View ── */}
        {currentView === 'library' && (
          <div className="results-area">
            <div className="results-header"><h2>Your Library</h2><p style={{color:'var(--text-sub)'}}>{likedSongs.length} Liked Songs</p></div>
            {isGuest ? (
              <div className="placeholder-view">
                <LogIn size={64} style={{color: 'var(--text-sub)', marginBottom: '16px'}} />
                <h3>Log in to see your Library</h3>
                <p style={{color: 'var(--text-sub)', marginBottom: '16px'}}>Your liked songs will appear here.</p>
                <button className="auth-btn" style={{maxWidth: '200px'}} onClick={handleLogout}>Log In</button>
              </div>
            ) : likedSongs.length > 0 ? (
              <div className="songs-grid">
                {likedSongs.map(song => (
                  <SongCard key={song.track_id} song={song} isLiked={true} onToggleLike={toggleLike} playlists={playlists} onAddToPlaylist={addToPlaylist} />
                ))}
              </div>
            ) : (
              <div className="placeholder-view">
                <Heart size={64} style={{color: 'var(--text-sub)', marginBottom: '16px'}} />
                <h3>It's empty here!</h3>
                <p style={{color: 'var(--text-sub)'}}>Go like some songs to add them to your library.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Playlist View ── */}
        {currentView === 'playlist' && activePlaylist && (
          <div className="results-area">
            <div className="results-header">
              <button className="back-btn" onClick={() => setCurrentView('home')}><ArrowLeft size={24} /></button>
              <div><h2>{activePlaylist.name}</h2><p style={{color:'var(--text-sub)'}}>Playlist • {songs.length} tracks</p></div>
            </div>
            {loading ? (
              <div className="loading"><div className="loader-spinner"></div></div>
            ) : songs.length > 0 ? (
              <div className="songs-grid">
                {songs.map(song => (
                  <SongCard key={song.track_id} song={song} isLiked={likedSongs.some(ls => ls.track_id === song.track_id)} onToggleLike={toggleLike} playlists={playlists} onAddToPlaylist={addToPlaylist} />
                ))}
              </div>
            ) : (
              <div className="placeholder-view">
                <List size={64} style={{color: 'var(--text-sub)', marginBottom: '16px'}} />
                <h3>Empty Playlist</h3>
                <p style={{color: 'var(--text-sub)'}}>Search or browse songs to add them here.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Profile View ── */}
        {currentView === 'profile' && (
          <div className="results-area">
            <div className="profile-header">
              <div className="profile-large-avatar">{displayName.charAt(0)}</div>
              <div className="profile-info">
                <p>Profile</p>
                {editingProfile ? (
                  <div className="edit-profile-form">
                    <input type="text" className="edit-profile-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Display Name" autoFocus />
                    <button className="edit-btn" onClick={updateProfile}>Save</button>
                    <button className="edit-btn" style={{borderColor: 'transparent'}} onClick={() => setEditingProfile(false)}>Cancel</button>
                  </div>
                ) : (
                  <h1>{displayName}</h1>
                )}
                <div style={{display: 'flex', gap: '16px', color: 'var(--text-sub)', marginBottom: '24px'}}>
                  <span><b>{playlists.length}</b> Playlists</span>
                  <span><b>{likedSongs.length}</b> Liked Songs</span>
                </div>
                {!editingProfile && (
                  <div style={{display: 'flex', gap: '12px'}}>
                    {!isGuest && <button className="edit-btn" onClick={() => { setNewName(profile.display_name || ''); setEditingProfile(true); }}>Edit Profile</button>}
                    <button className="logout-btn" onClick={handleLogout}>{isGuest ? 'Log in / Sign up' : 'Log Out'}</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
