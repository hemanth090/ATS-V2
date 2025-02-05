from flask import Flask, render_template, request, jsonify
import os
import sys
import tempfile
from werkzeug.utils import secure_filename
import json
from PyPDF2 import PdfReader
import io
from groq import Groq
import pdfplumber
import subprocess
import logging
from typing import Optional, Dict, Any, List

# Configure logging
logging.basicConfig(level=logging.DEBUG,
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = tempfile.gettempdir()  # Use system temp directory

# Initialize Groq client
try:
    client = Groq(api_key="")
except Exception as e:
    logger.error(f"Failed to initialize Groq client: {str(e)}")
    sys.exit(1)

def extract_text_with_pdfplumber(file_path: str) -> str:
    """Extract text using pdfplumber"""
    try:
        with pdfplumber.open(file_path) as pdf:
            text = []
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text.append(page_text)
            return "\n\n".join(text).strip()
    except Exception as e:
        logger.error(f"pdfplumber extraction failed: {str(e)}", exc_info=True)
        return ""

def extract_text_with_pypdf(file_path: str) -> str:
    """Extract text using PyPDF2"""
    try:
        with open(file_path, 'rb') as file:
            reader = PdfReader(file)
            text = []
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text.append(page_text)
            return "\n\n".join(text).strip()
    except Exception as e:
        logger.error(f"PyPDF2 extraction failed: {str(e)}", exc_info=True)
        return ""

def save_uploaded_file(file) -> Optional[str]:
    """Save uploaded file to temporary location"""
    try:
        if not file or not file.filename:
            return None
            
        filename = secure_filename(file.filename)
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # Save the file
        file.save(temp_path)
        
        # Verify file exists and is readable
        if not os.path.exists(temp_path):
            logger.error(f"File not saved: {temp_path}")
            return None
            
        if not os.access(temp_path, os.R_OK):
            logger.error(f"File not readable: {temp_path}")
            return None
            
        return temp_path
        
    except Exception as e:
        logger.error(f"Error saving uploaded file: {str(e)}", exc_info=True)
        return None

def extract_text_from_pdf(file) -> Optional[str]:
    """
    Extract text from PDF using multiple methods as fallback
    Returns None if all methods fail
    """
    try:
        # Save file to temporary location
        temp_path = save_uploaded_file(file)
        if not temp_path:
            logger.error("Failed to save uploaded file")
            return None

        try:
            # Try different extraction methods
            text = ""
            
            # Method 1: pdfplumber
            text = extract_text_with_pdfplumber(temp_path)
            if text:
                logger.info("Successfully extracted text using pdfplumber")
                logger.debug(f"Extracted text (first 200 chars): {text[:200]}")
                return text

            # Method 2: PyPDF2
            text = extract_text_with_pypdf(temp_path)
            if text:
                logger.info("Successfully extracted text using PyPDF2")
                logger.debug(f"Extracted text (first 200 chars): {text[:200]}")
                return text

            logger.error("All PDF text extraction methods failed")
            return None

        finally:
            # Clean up temporary file
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            except Exception as e:
                logger.error(f"Failed to remove temporary file: {str(e)}", exc_info=True)

    except Exception as e:
        logger.error(f"PDF text extraction failed: {str(e)}", exc_info=True)
        return None

def get_percentage_match_prompt(job_description: str, resume_text: str) -> str:
    """Generate prompt for percentage match analysis"""
    return f"""You are an expert ATS (Applicant Tracking System) analyzer. Analyze the resume against the job description and provide detailed feedback.

Job Description:
{job_description}

Resume Text:
{resume_text}

Provide a detailed analysis in the following JSON format:
{{
    "match_percentage": <0-100 score based on overall match>,
    "ats_friendly_score": <0-100 score based on resume format and readability>,
    "key_matches": [
        {{
            "skill": "<matched skill>",
            "context": "<how it appears in resume>",
            "relevance": "<high/medium/low>"
        }}
    ],
    "missing_critical_requirements": [
        {{
            "requirement": "<missing requirement>",
            "importance": "<critical/recommended>",
            "suggestion": "<how to address this>"
        }}
    ],
    "format_suggestions": [
        {{
            "section": "<section name>",
            "issue": "<what needs improvement>",
            "recommendation": "<how to improve it>"
        }}
    ],
    "keyword_optimization": [
        {{
            "current": "<current phrase>",
            "suggested": "<better keyword>",
            "reason": "<why this would be better>"
        }}
    ],
    "industry_insights": [
        {{
            "trend": "<industry trend>",
            "relevance": "<why it matters>",
            "action_item": "<what to do about it>"
        }}
    ],
    "overall_assessment": "<detailed paragraph about overall fit>",
    "improvement_priorities": [
        {{
            "priority": "<what to improve>",
            "impact": "<expected impact>",
            "timeframe": "<how urgent>"
        }}
    ]
}}

Focus on providing actionable insights and industry-specific recommendations. Be specific and detailed in your analysis."""

def parse_structured_response(response_text: str) -> Dict[str, Any]:
    """Parse structured text response into JSON format"""
    try:
        # Initialize default values
        result = {
            'match_percentage': '0',
            'key_matches': [],
            'missing_critical_requirements': [],
            'ats_friendly_score': '0',
            'overall_assessment': 'Analysis not available'
        }
        
        # Split response into sections
        sections = response_text.split('\n')
        current_section = None
        
        for line in sections:
            line = line.strip()
            if not line:
                continue
                
            if line.startswith('MATCH PERCENTAGE:'):
                try:
                    result['match_percentage'] = str(int(line.split(':')[1].strip()))
                except:
                    pass
            elif line.startswith('ATS SCORE:'):
                try:
                    result['ats_friendly_score'] = str(int(line.split(':')[1].strip()))
                except:
                    pass
            elif line == 'KEY MATCHES:':
                current_section = 'key_matches'
            elif line == 'MISSING REQUIREMENTS:':
                current_section = 'missing_requirements'
            elif line == 'OVERALL ASSESSMENT:':
                current_section = 'assessment'
            elif line.startswith('- ') and current_section in ['key_matches', 'missing_requirements']:
                item = line[2:].strip()
                if current_section == 'key_matches':
                    result['key_matches'].append(item)
                else:
                    result['missing_critical_requirements'].append(item)
            elif current_section == 'assessment':
                result['overall_assessment'] = line.strip()
        
        return result
    except Exception as e:
        logger.error(f"Failed to parse structured response: {str(e)}")
        return None

def process_resume_analysis(job_description: str, resume_text: str, prompt_type: str = 'percentage_match') -> Dict[str, Any]:
    """Process resume analysis using Groq API"""
    try:
        # Validate inputs
        if not job_description or not resume_text:
            return {'error': 'Missing job description or resume text'}

        # Get appropriate prompt
        if prompt_type == 'percentage_match':
            prompt = get_percentage_match_prompt(job_description, resume_text)
        else:
            return {'error': 'Invalid prompt type'}

        logger.info("Sending prompt to API...")

        # Call Groq API
        try:
            completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a resume analyzer. Follow the format exactly as requested."},
                    {"role": "user", "content": prompt}
                ],
                model="deepseek-r1-distill-llama-70b",
                temperature=0.1,
                max_tokens=2000,
                top_p=0.95
            )
            
            logger.info("Received response from API")
            response_text = completion.choices[0].message.content
            logger.info(f"Raw API response: {response_text}")

            if not response_text:
                logger.error("Empty response from API")
                return {'error': 'Empty response from API'}

            # Parse the structured response
            result = parse_structured_response(response_text)
            if result is None:
                return {'error': 'Failed to parse API response'}

            return result

        except Exception as e:
            logger.error(f"API call or processing failed: {str(e)}")
            return {'error': f'API call failed: {str(e)}'}

    except Exception as e:
        logger.error(f"Resume analysis failed: {str(e)}")
        return {'error': f'Analysis failed: {str(e)}'}

