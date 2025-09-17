import openai
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import tempfile
import PyPDF2
import docx
from io import BytesIO
import requests
import json
import firebase_admin
from firebase_admin import credentials, firestore

# 🔑 Set your API key from environment variable
openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    print("Warning: OPENAI_API_KEY environment variable not set!")

# 🔥 Initialize Firebase
db = None
try:
    # Initialize Firebase Admin SDK
    if not firebase_admin._apps:
        # For Vercel deployment, we'll use default credentials
        # Make sure to set GOOGLE_APPLICATION_CREDENTIALS in Vercel
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    print("Firebase initialized successfully")
except Exception as e:
    print(f"Warning: Firebase initialization failed: {e}")
    print("Document storage will not be available")

# 🔥 Initialize Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

if SUPABASE_URL and SUPABASE_KEY:
    print("Supabase credentials found")
else:
    print("Warning: Supabase credentials not found. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.")

# 📄 Document Processing Functions
def extract_text_from_pdf(file_content):
    """Extract text from PDF file content"""
    try:
        pdf_reader = PyPDF2.PdfReader(BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
        return ""

def extract_text_from_docx(file_content):
    """Extract text from DOCX file content"""
    try:
        doc = docx.Document(BytesIO(file_content))
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text
    except Exception as e:
        print(f"Error extracting DOCX text: {e}")
        return ""

def extract_text_from_file(file_content, filename):
    """Extract text from various file types"""
    file_extension = filename.lower().split('.')[-1]
    
    if file_extension == 'pdf':
        return extract_text_from_pdf(file_content)
    elif file_extension in ['docx', 'doc']:
        return extract_text_from_docx(file_content)
    elif file_extension == 'txt':
        return file_content.decode('utf-8')
    else:
        return ""

def get_relevant_documents(query, limit=5):
    """Retrieve relevant documents from Firebase Storage based on query"""
    if db is None:
        print("Firestore not available, returning empty document list")
        return []
    
    try:
        # Get all documents from Firestore metadata
        docs_ref = db.collection('documents')
        docs = docs_ref.get()
        
        relevant_docs = []
        for doc in docs:
            doc_data = doc.to_dict()
            filename = doc_data.get('filename', '')
            content = doc_data.get('content', '')
            
            # Simple relevance check - look for keywords in filename and content
            query_lower = query.lower()
            if (query_lower in filename.lower() or 
                query_lower in content.lower() or
                any(keyword in content.lower() for keyword in query_lower.split())):
                relevant_docs.append({
                    'filename': filename,
                    'content': content[:2000],  # Limit content length
                    'upload_date': doc_data.get('upload_date', '')
                })
        
        return relevant_docs[:limit]
    except Exception as e:
        print(f"Error retrieving documents: {e}")
        return []

# 🧠 Function to get AI-generated hazard analysis
def ai_hazard_analysis(unit, temp, pressure, chemicals, flow_rate=None, operation_phase=None, equipment_volume=None, phase=None, location=None, utilities=None):
    # Build utilities string
    utilities_str = ""
    if utilities and len(utilities) > 0:
        utilities_str = f"Utilities: {', '.join(utilities)}"
    
    # Build location string
    location_str = ""
    if location:
        location_str = f"Location: {location}"
    
    # Get relevant documents for hazard analysis
    process_query = f"{unit} {', '.join(chemicals)} {operation_phase} {phase} {location}"
    relevant_docs = get_relevant_documents(process_query, limit=5)
    document_context = ""
    if relevant_docs:
        document_context = "\n\nRelevant Engineering Documents and Handbooks:\n"
        for doc in relevant_docs:
            document_context += f"Document: {doc['filename']}\n{doc['content']}\n\n"
    
    prompt = f"""
    You are a senior process safety engineer with extensive experience in chemical engineering and industrial safety. Based on the following process data, provide a comprehensive hazard analysis with detailed engineering insights.

    Process Parameters:
    - Unit operation: {unit}
    - Temperature: {temp} K
    - Pressure: {pressure} atm
    - Chemicals: {', '.join(chemicals)}
    {f"- Flow Rate: {flow_rate}" if flow_rate else ""}
    {f"- Operation Phase: {operation_phase}" if operation_phase else ""}
    {f"- Equipment Volume: {equipment_volume}" if equipment_volume else ""}
    {f"- Phase: {phase}" if phase else ""}
    {f"- Location: {location_str}" if location_str else ""}
    {f"- Utilities: {utilities_str}" if utilities_str else ""}

    {document_context}

    Instructions:
    1. Provide detailed engineering analysis with specific technical details
    2. Include relevant safety standards, codes, and best practices
    3. Consider material properties, reaction kinetics, and process dynamics
    4. Address both immediate and long-term safety concerns
    5. Provide specific, actionable recommendations with engineering justification
    6. Use clear, professional language with proper grammar and spacing
    7. Ensure all text is properly formatted with spaces between words
    8. Include quantitative assessments where applicable
    9. Consider environmental, health, and safety (EHS) implications
    10. Reference relevant industry standards (OSHA, EPA, API, etc.)
    11. IMPORTANT: If engineering documents are provided above, reference them specifically in your analysis
    12. Use the document content to provide more accurate, detailed, and context-specific hazard analysis
    13. When referencing documents, mention the document name and cite specific information from it
    14. Combine your engineering expertise with the document information to give comprehensive analysis
    15. Apply proper engineering logic from both the handbooks and your own knowledge base
    16. Use the handbook data to validate and enhance your technical recommendations

    Format your response with clear sections:
    - Hazards: Detailed identification of specific hazards with engineering context
    - Safeguards: Comprehensive recommendations with technical justification

    Ensure all text is grammatically correct, properly spaced, and professionally written.
    """

    response = openai.ChatCompletion.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are an expert process safety engineer with access to engineering handbooks and technical documents. You combine your extensive knowledge with specific document references to provide comprehensive, accurate hazard analysis. Always reference relevant documents when available and apply proper engineering logic from both handbooks and your expertise."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3
    )

    return response.choices[0].message["content"]

