# Data Analytics Project Summary

This project is a full-stack, multi-user **Spotify-themed Data Analytics Dashboard** that provides music recommendations, artist lookups based on moods/regions, and personalized user experiences (like saving playlists and liked songs).

## 🏗️ Architecture & Tech Stack

The application follows a modern full-stack architecture divided into a frontend web app, a backend API, and a managed database/auth provider.

### 1. Frontend (`/spotify-frontend`)
- **Framework**: React 19 + Vite.
- **Styling**: Vanilla CSS adhering to premium, modern UI/UX guidelines (dark mode, glassmorphism, smooth micro-animations) as outlined in `antigravity_skills.md`.
- **Key Dependencies**: 
  - `@supabase/supabase-js` for authentication and database interactions.
  - `axios` for HTTP requests to the backend.
  - `lucide-react` for iconography.
  - `fast-average-color` for dynamic color theming.
- **Deployment**: Configured for deployment on Vercel (via `vercel.json`).

### 2. Backend (`/backend`)
- **Framework**: FastAPI (Python).
- **Data Processing**: Pandas is used to process a ~20MB local `dataset.csv` containing Spotify tracks and artists. The backend handles categorization of songs by mood (Party, Study, Happy, Sad, Energetic, Calm) and region (e.g., Bollywood vs. non-Indian).
- **External APIs**: Integrates with the official Spotify API via `requests` to fetch artist images, implementing an in-memory cache and multithreaded fetching (`ThreadPoolExecutor`) for high performance.
- **Key Endpoints**:
  - `/api/artists`: Returns top artists based on mood and region.
  - `/api/recommendations`: Returns song recommendations based on mood, region, and a specific singer.
  - `/api/search`: Allows searching for tracks or artists within the dataset.

### 3. Database & Authentication (Supabase)
- **Service**: Supabase (PostgreSQL).
- **Schema (`supabase_schema.sql`)**:
  - `profiles`: Linked to `auth.users` for user display names and avatars.
  - `liked_songs`: Stores individual tracks a user has favorited.
  - `playlists` & `playlist_songs`: Allows users to create custom playlists and add tracks to them.
- **Security**: Robust Row Level Security (RLS) policies are implemented to ensure users can only access and modify their own data.

### 4. Data Analysis (`data_analytics_project.ipynb`)
A Jupyter notebook exists at the root of the project, which was likely used for exploratory data analysis (EDA), data cleaning, or prototyping the pandas logic before porting it to the FastAPI backend.

## 🎨 UI/UX Guidelines
The project enforces strict design rules to maintain a "premium" feel:
- Avoidance of generic colors and pitch black; preference for rich dark grays and vibrant accents (e.g., Spotify Green).
- Extensive use of glassmorphism (`backdrop-filter`), soft shadows, and subtle borders.
- Mandatory hover states, smooth transitions, and modern typography (e.g., Inter, Roboto).

## 🚀 Deployment
- **Frontend**: Designed to be deployed on Vercel, utilizing the `vercel.json` rewrite rules for single-page application (SPA) routing.
- **Backend**: Can be deployed on platforms like Render or Railway, running via Uvicorn.