def analyze_resume(resume_text, job_description):
    try:
        client = Groq(api_key="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")
        
        # Prepare the prompt
        system_prompt = """You are an expert ATS (Applicant Tracking System) analyzer. 
        Analyze the resume against the job description and provide a structured JSON response with the following fields:
        {
            "match_percentage": number (0-100),
            "ats_friendly_score": number (0-100),
            "key_matches": [list of matching skills/qualifications],
            "missing_critical_requirements": [list of missing important requirements],
            "overall_assessment": "detailed assessment text"
        }
        IMPORTANT: Your response must be valid JSON. Do not include any text before or after the JSON."""
        
        user_prompt = f"""Resume Content:
        {resume_text}
        
        Job Description:
        {job_description}
        
        Analyze the resume against the job description and provide the analysis in the specified JSON format.
        Remember: Your response must be ONLY the JSON object, nothing else."""
        
        # Make API call with DeepSeek model
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="deepseek-r1-distill-llama-70b",
            temperature=0.6,
            top_p=0.95,
            max_tokens=2000
        )
        
        # Parse the response into structured data
        response_text = response.choices[0].message.content.strip()
        
        # Try to clean up the response if it's not pure JSON
        if not response_text.startswith('{'):
            # Find the first '{' and last '}'
            start = response_text.find('{')
            end = response_text.rfind('}')
            if start != -1 and end != -1:
                response_text = response_text[start:end+1]
        
        try:
            # Try to parse as JSON
            import json
            structured_data = json.loads(response_text)
            
            # Ensure all required fields exist and have correct types
            default_data = {
                "match_percentage": 0,
                "ats_friendly_score": 0,
                "key_matches": [],
                "missing_critical_requirements": [],
                "overall_assessment": ""
            }
            
            # Convert and validate each field
            result = {}
            for key, default_value in default_data.items():
                value = structured_data.get(key, default_value)
                
                # Handle type conversions
                if key in ['match_percentage', 'ats_friendly_score']:
                    try:
                        value = int(float(value))  # Convert to float first to handle percentage strings
                        value = max(0, min(100, value))  # Clamp between 0 and 100
                    except (ValueError, TypeError):
                        value = default_value
                elif key in ['key_matches', 'missing_critical_requirements']:
                    if not isinstance(value, list):
                        value = []
                elif key == 'overall_assessment':
                    if not isinstance(value, str):
                        value = str(value)
                
                result[key] = value
            
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {response_text}")
            logger.error(f"JSON parsing error: {str(e)}")
            return {
                "match_percentage": 0,
                "ats_friendly_score": 0,
                "key_matches": [],
                "missing_critical_requirements": [],
                "overall_assessment": response_text
            }
        
    except Exception as e:
        logger.error(f"Error in resume analysis: {str(e)}")
        return {
            "match_percentage": 0,
            "ats_friendly_score": 0,
            "key_matches": [],
            "missing_critical_requirements": [],
            "overall_assessment": f"Error analyzing resume: {str(e)}"
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    """Handle resume analysis requests"""
    try:
        # Get job description
        job_description = request.form.get('jobDescription', '').strip()
        if not job_description:
            return jsonify({'error': 'Job description is required'}), 400

        # Check for uploaded files
        files = request.files.getlist('files[]')
        if not files:
            return jsonify({'error': 'No files uploaded'}), 400

        if all(not file.filename for file in files):
            return jsonify({'error': 'No files selected'}), 400

        # Process each file
        results = []
        for file in files:
            if not file.filename:
                continue

            if not file.filename.lower().endswith('.pdf'):
                results.append({
                    'filename': file.filename,
                    'error': 'Only PDF files are supported'
                })
                continue

            try:
                # Extract text from PDF
                pdf_content = extract_text_from_pdf(file)
                if not pdf_content:
                    results.append({
                        'filename': file.filename,
                        'error': 'Could not extract text from PDF. Please make sure the PDF is not password protected and contains extractable text.'
                    })
                    continue

                # Log the extracted content for debugging
                logger.debug(f"Extracted text from {file.filename}: {pdf_content[:200]}...")  # Log first 200 chars

                # Analyze resume
                analysis = analyze_resume(pdf_content, job_description)
                logger.info(f"Analysis result for {file.filename}: {analysis}")
                
                # Handle error cases
                if isinstance(analysis, str) and 'error' in analysis.lower():
                    results.append({
                        'filename': file.filename,
                        'error': analysis
                    })
                    continue
                
                # Handle successful analysis
                if isinstance(analysis, dict):
                    result = {
                        'filename': file.filename,
                        'match_percentage': analysis.get('match_percentage', 0),
                        'ats_friendly_score': analysis.get('ats_friendly_score', 0),
                        'key_matches': analysis.get('key_matches', []),
                        'missing_critical_requirements': analysis.get('missing_critical_requirements', []),
                        'overall_assessment': analysis.get('overall_assessment', '')
                    }
                else:
                    result = {
                        'filename': file.filename,
                        'error': f'Invalid analysis format: {str(analysis)}'
                    }
                
                results.append(result)
                logger.info(f"Final result for {file.filename}: {result}")

            except Exception as e:
                logger.error(f"Error processing file {file.filename}: {str(e)}", exc_info=True)  # Added exc_info for full traceback
                results.append({
                    'filename': file.filename,
                    'error': f'Error processing PDF: {str(e)}'
                })

        if not results:
            return jsonify({'error': 'No valid PDF files processed'}), 400

        response_data = {'results': results}
        logger.info(f"Final response: {response_data}")
        return jsonify(response_data)

    except Exception as e:
        logger.error(f"Error in analyze route: {str(e)}", exc_info=True)  # Added exc_info for full traceback
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
