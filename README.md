# 🧪 AI Hazard Analysis App

A professional web application for chemical process hazard analysis powered by AI. This app helps engineers and safety professionals analyze potential hazards in chemical processes using advanced AI technology.

## ✨ Features

- **🤖 AI-Powered Analysis**: Uses GPT-4o for intelligent hazard assessment
- **💬 Interactive Chatbot**: Ask questions about your process safety
- **📊 Professional Reports**: Generate detailed PDF reports
- **👤 User Authentication**: Secure login with Firebase
- **📁 Document Integration**: Upload and analyze engineering handbooks
- **📱 Responsive Design**: Works on desktop, tablet, and mobile
- **☁️ Cloud Ready**: Deploy to Vercel, Railway, or Heroku

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- OpenAI API Key

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Nayzar24/Ai-Hazard-Analysis.git
   cd Ai-Hazard-Analysis
   ```

2. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env and add your OpenAI API key
   ```

3. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

5. **Run the application**
   ```bash
   # Terminal 1: Start backend
   python3 safety_assistant.py
   
   # Terminal 2: Start frontend
   cd frontend
   npm start
   ```

6. **Open your browser**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5002

## 🌐 Deployment

### Option 1: Vercel (Recommended)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Option 2: Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway init
railway up
```

### Option 3: Heroku
```bash
# Install Heroku CLI
heroku create your-app-name
heroku config:set OPENAI_API_KEY=your_key_here
git push heroku main
```

## 🔧 Configuration

### Environment Variables
- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `FIREBASE_PRIVATE_KEY`: Firebase private key (optional)
- `FIREBASE_CLIENT_EMAIL`: Firebase client email (optional)
- `FIREBASE_PROJECT_ID`: Firebase project ID (optional)
- `PORT`: Server port (default: 5002)

### Firebase Setup (Optional)
1. Create a Firebase project
2. Enable Authentication and Firestore
3. Download service account key
4. Set environment variables

## 📖 Usage

1. **Hazard Analysis**: Fill out the process parameters and get AI-powered hazard analysis
2. **Chat Assistant**: Ask questions about process safety and get expert advice
3. **Report Generation**: Download professional PDF reports
4. **Document Upload**: Upload engineering handbooks for enhanced analysis

## 🛠️ Technology Stack

- **Backend**: Flask (Python)
- **Frontend**: React.js
- **AI**: OpenAI GPT-4o
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Deployment**: Vercel/Railway/Heroku

## 📝 API Endpoints

- `POST /api/hazard_analysis` - Analyze process hazards
- `POST /api/chat` - Chat with AI assistant
- `POST /api/upload-document` - Upload documents
- `GET /api/documents` - List uploaded documents

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

**Made with ❤️ for the chemical engineering community**
