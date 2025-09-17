import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import all the functions we need
import openai
from flask import Flask, request, jsonify
from flask_cors import CORS
import tempfile
import PyPDF2
import docx
from io import BytesIO
import requests
import json
from supabase import create_client, Client

# Set API key
openai.api_key = os.getenv("OPENAI_API_KEY")

# Initialize Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Supabase initialization failed: {e}")

# Document processing functions
def extract_text_from_pdf(file_content):
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
    if supabase is None:
        return []
    
    try:
        response = supabase.table('documents').select('*').execute()
        relevant_docs = []
        for doc in response.data:
            filename = doc.get('filename', '')
            content = doc.get('content', '')
            
            query_lower = query.lower()
            if (query_lower in filename.lower() or 
                query_lower in content.lower() or
                any(keyword in content.lower() for keyword in query_lower.split())):
                relevant_docs.append({
                    'filename': filename,
                    'content': content[:2000],
                    'upload_date': doc.get('upload_date', '')
                })
        
        return relevant_docs[:limit]
    except Exception as e:
        print(f"Error retrieving documents: {e}")
        return []

def ai_hazard_analysis(unit, temp, pressure, chemicals, flow_rate=None, operation_phase=None, equipment_volume=None, phase=None, location=None, utilities=None):
    utilities_str = ""
    if utilities and len(utilities) > 0:
        utilities_str = f"Utilities: {', '.join(utilities)}"
    
    location_str = ""
    if location:
        location_str = f"Location: {location}"
    
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

# Vercel serverless function handler
def handler(request):
    # Create a simple Flask app for this request
    app = Flask(__name__)
    CORS(app)
    
    @app.route('/api/hazard_analysis', methods=['POST'])
    def hazard_analysis_api():
        data = request.get_json()
        try:
            unit = data['unit']
            temp = float(data['temp'])
            pressure = float(data['pressure'])
            chemicals = [c.strip() for c in data['chemicals']]
            
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
            
            return jsonify({'report': report})
        except Exception as e:
            return jsonify({'error': str(e)}), 400
    
    @app.route('/api/documents', methods=['GET'])
    def list_documents():
        try:
            if supabase is None:
                return jsonify({'error': 'Document storage temporarily unavailable. Please try again later.'}), 503
            
            response = supabase.table('documents').select('*').order('upload_date', desc=True).execute()
            
            documents = []
            for doc in response.data:
                documents.append({
                    'id': doc['id'],
                    'filename': doc.get('filename', ''),
                    'upload_date': doc.get('upload_date', ''),
                    'file_size': doc.get('file_size', 0),
                    'content_length': doc.get('content_length', 0)
                })
            
            return jsonify({'documents': documents})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # Handle the request
    with app.test_request_context(request.url, method=request.method, data=request.get_data()):
        if request.path == '/api/hazard_analysis':
            return hazard_analysis_api()
        elif request.path == '/api/documents':
            return list_documents()
        else:
            return jsonify({'error': 'Endpoint not found'}), 404
