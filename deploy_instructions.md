# Deployment Instructions for Vercel

## Prerequisites
1. Make sure you have Vercel CLI installed: `npm i -g vercel`
2. Ensure you have a Vercel account and are logged in

## Environment Variables Setup
You need to set these environment variables in your Vercel dashboard:

1. **OPENAI_API_KEY**: Your OpenAI API key
2. **SUPABASE_URL**: Your Supabase project URL
3. **SUPABASE_ANON_KEY**: Your Supabase anonymous key
4. **GOOGLE_APPLICATION_CREDENTIALS**: Your Firebase service account JSON (optional, for document storage)

## Deployment Steps

1. **Build the frontend**:
   ```bash
   cd frontend
   npm run build
   cd ..
   ```

2. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

3. **Set environment variables** (if not done via CLI):
   - Go to your Vercel dashboard
   - Select your project
   - Go to Settings > Environment Variables
   - Add the required variables listed above

## Testing
After deployment, test the API endpoints:
- `https://your-domain.vercel.app/api/hazard_analysis` (POST)
- `https://your-domain.vercel.app/api/chat` (POST)

## Troubleshooting
- Check Vercel function logs for any errors
- Ensure all environment variables are set correctly
- Verify that the frontend is pointing to the correct API URL
