# Quick Deployment Guide

## CRITICAL: You MUST redeploy after these backend changes!

I just fixed and simplified the entire backend to work properly for users across the internet. Now you need to redeploy.

---

## Step 1: Redeploy Backend on Render

1. Go to your **Render Dashboard**: https://dashboard.render.com
2. Find your `streammates-backend` service
3. Click **Manual Deploy** -> **Deploy latest commit**
4. **WAIT 2-3 minutes** for it to finish building

### Check if Backend is Working:
- Open your backend URL in a browser (e.g., `https://streammates-backend-xyz.onrender.com/health`)
- You should see: `{"status":"ok","timestamp":...}`
- If you see an error, check the **Logs** tab on Render

---

## Step 2: Redeploy Frontend on Vercel

1. Go to your **Vercel Dashboard**: https://vercel.com/dashboard
2. Find your project
3. Go to **Deployments** tab
4. Click the **3 dots** on the latest deployment -> **Redeploy**

### Double-Check Environment Variables:
Go to **Settings** -> **Environment Variables** and confirm:
```
VITE_API_URL=https://YOUR-BACKEND-URL.onrender.com
VITE_SOCKET_URL=https://YOUR-BACKEND-URL.onrender.com
```
(Replace with your actual Render URL)

---

## Step 3: Test

1. Open your Vercel URL (Frontend)
2. Create a room as Host
3. Open the same Vercel URL in an **Incognito/Private window** or **different browser**
4. Join the room as a Viewer
5. Host: Start screen share
6. Both: Send chat messages

### What Should Happen:
- ✅ No "Disconnected" red banner
- ✅ Both users see the correct user count
- ✅ Chat messages appear for both users instantly
- ✅ Screen share appears for the viewer

---

## If It Still Doesn't Work:

Open the **Browser Console** (F12 -> Console tab) on BOTH the host and viewer.
Look for errors that say:
- `[Socket] Connection error:` → Your backend URL is wrong or Render is down
- `Mixed Content` → You're using `http://` instead of `https://`
- `404` → The backend path is incorrect

Tell me what the console says and I'll fix it.