def chat_analysis(session_id, user_message, current_analysis=None):
    """Handle conversational analysis and what-if scenarios"""
    
    # Get or create session context
    if session_id not in chat_sessions:
        chat_sessions[session_id] = {
            'messages': [],
            'current_analysis': current_analysis,
            'process_data': None
        }
    
    session = chat_sessions[session_id]
    
    # Update current analysis if provided
    if current_analysis:
        session['current_analysis'] = current_analysis
    
    # Get relevant documents based on user query
    relevant_docs = get_relevant_documents(user_message, limit=3)
    document_context = ""
    if relevant_docs:
        document_context = "\n\nRelevant Engineering Documents:\n"
        for doc in relevant_docs:
            document_context += f"Document: {doc['filename']}\n{doc['content']}\n\n"
    
    # Build context for the AI
    context = f"""
    You are a friendly and knowledgeable process safety engineer having a casual conversation with a colleague about their hazard analysis. Be conversational, use "you" and "we", and make the conversation feel natural and engaging.
    
    Current Analysis Context:
    {session['current_analysis'] if session['current_analysis'] else 'No current analysis available.'}
    
    Process Data Context:
    {session['process_data'] if session['process_data'] else 'No process data available.'}
    
    {document_context}
    
    Previous Conversation:
    {chr(10).join([f"User: {msg['user']}\nAssistant: {msg['assistant']}" for msg in session['messages'][-5:]])}
    
    User Question: {user_message}
    
    Instructions:
    1. Respond in a friendly, conversational tone - like you're chatting with a colleague over coffee
    2. Use "you" and "we" to make it personal and engaging
    3. Structure your responses with clear bullet points and sections for easy reading
    4. Use bullet points (•) for key points, risks, and recommendations
    5. Break complex explanations into digestible sections with headers
    6. For what-if scenarios, use clear before/after comparisons with bullet points
    7. Use analogies and real-world examples when helpful
    8. Ask follow-up questions to better understand their concerns
    9. Be encouraging and supportive while maintaining technical accuracy
    10. Use conversational phrases like "Here's the thing...", "So what happens is...", "The key point is..."
    11. Explain your reasoning in a way that feels like you're walking through it together
    12. Keep it practical and actionable, but make it feel like friendly advice
    13. IMPORTANT: If relevant engineering documents are provided above, reference them specifically in your response
    14. Use the document content to provide more accurate, detailed, and context-specific advice
    15. When referencing documents, mention the document name and cite specific information from it
    16. Combine your engineering expertise with the document information to give comprehensive answers
    
    Format your response with:
    • Clear section headers (use simple text, no markdown)
    • Clean, left-aligned bullet points that are separate from text
    • NO embedded bullet points within paragraphs
    • Use this EXACT structure:
      
      Section Title
      Brief introduction paragraph here.
      
      • Key Point 1: Brief explanation
      • Key Point 2: Brief explanation  
      • Key Point 3: Brief explanation
      
      Next Section
      Another brief intro paragraph here.
      
      • Risk Factor 1: What it means
      • Risk Factor 2: What it means
      • Mitigation: How to address it
      
    IMPORTANT: Never put bullet points in the middle of paragraphs. Keep bullets separate and left-aligned. Use simple text only - no markdown symbols, asterisks, or hashtags.
    
    Remember: You're having a conversation, not writing a report. Make it feel natural and engaging while being easy to read!
    """
    
    response = openai.ChatCompletion.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a friendly and experienced process safety engineer chatting with a colleague. You have deep expertise in chemical engineering and safety, but you communicate in a warm, conversational way. You're here to help them understand their process risks and think through scenarios together. IMPORTANT: Always format your responses with clear section headers and clean, left-aligned bullet points that are completely separate from paragraphs. Never embed bullet points within text. Use simple text formatting - no markdown symbols, asterisks, or hashtags."},
            {"role": "user", "content": context}
        ],
        temperature=0.7
    )
    
    assistant_response = response.choices[0].message["content"]
    
    # Store the conversation
    session['messages'].append({
        'user': user_message,
        'assistant': assistant_response
    })
    
    # Keep only last 20 messages to manage memory
    if len(session['messages']) > 20:
        session['messages'] = session['messages'][-20:]
    
    return assistant_response

