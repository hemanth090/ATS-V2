# ATS Resume Analyzer

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-blue.svg)](https://www.docker.com/)
[![Groq](https://img.shields.io/badge/AI-Groq-orange.svg)](https://groq.com/)

## Overview

**ATS Resume Analyzer** is a Flask-based web application that helps job seekers evaluate their resumes against job descriptions using AI. The application uses the Groq API to provide detailed analysis and matching scores between resumes and job descriptions.

## Demo

The application provides:
- Resume analysis with AI-powered feedback
- ATS compatibility scoring
- Skill gap analysis
- Detailed recommendations for improvement

![Image](https://github.com/user-attachments/assets/2fc94000-70f5-4450-9bf5-c3c143630fd0)

## Features

- **Resume Analysis**: Upload PDF resumes for AI-powered analysis
- **Job Description Matching**: Compare resumes against specific job descriptions
- **Percentage Match**: Get detailed matching scores
- **Multiple Analysis Types**: Choose between quick match or detailed analysis
- **Web Interface**: User-friendly interface for easy interaction

## Prerequisites

- Docker Desktop
- ngrok (for exposing the application)
- Groq API key

## Technology Stack

- **Backend**: Python Flask
- **PDF Processing**: PyPDF2, pdfplumber
- **AI Model**: Groq API with deepseek-r1-distill-llama-70b
  - Temperature: 0.1 (for consistent outputs)
  - Max Tokens: 2000
  - Top P: 0.95
- **Containerization**: Docker
- **Tunnel Service**: ngrok

## AI Features

- **Resume Analysis**: Uses deepseek-r1-distill-llama-70b model for accurate resume parsing
- **Matching Algorithm**: AI-powered comparison between resume and job description
- **Scoring System**: 
  - Match Percentage: How well the resume matches job requirements
  - ATS Score: Resume's compatibility with ATS systems
  - Key Matches: Identified matching skills and qualifications
  - Missing Requirements: Gaps in qualifications
- **Detailed Assessment**: Comprehensive analysis of resume strengths and weaknesses

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/hemanth090/ATS-V2.git
   cd ATS-V2
   ```

2. **Configure Environment**:
   Create a `.env` file with:
   ```env
   FLASK_APP=app_web.py
   FLASK_ENV=production
   FLASK_DEBUG=0
   GROQ_API_KEY=your_groq_api_key_here
   ```

3. **Install ngrok**:
   - Download from: https://ngrok.com/download
   - Extract to a folder (e.g., `C:\ngrok`)
   - Sign up and configure authtoken:
     ```bash
     ngrok config add-authtoken YOUR_AUTH_TOKEN
     ```

## Running the Application

### Using Docker

1. **Build Docker Image**:
   ```bash
   docker build -t ats-app .
   ```

2. **Run Container**:
   ```bash
   docker run -d -p 5000:5000 ats-app
   ```

### Exposing with ngrok

1. **Start ngrok tunnel**:
   ```bash
   ngrok http --region=in 5000
   ```

2. **Access the application**:
   - Local: http://localhost:5000
   - Public: Use the URL provided by ngrok
   - Monitor: http://127.0.0.1:4040 (ngrok web interface)

### Stopping the Application

1. **Stop Docker container**:
   ```bash
   docker stop ats-app
   docker rm ats-app
   ```

2. **Stop ngrok**:
   - Press Ctrl+C in ngrok terminal, or
   - Run: `taskkill /F /IM ngrok.exe`

## Usage

1. Access the application through your browser
2. Upload a PDF resume
3. Enter the job description
4. Choose analysis type:
   - Quick Match: For percentage match score
   - Detailed Analysis: For comprehensive feedback
5. View the analysis results

## Monitoring

- View Docker container status: `docker ps`
- Monitor ngrok traffic: http://127.0.0.1:4040
- Check container logs: `docker logs ats-app`

## Security Notes

- Keep your Groq API key secure
- Don't commit the `.env` file
- Use HTTPS URLs provided by ngrok
- Monitor ngrok dashboard for suspicious activity

## Troubleshooting

1. **If Docker container fails**:
   ```bash
   docker logs ats-app
   ```

2. **If ngrok doesn't connect**:
   - Verify container is running on port 5000
   - Check ngrok authentication
   - Restart ngrok with `--region=in` flag

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/improvement`)
3. Make your changes
4. Commit your changes (`git commit -am 'Add new feature'`)
5. Push to the branch (`git push origin feature/improvement`)
6. Create a Pull Request

## Contact

- **Developer**: Hemanth Kokkonda
- **Email**: naveenhemanth4@gmail.com
- **LinkedIn**: [hemanthkokkonda](https://www.linkedin.com/in/hemanthkokkonda/)
- **GitHub**: [hemanth090](https://github.com/hemanth090)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2024-2025 Hemanth Kokkonda
