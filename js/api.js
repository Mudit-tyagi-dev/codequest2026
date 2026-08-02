const BASE_URL = "https://api.shubhjain.info";

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
    const url = `${BASE_URL}${path}`;
    const headers = { ...defaultHeaders, ...options.headers };
    
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }
    
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
    BASE_URL,
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
    },
    
    async getTeamById(id) {
        return await request(`/admin/teams/${id}`);
    },
    
    async getTeamByQR(qrId) {
        return await request(`/admin/teams/qr/${qrId}`);
    },
    
    async updateTeamStatus(id, status) {
        return await request(`/admin/teams/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
    },

    async updateTeam(id, teamData) {
        return await request(`/admin/teams/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(teamData)
        });
    },

    // Upload Question Image
    async uploadQuestionImage(id, imageBlob) {
        const formData = new FormData();
        formData.append('image', imageBlob, 'upload.jpg');
        return await request(`/admin/questions/${id}/image`, {
            method: 'POST',
            body: formData
        });
    }
};

window.CodeQuestAPI = CodeQuestAPI;