def update_session_process_data(session_id, process_data):
    """Update session with current process data for context"""
    if session_id not in chat_sessions:
        chat_sessions[session_id] = {'messages': [], 'current_analysis': None, 'process_data': None}
    
    chat_sessions[session_id]['process_data'] = process_data

# --- Flask API ---
app = Flask(__name__)
CORS(app)

# Global session storage for chat context
chat_sessions = {}

@app.route('/api/hazard_analysis', methods=['POST'])
def hazard_analysis_api():
    data = request.json
    try:
        unit = data['unit']
        temp = float(data['temp'])
        pressure = float(data['pressure'])
        chemicals = [c.strip() for c in data['chemicals']]
        
        # Extract new optional fields
        flow_rate = data.get('flowRate')
        operation_phase = data.get('operationPhase')
        equipment_volume = data.get('equipmentVolume')
        phase = data.get('phase')
        location = data.get('location')
        utilities = data.get('utilities', [])
        
        report = ai_hazard_analysis(
            unit, temp, pressure, chemicals, 
            flow_rate, operation_phase, equipment_volume, 
            phase, location, utilities
        )
        
        # Update chat session with process data for context
        session_id = data.get('sessionId', 'default')
        process_data = f"""
        Unit: {unit}
        Temperature: {temp} K
        Pressure: {pressure} atm
        Chemicals: {', '.join(chemicals)}
        {f"Flow Rate: {flow_rate}" if flow_rate else ""}
        {f"Operation Phase: {operation_phase}" if operation_phase else ""}
        {f"Equipment Volume: {equipment_volume}" if equipment_volume else ""}
        {f"Phase: {phase}" if phase else ""}
        {f"Location: {location}" if location else ""}
        {f"Utilities: {', '.join(utilities)}" if utilities else ""}
        """
        update_session_process_data(session_id, process_data)
        
        return jsonify({'report': report})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/chat', methods=['POST'])
def chat_api():
    data = request.json
    try:
        session_id = data.get('sessionId', 'default')
        user_message = data['message']
        current_analysis = data.get('currentAnalysis')
        
        # Update session with current analysis if provided
        if current_analysis:
            update_session_process_data(session_id, current_analysis)
        
        response = chat_analysis(session_id, user_message, current_analysis)
        return jsonify({'response': response, 'sessionId': session_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/chat/session/<session_id>', methods=['DELETE'])
def clear_chat_session(session_id):
    """Clear a specific chat session"""
    try:
        if session_id in chat_sessions:
            del chat_sessions[session_id]
        return jsonify({'message': 'Session cleared'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/upload-document', methods=['POST'])
def upload_document():
    """Upload and process engineering documents"""
    try:
        if db is None:
            return jsonify({'error': 'Document storage not available. Firebase not configured.'}), 503
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Read file content
        file_content = file.read()
        filename = file.filename
        
        # Extract text from the document
        extracted_text = extract_text_from_file(file_content, filename)
        
        if not extracted_text:
            return jsonify({'error': 'Could not extract text from document'}), 400
        
        # Store document metadata in Firestore
        doc_data = {
            'filename': filename,
            'content': extracted_text,
            'upload_date': firestore.SERVER_TIMESTAMP,
            'file_size': len(file_content),
            'content_length': len(extracted_text)
        }
        
        # Save to Firestore
        doc_ref = db.collection('documents').add(doc_data)
        
        return jsonify({
            'message': 'Document uploaded successfully',
            'document_id': doc_ref[1].id,
            'filename': filename,
            'content_preview': extracted_text[:500] + '...' if len(extracted_text) > 500 else extracted_text
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/documents', methods=['GET'])
def list_documents():
    """List all uploaded documents"""
    try:
        if db is None:
            return jsonify({'error': 'Document storage not available. Firebase not configured.'}), 503
        
        docs_ref = db.collection('documents')
        docs = docs_ref.order_by('upload_date', direction=firestore.Query.DESCENDING).get()
        
        documents = []
        for doc in docs:
            doc_data = doc.to_dict()
            documents.append({
                'id': doc.id,
                'filename': doc_data.get('filename', ''),
                'upload_date': doc_data.get('upload_date', ''),
                'file_size': doc_data.get('file_size', 0),
                'content_length': doc_data.get('content_length', 0)
            })
        
        return jsonify({'documents': documents})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5002))
    app.run(debug=False, host='0.0.0.0', port=port)
