const API_BASE_URL = 'https://j7jvczrc-8000.inc1.devtunnels.ms';

const defaultHeaders = {
    'Content-Type': 'application/json',
    'X-Tunnel-Skip-AntiSpam-Page': 'true'
};

async function handleResponse(response) {
    if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
            const errJson = await response.json();
            if (errJson && errJson.detail) {
                if (typeof errJson.detail === 'string') {
                    errorMessage = errJson.detail;
                } else if (Array.isArray(errJson.detail)) {
                    errorMessage = errJson.detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ');
                }
            }
        } catch (e) {
            // Ignore if response is not JSON
        }
        throw new Error(errorMessage);
    }
    
    // Return empty object for empty responses
    if (response.status === 204) {
        return {};
    }
    
    // Handle image response for QR generation
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('image/png')) {
        const blob = await response.blob();
        return { isBlob: true, blob };
    }
    
    try {
        return await response.json();
    } catch (e) {
        return {};
    }
}

async function request(path, options = {}) {
    const url = `${API_BASE_URL}${path}`;
    const headers = { ...defaultHeaders, ...options.headers };
    const requestOptions = {
        ...options,
        headers
    };
    
    try {
        const response = await fetch(url, requestOptions);
        return await handleResponse(response);
    } catch (error) {
        console.error(`API Request to ${url} failed:`, error);
        throw error;
    }
}

const CodeQuestAPI = {
    // Admin Questions
    async getQuestions() {
        try {
            return await request('/admin/questions/');
        } catch (error) {
            if (error.message === 'Question not found') {
                return []; // Return empty array if no questions exist yet
            }
            throw error;
        }
    },
    
    async createQuestion(questionData) {
        return await request('/admin/questions/', {
            method: 'POST',
            body: JSON.stringify(questionData)
        });
    },
    
    async getQuestionById(id) {
        return await request(`/admin/questions/${id}`);
    },
    
    async updateQuestion(id, questionData) {
        return await request(`/admin/questions/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(questionData)
        });
    },
    
    async deleteQuestion(id) {
        return await request(`/admin/questions/${id}`, {
            method: 'DELETE'
        });
    },
    
    async generateQR(id) {
        return await request(`/admin/questions/qr/${id}`, {
            method: 'POST'
        });
    },
    
    // Public Questions
    async getQuestionByQR(qrId) {
        return await request(`/public/questions/qr/${qrId}`);
    },
    
    // Admin Teams
    async getTeams() {
        return await request('/admin/teams/');
    }
};

window.CodeQuestAPI = CodeQuestAPI;
