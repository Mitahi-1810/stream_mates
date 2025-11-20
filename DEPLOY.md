# Deployment Guide for StreamMates

To make your app accessible to everyone on the internet, you need to deploy the **Backend** (Server) and the **Frontend** (Website) separately.

## Part 1: Deploy the Backend (Render.com)
The backend handles the real-time connections and database.

1.  **Push your code to GitHub**
    *   Create a new repository on GitHub.
    *   Push this entire project folder to it.

2.  **Create a Web Service on Render**
    *   Go to [dashboard.render.com](https://dashboard.render.com/) and sign up/login.
    *   Click **New +** -> **Web Service**.
    *   Connect your GitHub repository.

3.  **Configure the Service**
    *   **Name:** `streammates-backend` (or similar)
    *   **Root Directory:** `server` (Important! This tells Render the backend is in the server folder)
    *   **Runtime:** `Node`
    *   **Build Command:** `npm install`
    *   **Start Command:** `node server.js`

4.  **Add Environment Variables**
    *   Scroll down to "Environment Variables" and add:
        *   `MONGODB_URI`: (Paste your MongoDB Atlas connection string here)
        *   `CORS_ORIGIN`: `*` (Allows any website to connect)

5.  **Deploy**
    *   Click **Create Web Service**.
    *   Wait for it to finish. It will give you a URL like `https://streammates-backend.onrender.com`.
    *   **Copy this URL.**

---

## Part 2: Deploy the Frontend (Vercel)
The frontend is the user interface.

1.  **Go to Vercel**
    *   Go to [vercel.com](https://vercel.com) and sign up/login.
    *   Click **Add New...** -> **Project**.
    *   Import the same GitHub repository.

2.  **Configure the Project**
    *   **Framework Preset:** Vite (It should detect this automatically).
    *   **Root Directory:** `./` (Default).

3.  **Add Environment Variables**
    *   Click "Environment Variables".
    *   Add the following (using the URL you got from Render):
        *   `VITE_API_URL`: `https://streammates-backend.onrender.com`
        *   `VITE_SOCKET_URL`: `https://streammates-backend.onrender.com`

4.  **Deploy**
    *   Click **Deploy**.
    *   Wait a moment. It will give you a URL like `https://streammates.vercel.app`.

## Part 3: Final Test
1.  Open the Vercel URL (Frontend) on your computer.
2.  Send the link to a friend (or open on your phone).
3.  Create a room and test the chat/video!
