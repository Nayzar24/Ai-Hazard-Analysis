# 🚀 Deploy Your Safety Assistant App

## Quick Deployment Guide

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel --prod
   ```

4. **Set Environment Variables:**
   - Go to your Vercel dashboard
   - Add `OPENAI_API_KEY` with your OpenAI API key

### Option 2: Railway

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login and Deploy:**
   ```bash
   railway login
   railway init
   railway up
   ```

3. **Set Environment Variables:**
   ```bash
   railway variables set OPENAI_API_KEY=your_key_here
   ```

### Option 3: Heroku

1. **Install Heroku CLI**
2. **Create Heroku App:**
   ```bash
   heroku create your-app-name
   ```

3. **Set Environment Variables:**
   ```bash
   heroku config:set OPENAI_API_KEY=your_key_here
   ```

4. **Deploy:**
   ```bash
   git push heroku main
   ```

## Environment Variables Needed:
- `OPENAI_API_KEY`: Your OpenAI API key
- `FIREBASE_PRIVATE_KEY`: (Optional) For document storage
- `FIREBASE_CLIENT_EMAIL`: (Optional) For document storage

## After Deployment:
1. Your app will be available at a public URL
2. Share the URL with anyone - no local setup needed!
3. The app works on any device with internet access
