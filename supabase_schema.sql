-- Run this entire script in your Supabase SQL Editor to create the necessary tables

-- Create profiles table linked to auth.users
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT
);

-- Enable RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- Create liked_songs table
CREATE TABLE liked_songs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  track_id TEXT NOT NULL,
  track_name TEXT NOT NULL,
  artists TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, track_id)
);

ALTER TABLE liked_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own liked songs." ON liked_songs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own liked songs." ON liked_songs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own liked songs." ON liked_songs FOR DELETE USING (auth.uid() = user_id);

-- Create playlists table
CREATE TABLE playlists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own playlists." ON playlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own playlists." ON playlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own playlists." ON playlists FOR DELETE USING (auth.uid() = user_id);

-- Create playlist_songs table
CREATE TABLE playlist_songs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE NOT NULL,
  track_id TEXT NOT NULL,
  track_name TEXT NOT NULL,
  artists TEXT NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(playlist_id, track_id)
);

ALTER TABLE playlist_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view songs in their playlists." ON playlist_songs FOR SELECT USING (
  EXISTS (SELECT 1 FROM playlists WHERE id = playlist_songs.playlist_id AND user_id = auth.uid())
);
CREATE POLICY "Users can add songs to their playlists." ON playlist_songs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM playlists WHERE id = playlist_songs.playlist_id AND user_id = auth.uid())
);
CREATE POLICY "Users can delete songs from their playlists." ON playlist_songs FOR DELETE USING (
  EXISTS (SELECT 1 FROM playlists WHERE id = playlist_songs.playlist_id AND user_id = auth.uid())
);
