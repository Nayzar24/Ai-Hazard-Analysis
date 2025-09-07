// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || '';

export const API_ENDPOINTS = {
  HAZARD_ANALYSIS: `${API_BASE_URL}/api/hazard_analysis`,
  CHAT: `${API_BASE_URL}/api/chat`,
  CHAT_SESSION: (sessionId) => `${API_BASE_URL}/api/chat/session/${sessionId}`,
  UPLOAD_DOCUMENT: `${API_BASE_URL}/api/upload-document`,
  DOCUMENTS: `${API_BASE_URL}/api/documents`
};
