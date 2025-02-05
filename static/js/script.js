document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const jobDescription = document.getElementById('jobDescription');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loadingOverlay = document.querySelector('.loading-overlay');
    const resultsSection = document.getElementById('results');

    // File handling
    let files = new Set();

    // Drag and drop handlers
    dropZone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight);
    });

    dropZone.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);
    jobDescription.addEventListener('input', validateForm);

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight() {
        dropZone.style.borderColor = 'var(--primary-color)';
        dropZone.style.backgroundColor = 'rgba(79, 70, 229, 0.05)';
    }

    function unhighlight() {
        dropZone.style.borderColor = 'var(--border-color)';
        dropZone.style.backgroundColor = 'transparent';
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const newFiles = [...dt.files].filter(file => file.type === 'application/pdf');
        
        if (newFiles.length + files.size > 10) {
            showError('Maximum 10 files allowed');
            return;
        }

        newFiles.forEach(file => {
            if (file.size > 10 * 1024 * 1024) {
                showError(`File ${file.name} exceeds 10MB limit`);
                return;
            }
            files.add(file);
        });

        updateFileList();
        validateForm();
    }

    function handleFileSelect(e) {
        const newFiles = [...e.target.files].filter(file => file.type === 'application/pdf');
        
        if (newFiles.length + files.size > 10) {
            showError('Maximum 10 files allowed');
            return;
        }

        newFiles.forEach(file => {
            if (file.size > 10 * 1024 * 1024) {
                showError(`File ${file.name} exceeds 10MB limit`);
                return;
            }
            files.add(file);
        });

        updateFileList();
        validateForm();
        fileInput.value = '';
    }

    function updateFileList() {
        fileList.innerHTML = '';
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <i class="fas fa-file-pdf"></i>
                <span>${file.name}</span>
                <i class="fas fa-times remove-file"></i>
            `;
            
            fileItem.querySelector('.remove-file').addEventListener('click', () => {
                files.delete(file);
                updateFileList();
                validateForm();
            });
            
            fileList.appendChild(fileItem);
        });
    }

    function validateForm() {
        const hasFiles = files.size > 0;
        const hasJobDescription = jobDescription.value.trim().length >= 50;
        analyzeBtn.disabled = !(hasFiles && hasJobDescription);
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        const container = document.querySelector('.main-content');
        container.insertBefore(errorDiv, container.firstChild);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    // Form submission
    analyzeBtn.addEventListener('click', async () => {
        if (files.size === 0) {
            showError('Please select at least one PDF file');
            return;
        }

        if (!jobDescription.value.trim()) {
            showError('Please enter a job description');
            return;
        }

        loadingOverlay.style.display = 'flex';
        
        try {
            const formData = new FormData();
            formData.append('jobDescription', jobDescription.value.trim());
            
            // Append each file to FormData
            files.forEach(file => {
                formData.append('files[]', file);
            });

            const response = await fetch('/analyze', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (response.ok) {
                displayResults(data);
            } else {
                showError(data.error || 'An error occurred during analysis');
            }
        } catch (error) {
            console.error('Error:', error);
            showError('An error occurred while processing your request');
        } finally {
            loadingOverlay.style.display = 'none';
        }
    });

    function displayResults(data) {
        resultsSection.innerHTML = '';

        if (data.error) {
            showError(data.error);
            return;
        }

        if (!data.results || data.results.length === 0) {
            showError('No results available');
            return;
        }

        data.results.forEach(result => {
            const resultCard = document.createElement('div');
            resultCard.className = 'result-card';

            if (result.error) {
                resultCard.innerHTML = `
                    <div class="error-section">
                        <h3>Error Processing ${result.filename}</h3>
                        <p class="error-message">${result.error}</p>
                    </div>
                `;
                resultsSection.appendChild(resultCard);
                return;
            }

            // Header with filename and match percentage
            const matchScore = parseInt(result.match_percentage) || 0;
            const scoreColor = matchScore >= 75 ? '#10b981' : matchScore >= 50 ? '#f59e0b' : '#ef4444';
            
            const header = document.createElement('div');
            header.className = 'result-header';
            header.innerHTML = `
                <h3>${result.filename}</h3>
                <div class="match-score" style="background-color: ${scoreColor}20; color: ${scoreColor}">
                    <i class="fas fa-percentage"></i>
                    ${matchScore}% Match
                </div>
            `;
            resultCard.appendChild(header);

            // ATS Score
            const atsScore = parseInt(result.ats_friendly_score) || 0;
            const atsSection = document.createElement('div');
            atsSection.className = 'result-section';
            atsSection.innerHTML = `
                <h4>ATS Optimization Score</h4>
                <div class="progress-bar">
                    <div class="progress" style="width: ${atsScore}%"></div>
                    <span>${atsScore}/100</span>
                </div>
                <p class="score-label">${getATSScoreLabel(atsScore)}</p>
            `;
            resultCard.appendChild(atsSection);

            // Add other sections (matches, requirements, skills, etc.)
            if (result.key_matches && result.key_matches.length > 0) {
                const matchesSection = document.createElement('div');
                matchesSection.className = 'result-section';
                matchesSection.innerHTML = `
                    <h4>Key Matches</h4>
                    <ul class="tag-list">
                        ${result.key_matches.map(match => `
                            <li class="tag success"><i class="fas fa-check"></i>${match}</li>
                        `).join('')}
                    </ul>
                `;
                resultCard.appendChild(matchesSection);
            }

            if (result.missing_critical_requirements && result.missing_critical_requirements.length > 0) {
                const missingSection = document.createElement('div');
                missingSection.className = 'result-section';
                missingSection.innerHTML = `
                    <h4>Missing Requirements</h4>
                    <ul class="tag-list">
                        ${result.missing_critical_requirements.map(req => `
                            <li class="tag warning"><i class="fas fa-exclamation-triangle"></i>${req}</li>
                        `).join('')}
                    </ul>
                `;
                resultCard.appendChild(missingSection);
            }

            // Overall Assessment
            if (result.overall_assessment) {
                const assessmentSection = document.createElement('div');
                assessmentSection.className = 'result-section';
                assessmentSection.innerHTML = `
                    <h4>Overall Assessment</h4>
                    <p class="assessment-text">${result.overall_assessment}</p>
                `;
                resultCard.appendChild(assessmentSection);
            }

            resultsSection.appendChild(resultCard);
        });

        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    function getATSScoreLabel(score) {
        if (score >= 80) return 'Excellent ATS Optimization';
        if (score >= 60) return 'Good ATS Optimization';
        if (score >= 40) return 'Fair ATS Optimization';
        return 'Needs ATS Optimization';
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        const container = document.querySelector('.main-content');
        container.insertBefore(errorDiv, container.firstChild);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
});
