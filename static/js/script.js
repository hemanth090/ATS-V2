document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const jobDescription = document.getElementById('jobDescription');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loadingOverlay = document.querySelector('.loading-overlay');
    const resultsSection = document.getElementById('results');

    // Help Modal
    const helpButton = document.getElementById('helpButton');
    const helpModal = document.getElementById('helpModal');
    const closeHelp = document.getElementById('closeHelp');

    function toggleHelpModal() {
        helpModal.classList.toggle('active');
    }

    helpButton.addEventListener('click', toggleHelpModal);
    closeHelp.addEventListener('click', toggleHelpModal);

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

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Don't trigger shortcuts if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        // Show/Hide Help Modal
        if (e.key === '?') {
            toggleHelpModal();
        }

        // Close Help Modal
        if (e.key === 'Escape' && helpModal.classList.contains('active')) {
            toggleHelpModal();
        }

        // Toggle Theme
        if (e.key === 't' || e.key === 'T') {
            document.getElementById('themeToggle').click();
        }

        // Upload Resume (Ctrl + U)
        if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
            e.preventDefault();
            document.querySelector('input[type="file"]').click();
        }

        // Analyze Resume (Ctrl + Enter)
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            document.querySelector('button[type="submit"]').click();
        }

        // Clear Form (Ctrl + D)
        if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
            e.preventDefault();
            document.querySelector('textarea').value = '';
            document.querySelector('input[type="file"]').value = '';
            const resultsContainer = document.getElementById('resultsContainer');
            if (resultsContainer) {
                resultsContainer.innerHTML = '';
            }
        }
    });

    // Update loading status messages
    const statusMessages = [
        'Analyzing Resume...',
        'Extracting Key Skills...',
        'Matching with Job Description...',
        'Calculating Match Score...',
        'Generating Recommendations...'
    ];

    let messageIndex = 0;
    function updateLoadingMessage() {
        const statusElement = document.querySelector('.status-message');
        if (statusElement) {
            statusElement.textContent = statusMessages[messageIndex];
            messageIndex = (messageIndex + 1) % statusMessages.length;
        }
    }

    // Update loading message every 2 seconds during analysis
    function startLoadingMessages() {
        messageIndex = 0;
        updateLoadingMessage();
        return setInterval(updateLoadingMessage, 2000);
    }

    function showLoadingOverlay() {
        const overlay = document.querySelector('.loading-overlay');
        overlay.style.display = 'flex';
        return startLoadingMessages();
    }

    function hideLoadingOverlay(intervalId) {
        const overlay = document.querySelector('.loading-overlay');
        overlay.style.display = 'none';
        clearInterval(intervalId);
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

        const intervalId = showLoadingOverlay();
        
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
            hideLoadingOverlay(intervalId);
        }
    });

    // Display results in a modern, interactive format
    function displayResults(results) {
        const resultsSection = document.getElementById('results');
        resultsSection.innerHTML = ''; // Clear previous results

        results.forEach(result => {
            if (result.error) {
                showError(`Error analyzing ${result.filename}: ${result.error}`);
                return;
            }

            // Create results grid
            const resultsGrid = document.createElement('div');
            resultsGrid.className = 'results-grid';

            // Score Cards
            const scoreCards = createScoreCards(result);
            resultsGrid.appendChild(scoreCards);

            // Key Matches
            if (result.key_matches) {
                const matchesCard = createMatchesCard(result.key_matches);
                resultsGrid.appendChild(matchesCard);
            }

            // Missing Requirements
            if (result.missing_critical_requirements) {
                const missingCard = createMissingCard(result.missing_critical_requirements);
                resultsGrid.appendChild(missingCard);
            }

            // Format Suggestions
            if (result.format_suggestions) {
                const formatCard = createFormatCard(result.format_suggestions);
                resultsGrid.appendChild(formatCard);
            }

            // Keyword Optimization
            if (result.keyword_optimization) {
                const keywordCard = createKeywordCard(result.keyword_optimization);
                resultsGrid.appendChild(keywordCard);
            }

            // Industry Insights
            if (result.industry_insights) {
                const insightsCard = createInsightsCard(result.industry_insights);
                resultsGrid.appendChild(insightsCard);
            }

            // Improvement Plan
            if (result.improvement_priorities) {
                const planCard = createPlanCard(result.improvement_priorities);
                resultsGrid.appendChild(planCard);
            }

            // Overall Assessment
            if (result.overall_assessment) {
                const assessmentCard = createAssessmentCard(result.overall_assessment);
                resultsGrid.appendChild(assessmentCard);
            }

            resultsSection.appendChild(resultsGrid);
        });

        // Animate score rings
        animateScoreRings();
    }

    // Create circular progress indicators for scores
    function createScoreCards(result) {
        const scoreCards = document.createElement('div');
        scoreCards.className = 'score-cards';

        // Match Score
        const matchScore = document.createElement('div');
        matchScore.className = 'score-card match-score';
        matchScore.innerHTML = `
            <div class="score-circle">
                <svg class="progress-ring" viewBox="0 0 120 120">
                    <circle class="progress-ring-circle" cx="60" cy="60" r="54" 
                        stroke-dasharray="339.292" stroke-dashoffset="339.292"/>
                </svg>
                <span class="score-value">${result.match_percentage}%</span>
            </div>
            <h3>Match Score</h3>
        `;

        // ATS Score
        const atsScore = document.createElement('div');
        atsScore.className = 'score-card ats-score';
        atsScore.innerHTML = `
            <div class="score-circle">
                <svg class="progress-ring" viewBox="0 0 120 120">
                    <circle class="progress-ring-circle" cx="60" cy="60" r="54" 
                        stroke-dasharray="339.292" stroke-dashoffset="339.292"/>
                </svg>
                <span class="score-value">${result.ats_friendly_score}%</span>
            </div>
            <h3>ATS Score</h3>
        `;

        scoreCards.appendChild(matchScore);
        scoreCards.appendChild(atsScore);
        return scoreCards;
    }

    // Animate score ring progress
    function animateScoreRings() {
        const circles = document.querySelectorAll('.progress-ring-circle');
        const circumference = 2 * Math.PI * 54; // 2πr where r=54

        circles.forEach(circle => {
            const scoreValue = parseInt(circle.closest('.score-card').querySelector('.score-value').textContent);
            const offset = circumference - (scoreValue / 100 * circumference);
            
            // Trigger animation
            setTimeout(() => {
                circle.style.strokeDashoffset = offset;
            }, 100);
        });
    }

    // Create card for key matches
    function createMatchesCard(matches) {
        const card = document.createElement('div');
        card.className = 'analysis-card key-matches';
        
        const matchesHtml = matches.map(match => `
            <div class="match-item">
                <div class="skill">${match.skill}</div>
                <div class="context">${match.context}</div>
                <span class="relevance relevance-${match.relevance.toLowerCase()}">${match.relevance}</span>
            </div>
        `).join('');

        card.innerHTML = `
            <h3><i class="fas fa-check-circle"></i> Key Matches</h3>
            <div class="matches-grid">${matchesHtml}</div>
        `;

        return card;
    }

    // Create card for missing requirements
    function createMissingCard(missing) {
        const card = document.createElement('div');
        card.className = 'analysis-card missing-reqs';
        
        const missingHtml = missing.map(item => `
            <div class="missing-item">
                <div class="requirement">${item.requirement}</div>
                <span class="importance importance-${item.importance.toLowerCase()}">${item.importance}</span>
                <div class="suggestion">${item.suggestion}</div>
            </div>
        `).join('');

        card.innerHTML = `
            <h3><i class="fas fa-exclamation-triangle"></i> Missing Requirements</h3>
            <div class="missing-grid">${missingHtml}</div>
        `;

        return card;
    }

    // Create card for format suggestions
    function createFormatCard(suggestions) {
        const card = document.createElement('div');
        card.className = 'analysis-card format-suggestions';
        
        const suggestionsHtml = suggestions.map(suggestion => `
            <div class="suggestion-item">
                <div class="section">${suggestion.section}</div>
                <div class="issue">${suggestion.issue}</div>
                <div class="recommendation">${suggestion.recommendation}</div>
            </div>
        `).join('');

        card.innerHTML = `
            <h3><i class="fas fa-file-alt"></i> Format Improvements</h3>
            <div class="suggestions-list">${suggestionsHtml}</div>
        `;

        return card;
    }

    // Create card for keyword optimization
    function createKeywordCard(keywords) {
        const card = document.createElement('div');
        card.className = 'analysis-card keyword-optimization';
        
        const keywordsHtml = keywords.map(keyword => `
            <div class="keyword-item">
                <span class="current">${keyword.current}</span>
                <span class="suggested">${keyword.suggested}</span>
                <div class="reason">${keyword.reason}</div>
            </div>
        `).join('');

        card.innerHTML = `
            <h3><i class="fas fa-magic"></i> Keyword Optimization</h3>
            <div class="keywords-grid">${keywordsHtml}</div>
        `;

        return card;
    }

    // Create card for industry insights
    function createInsightsCard(insights) {
        const card = document.createElement('div');
        card.className = 'analysis-card industry-insights';
        
        const insightsHtml = insights.map(insight => `
            <div class="insight-item">
                <div class="trend">${insight.trend}</div>
                <div class="relevance">${insight.relevance}</div>
                <div class="action-item">${insight.action_item}</div>
            </div>
        `).join('');

        card.innerHTML = `
            <h3><i class="fas fa-lightbulb"></i> Industry Insights</h3>
            <div class="insights-list">${insightsHtml}</div>
        `;

        return card;
    }

    // Create card for improvement plan
    function createPlanCard(priorities) {
        const card = document.createElement('div');
        card.className = 'analysis-card improvement-plan';
        
        const planHtml = priorities.map(priority => `
            <div class="timeline-item">
                <div class="priority">${priority.priority}</div>
                <div class="impact">${priority.impact}</div>
                <span class="timeframe">${priority.timeframe}</span>
            </div>
        `).join('');

        card.innerHTML = `
            <h3><i class="fas fa-tasks"></i> Action Plan</h3>
            <div class="plan-timeline">${planHtml}</div>
        `;

        return card;
    }

    // Create card for overall assessment
    function createAssessmentCard(assessment) {
        const card = document.createElement('div');
        card.className = 'analysis-card overall-assessment';
        
        card.innerHTML = `
            <h3><i class="fas fa-chart-line"></i> Overall Assessment</h3>
            <p class="assessment-text">${assessment}</p>
        `;

        return card;
    }
});
