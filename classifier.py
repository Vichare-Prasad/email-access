# import os
# import base64
# import hashlib
# import json
# import pandas as pd
# import pdfplumber
# import re
# from datetime import datetime, timedelta
# # from google.auth.transport.requests import Request
# # from google.oauth2.credentials import Credentials
# # from google_auth_oauthlib.flow import InstalledAppFlow
# # from googleapiclient.discovery import build
# from collections import defaultdict
# import io
# import csv
# import zipfile  # ADDED: For zip file extraction
# import tempfile
# import xml.etree.ElementTree as ET


# def _extract_structured_data(pdf):
#     """Internal function to extract structured data from already opened PDF"""
#     structured_data = {
#         'tables': [],
#         'text_blocks': [],
#         'transaction_lines': [],
#         'header_sections': []
#     }
    
#     # ONLY PROCESS FIRST PAGE for speed
#     if len(pdf.pages) > 0:
#         page = pdf.pages[0]  # First page only
        
#         # Method 1: Extract tables with multiple strategies
#         table_strategies = [
#             {'vertical_strategy': 'lines', 'horizontal_strategy': 'lines'},
#             {'vertical_strategy': 'text', 'horizontal_strategy': 'text'},
#         ]
        
#         for strategy in table_strategies:
#             try:
#                 tables = page.extract_tables(strategy)
#                 if tables:
#                     for table in tables:
#                         if table and any(any(cell and str(cell).strip() for cell in row) for row in table):
#                             structured_data['tables'].append({
#                                 'page': 1,
#                                 'data': table,
#                                 'strategy': str(strategy)
#                             })
#             except Exception as e:
#                 continue
        
#         # Method 2: Extract text with layout preservation
#         text = page.extract_text()
#         if text:
#             lines = text.split('\n')
            
#             # Identify header sections (usually top of page)
#             header_keywords = ['statement', 'account', 'balance', 'period', 'date','description', 'narration','cheque','transaction',
#                                'value date','credit','debit','perticulars','ref no', 'opening balance','closing balance','withdrawal amt','deposit amt',
#                                'transaction','txn','value date']
#             header_lines = []
#             for i, line in enumerate(lines[:10]):
#                 if any(keyword in line.lower() for keyword in header_keywords):
#                     header_lines.append(line)
            
#             if header_lines:
#                 structured_data['header_sections'].extend(header_lines)
            
#             # Identify transaction-like lines
#             transaction_lines = []
#             for line in lines:
#                 line_clean = line.strip()
#                 if len(line_clean) < 5:
#                     continue
                    
#                 # Transaction patterns
#                 has_date = re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', line_clean)
#                 has_amount = re.search(r'[₹Rs\.\$\€\£]?\s*[0-9,]+\.?[0-9]{0,2}', line_clean)
#                 has_debit_credit = re.search(r'\b(DR|CR|Dr|Cr|debit|credit|withdrawal|deposit|balance)\b', line_clean, re.IGNORECASE)
                
#                 if (has_date and has_amount) or (has_amount and has_debit_credit) or (has_date and len(line_clean) > 20):
#                     transaction_lines.append({
#                         'line': line_clean,
#                         'page': 1,
#                         'has_date': bool(has_date),
#                         'has_amount': bool(has_amount)
#                     })
            
#             structured_data['transaction_lines'].extend(transaction_lines)
    
#     return structured_data

# def extract_structured_data_from_pdf(pdf_path):
#     """Extract structured data from FIRST PAGE ONLY for speed, handles password-protected PDFs"""
#     try:
#         # First try to open without password
#         try:
#             with pdfplumber.open(pdf_path) as pdf:
#                 return _extract_structured_data(pdf)
#         except Exception as e:
#             if "password" in str(e).lower() or "encrypted" in str(e).lower():
#                 print(f"PDF is password protected: {os.path.basename(pdf_path)}")
                
#                 # Extract filename to get potential passwords
#                 filename = os.path.basename(pdf_path)
#                 filename_password = extract_password_from_filename(filename)
                
#                 # List of passwords to try
#                 passwords_to_try = []
#                 if filename_password:
#                     passwords_to_try.append(filename_password)
                
#                 # Add common passwords
#                 common_passwords = ['1234', '84252124', '9920192292', '000000', '12345678' , '7879742']
#                 passwords_to_try.extend(common_passwords)
                
#                 # Try opening with passwords
#                 pdf = try_open_pdf_with_passwords(pdf_path, passwords_to_try)
                
#                 if pdf:
#                     try:
#                         result = _extract_structured_data(pdf)
#                         pdf.close()
#                         return result
#                     except Exception as extract_error:
#                         print(f"Error extracting data from password-protected PDF: {extract_error}")
#                         pdf.close()
#                         return {'tables': [], 'text_blocks': [], 'transaction_lines': [], 'header_sections': []}
#                 else:
#                     print(f"❌ Could not open password-protected PDF: {filename}")
#                     return {'tables': [], 'text_blocks': [], 'transaction_lines': [], 'header_sections': []}
#             else:
#                 # Some other error
#                 raise e
                
#     except Exception as e:
#         print(f"Structured data extraction failed: {e}")
#         return {'tables': [], 'text_blocks': [], 'transaction_lines': [], 'header_sections': []}

# def extract_text_from_image_pdf(pdf_path):
#     """Enhanced text extraction for image-based PDFs using pdfplumber with optimized settings"""
#     full_text = ""
    
#     try:
#         print(f"🔍 Starting enhanced text extraction for image PDF...")
#         with pdfplumber.open(pdf_path) as pdf:
#             # Process only first 2 pages for performance
#             for i, page in enumerate(pdf.pages[:2]):
#                 print(f"📄 Processing page {i+1}...")
                
#                 # Method 1: Standard text extraction with different settings
#                 text_settings = [
#                     {},
#                     {"x_tolerance": 2, "y_tolerance": 2},
#                     {"x_tolerance": 5, "y_tolerance": 5}
#                 ]
                
#                 for settings in text_settings:
#                     try:
#                         text = page.extract_text(**settings)
#                         if text and len(text.strip()) > 10:
#                             full_text += f"\n--- Page {i+1} (Settings: {settings}) ---\n{text}"
#                             print(f"✅ Extracted {len(text.strip())} characters with settings {settings}")
#                             break
#                     except Exception as e:
#                         continue
                
#                 # Method 2: Extract tables with multiple strategies
#                 table_strategies = [
#                     {'vertical_strategy': 'lines', 'horizontal_strategy': 'lines'},
#                     {'vertical_strategy': 'text', 'horizontal_strategy': 'text'},
#                     {'vertical_strategy': 'lines', 'horizontal_strategy': 'text'},
#                 ]
                
#                 for strategy in table_strategies:
#                     try:
#                         tables = page.extract_tables(strategy)
#                         if tables:
#                             for table_idx, table in enumerate(tables):
#                                 if table and any(any(cell for cell in row) for row in table):
#                                     table_text = f"\n--- Table {table_idx+1} (Strategy: {strategy}) ---\n"
#                                     for row in table:
#                                         if row and any(cell for cell in row):
#                                             row_text = " | ".join(str(cell) if cell else "" for cell in row)
#                                             table_text += f"{row_text}\n"
#                                     full_text += table_text
#                                     print(f"📊 Extracted table with {len(table)} rows")
#                     except Exception as e:
#                         continue
                
#                 # Method 3: Extract words with positions for layout analysis
#                 try:
#                     words = page.extract_words()
#                     if words:
#                         print(f"📝 Found {len(words)} words on page {i+1}")
#                         # Group words by lines based on vertical position
#                         lines = {}
#                         for word in words:
#                             y_pos = round(word['top'] / 10) * 10  # Group by 10px increments
#                             if y_pos not in lines:
#                                 lines[y_pos] = []
#                             lines[y_pos].append((word['x0'], word['text']))
                        
#                         # Sort by vertical position and then by horizontal position
#                         for y_pos in sorted(lines.keys()):
#                             line_words = sorted(lines[y_pos], key=lambda x: x[0])
#                             line_text = " ".join(word[1] for word in line_words)
#                             full_text += f"\n{line_text}"
#                 except Exception as e:
#                     print(f"⚠️  Word extraction failed: {e}")
                    
#     except Exception as e:
#         print(f"❌ Error in enhanced PDF text extraction: {e}")
    
#     print(f"📄 Total text extracted: {len(full_text.strip())} characters")
#     return full_text

# def _detect_bank_patterns(pdf, pdf_path):
#     """Internal function to detect bank patterns from already opened PDF"""
#     bank_evidence = {
#         'account_number_found': False,
#         'bank_name_found': False,
#         'statement_period_found': False,
#         'transaction_table_found': False,
#         'balance_section_found': False,
#         'transaction_count': 0,
#         'bank_name': None,
#         'account_number': None,
#         'total_score': 0,
#         'currency_found': False,
#         'bank_type': None,
#         'statement_date_found': False,
#         'customer_info_found': False,
#         'has_structured_data': False,
#         'has_bank_specific_patterns': False,
#         'page_count': len(pdf.pages),
#         'file_type': 'pdf',
#         'password_protected': False,
#         'is_image_pdf': False
#     }
    
#     full_text = ""
#     structured_data = extract_structured_data_from_pdf(pdf_path)
    
#     # Score for structured data
#     if (len(structured_data['tables']) > 0 or 
#         len(structured_data['transaction_lines']) > 0):
#         bank_evidence['has_structured_data'] = True
#         bank_evidence['total_score'] += 3
    
#     # Check if this is an image PDF
#     is_image_based = is_image_pdf(pdf_path)
#     bank_evidence['is_image_pdf'] = is_image_based
    
#     if is_image_based:
#         print(f"🖼️  Image-based PDF detected, using enhanced extraction")
#         # Use enhanced extraction for image PDFs
#         full_text = extract_text_from_image_pdf(pdf_path)
        
#         # Give bonus points for image PDFs that still yield text
#         if len(full_text.strip()) > 50:  # Reduced threshold for image PDFs
#             bank_evidence['total_score'] += 3
#             print(f"✅ Image PDF yielded {len(full_text.strip())} characters of text")
#         else:
#             print(f"⚠️  Image PDF yielded only {len(full_text.strip())} characters")
#     else:
#         # ONLY PROCESS FIRST PAGE for speed for regular PDFs
#         if len(pdf.pages) > 0:
#             page = pdf.pages[0]  
#             page_text = page.extract_text() or ""
#             full_text = page_text
#             print(f"📄 Regular PDF - extracted {len(page_text.strip())} characters")
    
#     # BANK NAME Detection - FIRST PAGE ONLY
#     bank_patterns = [
#         (r'hdfc\s+bank', 'HDFC Bank'),
#         (r'icici\s+bank', 'ICICI Bank'),
#         (r'state\s+bank\s+of\s+india', 'State Bank of India'),
#         (r'axis\s+bank', 'Axis Bank'),
#         (r'sbi\s+bank', 'SBI Bank'),
#         (r'kotak\s+(mahindra)?\s*bank', 'Kotak Mahindra Bank'),
#         (r'yes\s+bank', 'Yes Bank'),
#         (r'idfc\s+first', 'IDFC First Bank'),
#         (r'punjab\s+national\s+bank', 'PNB'),
#         (r'bank\s+of\s+baroda', 'Bank of Baroda'),
#         (r'canara\s+bank', 'Canara Bank'),
#         (r'bassein\s+catholic\+bank','bassein catholic'),
#         (r'bharat\s+bank', 'bharat Bank'),
#         (r'BOB\s+bank', 'BOB Bank'),
#         (r'BOI\s+bank', 'BOI Bank'),
#         (r'BOM\s+bank', 'BOM Bank'),
#         (r'CBI\s+bank', 'CBI Bank'),
#         (r'cosmos\s+bank', 'cosmos Bank'),
#         (r'Deustche\s+bank', 'Deustche Bank'),
#         (r'DCB\s+bank', 'DCB Bank'),
#         (r'federal\s+bank', 'federal Bank'),
#         (r'IDBI\s+bank', 'IDBI Bank'),
#         (r'indian\s+bank', 'indian Bank'),
#         (r'indina\s+overseas\s+bank', 'indian overseas Bank'),
#         (r'indusind\s+bank', 'indisind Bank'),
#         (r'jankalyan\s+co-operative\s+bank', 'jankalyan co-operative Bank'),
#         (r'karnataka\s+bank', 'karnataka Bank'),
#         (r'abhyudaya\s+bank', 'abhyudaya Bank'),
#         (r'au\s+bank', 'AU Bank'),
#         (r'bandhan\s+bank', 'Bandhan Bank'),
#         (r'cns\s+bank', 'Cns Bank'),
#         (r'dhanlakshmi\s+bank', 'dhanlakshmi Bank'),
#         (r'karur\s+bank', 'karur Bank'),
#         (r'nnsb\s+bank', 'NNSB Bank'),
#         (r'south\s+indian\s+bank', 'south indian Bank'),
#         (r'suco\s+souharda\s+sahakari\s+bank', 'suco souharda sahakari Bank'),
#         (r'nkgsb\s+bank', 'NKGSB Bank'),
#         (r'pnb\s+bank', 'PNB Bank'),
#         (r'rbl\s+bank', 'RBL Bank'),
#         (r'saraswat\s+bank', 'Saraswat Bank'),
#         (r'shamrao\s+vitthal\s+bank', 'Shamrao vitthal Bank'),
#         (r'surat\s+bank', 'Surat Bank'),
#         (r'vasai\s+vikas\s+bank', 'vasai vikas Bank'),
#         (r'yes\s+bank', 'Yes Bank'),
#     ]
    
#     for pattern, bank_name in bank_patterns:
#         if re.search(pattern, full_text, re.IGNORECASE):
#             bank_evidence['bank_name_found'] = True
#             bank_evidence['bank_name'] = bank_name
#             bank_evidence['total_score'] += 4
#             print(f"✅ Found bank: {bank_name}")
#             break
    
#     # BANK ACCOUNT NUMBER Patterns - FIRST PAGE ONLY
#     account_patterns = [
#         r'account\s*(number|no|#)?\s*:?\s*[0-9xX\*\-]{8,20}',
#         r'a/c\s*(number|no|#)?\s*:?\s*[0-9xX\*\-]{8,20}',
#         r'savings?\s+account\s*:?\s*[0-9xX\-]{8,20}',
#         r'current\s+account\s*:?\s*[0-9xX\-]{8,20}',
#     ]
    
#     for pattern in account_patterns:
#         matches = re.findall(pattern, full_text, re.IGNORECASE)
#         if matches:
#             bank_evidence['account_number_found'] = True
#             bank_evidence['total_score'] += 3
#             print(f"✅ Found account number pattern")
#             break
    
#     # BANK STATEMENT PERIOD Patterns - FIRST PAGE ONLY
#     period_patterns = [
#         r'statement\s*period\s*:?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s*to\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
#         r'period\s*:?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s*to\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
#     ]
    
#     for pattern in period_patterns:
#         if re.search(pattern, full_text, re.IGNORECASE):
#             bank_evidence['statement_period_found'] = True
#             bank_evidence['total_score'] += 3
#             print(f"✅ Found statement period")
#             break
    
#     # BANK TRANSACTION PATTERNS - FIRST PAGE ONLY
#     bank_transaction_indicators = 0
    
#     # Bank-specific transaction headers
#     bank_header_patterns = [
#         r'date\s+narration\s+chq|ref\s+no\s+value\s+date\s+withdrawal\s+deposit\s+balance',#hdfc , kotak
#         r'date\s+narration\s+chq|ref\s+no\s+value\s+date\s+withdrawal\s+amt\s+deposit\s+amt\s+closing\s+balance'
#         r'value\s+date\s+post\s+date\s+description\s+debit\s+credit\s+balance', #HSBC municipal
#         r'date\s+description\s+cheque\s+no\s+DR\s+CR\s+balance',#indian , thane district
#         r'date\s+description\s+cheque\s+no\s+debit\s+credit\s+balance',#karnataka , TJSB , gp parsik ,
#         r'date\s+perticulars\s+chq|ref\s+no\s+debit\s+credit\s+balance', #indian overseas, svc , surat , NNSB , karad
#         r'date\s+perticulars\s+chq|ref\s+no\s+withdrawal\s+deposit\s+balance',#induind ,NKGSB,uco, baroda ,south indian , suco souharda sahakari , 
#         r'txn\s+date\s+particulars\s+debit\s+credit\s+balance',#IDFC
#         r'txn\s+date\s+value\s+date\s+transaction\s+\s+amount\s+DRCR\s+balance\s+branch\s+name',
#         r'txn\s+date\s+value\s+date\s+description\s+\s+debits\s+credits\s+balance', #IDBI , sbi , au , bandhan
#         r'txn\s+date\s+value\s+date\s+perticulars\s+inst\s+no\s+\s+withdrawals\s+deposit\s+balance', #jalgaon
#         r'txn\s+date\s+particulars\s+chq\s+debit\s+credit\s+balance',#yes , thane bharat
#         r'value\s+date\s+details\s+chq\s+no\s+debit\s+credit\s+balance', #CBI
#         r'date\s+transaction\s+perticulars\s+cheque|ref\s+no\s+withdrawal\s+deposit\s+available\s+balance', #cosmos , deustche
#         r'date\s+value\s+date\s+perticulars\s+cheque\s+details\s+\s+withdrawals\s+deposit\s+balance', #federal, SCB
#         r'value\s+date\s+transaction\s+date\s+cheque\s+no\s+withdrawal\s+amount\s+deposit\s+amount\s+balance',#ICICI
#         r'txn\s+no\s+txn\s+date\s+description\s+branch\s+name\s+cheuqe\s+no\s+dr\s+amount\s+cr\s+amount\s+balance'#pnb
#         r'txn\s+date\s+transaction\s+details\s+\s+cheque\s+no\s+\s+value\s+date\s+\s+withdrawal\s+amt\s+deposit\s+amt\s+balance',#RBL
#         r'date\s+perticulars\s+instruments\s+dr\s+amount\s+cr\s+amount\s+total\s+amount',#saraswat ,vasai vikas , abhyudaya , cns
#         r'date\s+remakrs\s+tran\s+id\s+utr\s+number\s+instr\s+id\s+withdrawals\s+deposit\s+balance',#union
#         r'txn\s+date\s+description\s+value\s+date\s+cheque|ref\s+no\s+txn\s+amount',#dhanlakshmi

#     ]
    
#     for pattern in bank_header_patterns:
#         if re.search(pattern, full_text, re.IGNORECASE):
#             bank_transaction_indicators += 3
#             bank_evidence['has_bank_specific_patterns'] = True
#             print(f"✅ Found bank transaction header pattern")
#             break
    
#     # Transaction line patterns - FIRST PAGE ONLY
#     lines = full_text.split('\n')
#     bank_transaction_count = 0
    
#     for line in lines:
#         line_clean = line.strip()
#         if len(line_clean) < 10:
#             continue
            
#         has_date = re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', line_clean)
#         has_amount = re.search(r'[₹Rs\.\$\€\£]?\s*[0-9,]+\.[0-9]{2}', line_clean)
#         has_bank_term = re.search(r'\b(withdrawal|deposit|debit|credit|balance|transfer|payment|amt)\b', line_clean, re.IGNORECASE)
        
#         if (has_date and has_amount) or (has_bank_term and has_amount):
#             bank_transaction_count += 1
    
#     bank_evidence['transaction_count'] = bank_transaction_count
#     print(f"📊 Found {bank_transaction_count} transaction-like lines")
    
#     # Transaction Scoring
#     if bank_evidence['transaction_count'] >= 5:
#         bank_evidence['total_score'] += 6
#         bank_evidence['transaction_table_found'] = True
#     elif bank_evidence['transaction_count'] >= 3:
#         bank_evidence['total_score'] += 4
#         bank_evidence['transaction_table_found'] = True
#     elif bank_evidence['transaction_count'] >= 1:
#         bank_evidence['total_score'] += 2
    
#     # BANK BALANCE Section Detection - FIRST PAGE ONLY
#     balance_patterns = [
#         r'opening\s+balance\s*:?\s*[₹Rs\.]?\s*[0-9,]+\.?[0-9]*',
#         r'closing\s+balance\s*:?\s*[₹Rs\.]?\s*[0-9,]+\.?[0-9]*',
#         r'available\s+balance\s*:?\s*[₹Rs\.]?\s*[0-9,]+\.?[0-9]*',
#     ]
    
#     for pattern in balance_patterns:
#         if re.search(pattern, full_text, re.IGNORECASE):
#             bank_evidence['balance_section_found'] = True
#             bank_evidence['total_score'] += 3
#             print(f"✅ Found balance section")
#             break
    
#     # Banking Keywords - FIRST PAGE ONLY
#     banking_keywords_weighted = {
#         'closing balance': 3, 'opening balance': 3, 'available balance': 2,
#         'cash withdrawal': 2, 'cash deposit': 2, 'deposit': 2,
#         'neft': 2, 'rtgs': 2, 'imps': 2, 'upi': 2,
#         'debit': 2, 'credit': 2, 'withdrawal': 2, 'deposit': 2,'cheque':2,'naration':2,'perticulars':2,
#         'amount':2,'balance':2, 'description':2, 'value date':2, 'txn date':2, 'date':2,
#         'transaction':2, 'instruments':2,'withdrawal amt':3, 'deposit amt':3
#     }
    
#     keyword_score = 0
#     for keyword, weight in banking_keywords_weighted.items():
#         if keyword in full_text.lower():
#             keyword_score += weight
#             print(f"✅ Found banking keyword: {keyword}")
    
#     bank_evidence['total_score'] += min(keyword_score, 6)
    
#     # Currency Detection - FIRST PAGE ONLY
#     currency_patterns = [
#         (r'₹', 2), (r'rs\.', 1), (r'rs ', 1), (r'inr', 1)
#     ]
    
#     for pattern, weight in currency_patterns:
#         if re.search(pattern, full_text, re.IGNORECASE):
#             bank_evidence['currency_found'] = True
#             bank_evidence['total_score'] += weight
#             print(f"✅ Found currency symbol")
#             break
    
#     # Customer Info Detection - FIRST PAGE ONLY
#     customer_patterns = [
#         r'customer\s*(name|id)?\s*:',
#         r'account\s+holder\s*:',
#         r'name\s*:',
#     ]
    
#     for pattern in customer_patterns:
#         if re.search(pattern, full_text, re.IGNORECASE):
#             bank_evidence['customer_info_found'] = True
#             bank_evidence['total_score'] += 2
#             print(f"✅ Found customer info")
#             break
    
#     # Statement Date Detection - FIRST PAGE ONLY
#     statement_date_patterns = [
#         r'statement\s+date\s*:?\s*\d{1,2}[-/]\d{1,2}[-/]\d{2,4}',
#         r'as\s+of\s+\d{1,2}[-/]\d{1,2}[-/]\d{2,4}',
#     ]
    
#     for pattern in statement_date_patterns:
#         if re.search(pattern, full_text, re.IGNORECASE):
#             bank_evidence['statement_date_found'] = True
#             bank_evidence['total_score'] += 2
#             print(f"✅ Found statement date")
#             break
    
#     # Multi-page bonus (still check total pages but don't scan them)
#     if bank_evidence['page_count'] > 1:
#         bank_evidence['total_score'] += 2
    
#     # Cap the total score
#     bank_evidence['total_score'] = max(0, min(bank_evidence['total_score'], 30))
    
#     print(f"🎯 Final bank evidence score: {bank_evidence['total_score']}/30")
#     return bank_evidence

# def is_image_pdf(pdf_path):
#     """Check if PDF is image-based by analyzing text extraction results"""
#     try:
#         with pdfplumber.open(pdf_path) as pdf:
#             if len(pdf.pages) == 0:
#                 return False
            
#             # Check first page for text content
#             first_page = pdf.pages[0]
#             text = first_page.extract_text()
            
#             print(f"📄 PDF Text extraction result: {len(text.strip()) if text else 0} characters")
            
#             # If very little or no text, likely image PDF
#             if not text or len(text.strip()) < 20:  # Reduced threshold for scanned PDFs
#                 print(f"🖼️  Low text content detected, checking for images...")
                
#                 # Check if there are images on the page
#                 if first_page.images:
#                     print(f"🖼️  Found {len(first_page.images)} images on first page")
#                     return True
                
#                 # Additional check: try to extract tables
#                 tables = first_page.extract_tables()
#                 if not tables or all(not table for table in tables):
#                     print(f"🖼️  No tables found, likely image PDF")
#                     return True
#                 else:
#                     print(f"📊 Found {len(tables)} tables")
                    
#             return False
#     except Exception as e:
#         print(f"❌ Error checking if PDF is image-based: {e}")
#         return False

# def extract_password_from_filename(filename):
#     """Extract password from filename - enhanced version"""
#     filename_lower = filename.lower()
    
#     # Remove file extension
#     name_without_ext = os.path.splitext(filename)[0]
    
#     # Pattern 1: Direct password in filename like "password1234" or "pass1234"
#     password_patterns = [
#         r'password[_\s]*([a-zA-Z0-9]{4,})',
#         r'pwd[_\s]*([a-zA-Z0-9]{4,})',
#         r'pass[_\s]*([a-zA-Z0-9]{4,})',
#         r'pw[_\s]*([a-zA-Z0-9]{4,})',
#     ]
    
#     for pattern in password_patterns:
#         match = re.search(pattern, filename_lower)
#         if match:
#             password = match.group(1)
#             print(f"🔑 Found password in filename: {password}")
#             return password
    
#     # Pattern 2: Numbers at the end of filename (4+ digits)
#     number_match = re.search(r'(\d{4,})$', name_without_ext)
#     if number_match:
#         password = number_match.group(1)
#         print(f"🔑 Found numeric password in filename: {password}")
#         return password
    
#     # Pattern 3: Numbers at the beginning of filename
#     number_match_start = re.search(r'^(\d{4,})', name_without_ext)
#     if number_match_start:
#         password = number_match_start.group(1)
#         print(f"🔑 Found numeric password at start of filename: {password}")
#         return password
    
#     # Pattern 4: Numbers in the middle with common separators
#     number_match_middle = re.search(r'[_-](\d{4,})[_-]', name_without_ext)
#     if number_match_middle:
#         password = number_match_middle.group(1)
#         print(f"🔑 Found numeric password in middle of filename: {password}")
#         return password
    
#     print(f"🔍 No password found in filename: {filename}")
#     return None

# def try_open_pdf_with_passwords(pdf_path, passwords_to_try):
#     """
#     Try to open PDF with multiple passwords
#     Returns pdfplumber.PDF object if successful, None otherwise
#     """
#     for password in passwords_to_try:
#         if not password:
#             continue
            
#         try:
#             print(f"Trying password: {password}")
#             pdf = pdfplumber.open(pdf_path, password=password)
#             # Test if we can access the first page
#             if len(pdf.pages) > 0:
#                 _ = pdf.pages[0]
#             print(f"✅ PDF opened successfully with password: {password}")
#             return pdf
#         except Exception as e:
#             if "password" in str(e).lower() or "encrypted" in str(e).lower():
#                 continue  # Wrong password, try next
#             else:
#                 # Some other error, re-raise
#                 raise e
    
#     return None

# def _create_default_bank_evidence(file_type):
#     """Create default bank evidence structure"""
#     return {
#         'account_number_found': False,
#         'bank_name_found': False,
#         'statement_period_found': False,
#         'transaction_table_found': False,
#         'balance_section_found': False,
#         'transaction_count': 0,
#         'bank_name': None,
#         'account_number': None,
#         'total_score': 0,
#         'currency_found': False,
#         'bank_type': None,
#         'statement_date_found': False,
#         'customer_info_found': False,
#         'has_structured_data': False,
#         'has_bank_specific_patterns': False,
#         'page_count': 0,
#         'file_type': file_type,
#         'password_protected': True,
#         'is_image_pdf': False
#     }

# def detect_bank_specific_patterns_pdf(pdf_path):
#     """FAST detection of BANK STATEMENT patterns - FIRST PAGE ONLY, handles password-protected PDFs"""
#     try:
#         # First try to open without password
#         try:
#             with pdfplumber.open(pdf_path) as pdf:
#                 return _detect_bank_patterns(pdf, pdf_path)
#         except Exception as e:
#             if "password" in str(e).lower() or "encrypted" in str(e).lower():
#                 print(f"PDF is password protected: {os.path.basename(pdf_path)}")
                
#                 # Extract filename to get potential passwords
#                 filename = os.path.basename(pdf_path)
#                 filename_password = extract_password_from_filename(filename)
                
#                 # List of passwords to try
#                 passwords_to_try = []
#                 if filename_password:
#                     passwords_to_try.append(filename_password)
                
#                 # Add common passwords
#                 common_passwords = ['1234', '123456', '0000', '000000', 'password', 'user', '12345678']
#                 passwords_to_try.extend(common_passwords)
                
#                 # Try opening with passwords
#                 pdf = try_open_pdf_with_passwords(pdf_path, passwords_to_try)
                
#                 if pdf:
#                     try:
#                         result = _detect_bank_patterns(pdf, pdf_path)
#                         pdf.close()
#                         return result
#                     except Exception as detect_error:
#                         print(f"Error detecting patterns in password-protected PDF: {detect_error}")
#                         pdf.close()
#                         return _create_default_bank_evidence('pdf')
#                 else:
#                     print(f"❌ Could not open password-protected PDF for pattern detection: {filename}")
#                     return _create_default_bank_evidence('pdf')
#             else:
#                 # Some other error
#                 raise e
                
#     except Exception as e:
#         print(f"PDF pattern detection failed: {e}")
#         return _create_default_bank_evidence('pdf')

# # def extract_data_from_excel(file_path):
# #     """Extract data from Excel files with share statement rejection - FIXED for multiple sheets"""
# #     try:
# #         bank_evidence = {
# #             'account_number_found': False,
# #             'bank_name_found': False,
# #             'statement_period_found': False,
# #             'transaction_table_found': False,
# #             'balance_section_found': False,
# #             'transaction_count': 0,
# #             'bank_name': None,
# #             'account_number': None,
# #             'total_score': 0,
# #             'currency_found': False,
# #             'file_type': 'excel'
# #         }
        
# #         # Read Excel file
# #         try:
# #             excel_data = pd.read_excel(file_path, sheet_name=None)
# #         except Exception as e:
# #             print(f"Error reading Excel file: {e}")
# #             return bank_evidence
            
# #         full_text = ""
# #         best_sheet_score = 0
# #         best_sheet_data = None
        
# #         # Process each sheet to find the one with bank statement data
# #         for sheet_name, df in excel_data.items():
# #             print(f"📊 Processing Excel sheet: {sheet_name}")
            
# #             # Convert dataframe to text for pattern matching
# #             sheet_text = df.to_string()
# #             sheet_full_text = sheet_text + "\n"
            
# #             # Create temporary evidence for this sheet
# #             sheet_evidence = detect_bank_patterns_in_text(sheet_full_text, bank_evidence.copy())
            
# #             # Count transaction-like rows in this sheet
# #             if len(df) > 0:
# #                 columns = [str(col).lower() for col in df.columns]
# #                 bank_columns = ['date', 'amount', 'balance', 'transaction', 'description', 'debit', 'credit', 'withdrawal', 'deposit', 'narration', 'particulars']
                
# #                 column_matches = sum(1 for col in columns if any(bank_col in col for bank_col in bank_columns))
# #                 if column_matches >= 2:
# #                     sheet_evidence['transaction_table_found'] = True
# #                     sheet_evidence['total_score'] += 3
                
# #                 # Count actual transaction rows (excluding header and empty rows)
# #                 transaction_count = 0
# #                 for idx, row in df.iterrows():
# #                     # Check if row has date and amount patterns
# #                     row_text = ' '.join([str(cell) for cell in row if pd.notna(cell)])
# #                     has_date = re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', row_text)
# #                     has_amount = re.search(r'[₹Rs\.\$\€\£]?\s*[0-9,]+\.?[0-9]{0,2}', row_text)
# #                     if has_date and has_amount:
# #                         transaction_count += 1
                
# #                 sheet_evidence['transaction_count'] = transaction_count
# #                 if transaction_count > 0:
# #                     sheet_evidence['total_score'] += min(transaction_count * 0.3, 5)
            
# #             # Keep track of the best sheet (highest score)
# #             if sheet_evidence['total_score'] > best_sheet_score:
# #                 best_sheet_score = sheet_evidence['total_score']
# #                 best_sheet_data = sheet_evidence
# #                 full_text = sheet_full_text  # Use text from best sheet
            
# #             print(f"   Sheet '{sheet_name}' score: {sheet_evidence['total_score']}, transactions: {sheet_evidence['transaction_count']}")
        
# #         # Use the best sheet data found
# #         if best_sheet_data:
# #             bank_evidence = best_sheet_data
# #             print(f"✅ Using sheet with highest score: {best_sheet_score}")
        
# #         # APPLY SHARE STATEMENT REJECTION FOR EXCEL FILES
# #         if has_share_statement_patterns(full_text):
# #             print(f"🚫 REJECTED EXCEL: Share/demat statement detected")
# #             bank_evidence['total_score'] = -100  # Ensure rejection
# #             return bank_evidence
        
# #         return bank_evidence
        
# #     except Exception as e:
# #         print(f"Excel extraction failed: {e}")
# #         return {
# #             'account_number_found': False,
# #             'bank_name_found': False,
# #             'statement_period_found': False,
# #             'transaction_table_found': False,
# #             'balance_section_found': False,
# #             'transaction_count': 0,
# #             'total_score': 0,
# #             'file_type': 'excel'
# #         }

# # def extract_data_from_excel(file_path):
# #     """Extract data from Excel files with improved multiple-sheet handling."""
# #     try:
# #         bank_evidence_template = {
# #             'account_number_found': False,
# #             'bank_name_found': False,
# #             'statement_period_found': False,
# #             'transaction_table_found': False,
# #             'balance_section_found': False,
# #             'transaction_count': 0,
# #             'bank_name': None,
# #             'account_number': None,
# #             'total_score': 0,
# #             'currency_found': False,
# #             'file_type': 'excel'
# #         }

# #         try:
# #             excel_data = pd.read_excel(file_path, sheet_name=None)
# #         except Exception as e:
# #             print(f"Error reading Excel file: {e}")
# #             return bank_evidence_template.copy()

# #         best_evidence = None
# #         best_score = -999

# #         # Process each sheet independently
# #         for sheet_name, df in excel_data.items():
# #             print(f"📊 Processing Excel sheet: {sheet_name}")
# #             # Prepare textual representation for robust matching:
# #             # 1) header line
# #             # 2) first N rows flattened
# #             headers = " | ".join([str(col) for col in df.columns]) if df.columns is not None else ""
# #             sample_rows = []
# #             max_sample_rows = min(40, len(df))
# #             for i in range(max_sample_rows):
# #                 row = df.iloc[i].fillna("").astype(str).tolist()  # Convert to string first
# #                 sample_rows.append(" | ".join(row))
# #             sheet_text = headers + "\n" + "\n".join(sample_rows)

# #             # Start with a fresh evidence copy per sheet
# #             sheet_evidence = bank_evidence_template.copy()
# #             sheet_evidence = detect_bank_patterns_in_text(sheet_text, sheet_evidence)

# #             # Column name heuristics
# #             cols = [str(c).lower() for c in df.columns]
# #             bank_columns = ['date', 'amount', 'balance', 'transaction', 'description', 'debit', 'credit', 'withdrawal', 'deposit', 'narration', 'particulars', 'value date', 'cheque', 'ref']
# #             column_matches = sum(1 for col in cols if any(bc in col for bc in bank_columns))
# #             if column_matches >= 2:
# #                 sheet_evidence['transaction_table_found'] = True
# #                 sheet_evidence['total_score'] += 3

# #             # Count transaction-like rows across entire sheet (robust)
# #             transaction_count = 0
# #             for idx, row in df.iterrows():
# #                 # join only non-empty
# #                 row_text = " ".join([str(x) for x in row if pd.notna(x) and str(x).strip() != ""])
# #                 if not row_text:
# #                     continue
# #                 has_date = re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', row_text)
# #                 has_amount = re.search(r'[₹Rs\.\$\€\£]?\s*[0-9,]+\.?[0-9]{0,2}', row_text)
# #                 if has_date and has_amount:
# #                     transaction_count += 1

# #             sheet_evidence['transaction_count'] = transaction_count
# #             if transaction_count > 0:
# #                 sheet_evidence['total_score'] += min(transaction_count * 0.3, 8)  # allow higher boost for sheets

# #             print(f"   Sheet '{sheet_name}' score: {sheet_evidence['total_score']}, transactions: {sheet_evidence['transaction_count']} (col matches={column_matches})")

# #             # If sheet is clearly a bank statement, return immediately (fast-path)
# #             if sheet_evidence['total_score'] >= 8 or sheet_evidence['transaction_count'] >= 5 or (sheet_evidence['bank_name_found'] and sheet_evidence['transaction_count'] >= 1):
# #                 print(f"✅ Sheet '{sheet_name}' strongly indicates a bank statement — selecting it.")
# #                 return sheet_evidence

# #             # Otherwise track best sheet
# #             if sheet_evidence['total_score'] > best_score:
# #                 best_score = sheet_evidence['total_score']
# #                 best_evidence = sheet_evidence

# #         # Use the best sheet evidence found (if any)
# #         if best_evidence is not None:
# #             # Share statement rejection on the best sheet text check (we created a header+sample earlier)
# #             # Build full_text for share checks by concatenating all sheets' few lines
# #             combined_text = ""
# #             for sheet_name, df in excel_data.items():
# #                 headers = " | ".join([str(col) for col in df.columns]) if df.columns is not None else ""
# #                 sample_rows = []
# #                 max_sample_rows = min(10, len(df))
# #                 for i in range(max_sample_rows):
# #                     row = df.iloc[i].fillna("").astype(str).tolist()
# #                     sample_rows.append(" | ".join(row))
# #                 combined_text += headers + "\n" + "\n".join(sample_rows) + "\n\n"

# #             if has_share_statement_patterns(combined_text):
# #                 print(f"🚫 REJECTED EXCEL: Share/demat statement detected")
# #                 best_evidence['total_score'] = -100
# #                 return best_evidence

# #             return best_evidence

# #         # If nothing matched strongly, return template
# #         return bank_evidence_template.copy()

# #     except Exception as e:
# #         print(f"Excel extraction failed: {e}")
# #         return {
# #             'account_number_found': False,
# #             'bank_name_found': False,
# #             'statement_period_found': False,
# #             'transaction_table_found': False,
# #             'balance_section_found': False,
# #             'transaction_count': 0,
# #             'total_score': 0,
# #             'file_type': 'excel'
# #         }



# def extract_data_from_excel(file_path):
#     """Extract data from Excel files with improved multiple-sheet handling."""
#     try:
#         bank_evidence_template = {
#             'account_number_found': False,
#             'bank_name_found': False,
#             'statement_period_found': False,
#             'transaction_table_found': False,
#             'balance_section_found': False,
#             'transaction_count': 0,
#             'bank_name': None,
#             'account_number': None,
#             'total_score': 0,
#             'currency_found': False,
#             'file_type': 'excel'
#         }

#         try:
#             excel_data = pd.read_excel(file_path, sheet_name=None)
#         except Exception as e:
#             print(f"Error reading Excel file: {e}")
#             return bank_evidence_template.copy()

#         best_evidence = None
#         best_score = -999

#         # Process each sheet independently
#         for sheet_name, df in excel_data.items():
#             print(f"📊 Processing Excel sheet: {sheet_name}")
            
#             # Prepare textual representation for robust matching:
#             # 1) header line
#             # 2) first N rows flattened
#             headers = " | ".join([str(col) for col in df.columns]) if df.columns is not None else ""
#             sample_rows = []
#             max_sample_rows = min(40, len(df))
            
#             for i in range(max_sample_rows):
#                 try:
#                     # FIX: Convert all cells to string before joining
#                     row = df.iloc[i].fillna("").astype(str).tolist()
#                     sample_rows.append(" | ".join(row))
#                 except Exception as row_error:
#                     print(f"⚠️ Error processing row {i}: {row_error}")
#                     continue
            
#             sheet_text = headers + "\n" + "\n".join(sample_rows)

#             # Start with a fresh evidence copy per sheet
#             sheet_evidence = bank_evidence_template.copy()
#             sheet_evidence = detect_bank_patterns_in_text(sheet_text, sheet_evidence)

#             # Column name heuristics
#             cols = [str(c).lower() for c in df.columns]
#             bank_columns = ['date', 'amount', 'balance', 'transaction', 'description', 
#                           'debit', 'credit', 'withdrawal', 'deposit', 'narration', 
#                           'particulars', 'value date', 'cheque', 'ref']
#             column_matches = sum(1 for col in cols if any(bc in col for bc in bank_columns))
            
#             if column_matches >= 2:
#                 sheet_evidence['transaction_table_found'] = True
#                 sheet_evidence['total_score'] += 3

#             # Count transaction-like rows across entire sheet (robust)
#             transaction_count = 0
#             for idx, row in df.iterrows():
#                 try:
#                     # FIX: join only non-empty values, convert to string first
#                     row_text = " ".join([str(x) for x in row if pd.notna(x) and str(x).strip() != ""])
#                     if not row_text:
#                         continue
                    
#                     has_date = re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', row_text)
#                     has_amount = re.search(r'[₹Rs\.\$\€\£]?\s*[0-9,]+\.?[0-9]{0,2}', row_text)
                    
#                     if has_date and has_amount:
#                         transaction_count += 1
#                 except Exception as tx_error:
#                     continue

#             sheet_evidence['transaction_count'] = transaction_count
#             if transaction_count > 0:
#                 sheet_evidence['total_score'] += min(transaction_count * 0.3, 8)

#             print(f"   Sheet '{sheet_name}' score: {sheet_evidence['total_score']}, "
#                   f"transactions: {sheet_evidence['transaction_count']} "
#                   f"(col matches={column_matches})")

#             # Fast-path: if sheet is clearly a bank statement, return immediately
#             if (sheet_evidence['total_score'] >= 8 or 
#                 sheet_evidence['transaction_count'] >= 5 or 
#                 (sheet_evidence['bank_name_found'] and sheet_evidence['transaction_count'] >= 1)):
#                 print(f"✅ Sheet '{sheet_name}' strongly indicates a bank statement – selecting it.")
#                 return sheet_evidence

#             # Track best sheet
#             if sheet_evidence['total_score'] > best_score:
#                 best_score = sheet_evidence['total_score']
#                 best_evidence = sheet_evidence

#         # Use the best sheet evidence found
#         if best_evidence is not None:
#             # Build combined text for share statement rejection check
#             combined_text = ""
#             for sheet_name, df in excel_data.items():
#                 try:
#                     headers = " | ".join([str(col) for col in df.columns]) if df.columns is not None else ""
#                     sample_rows = []
#                     max_sample_rows = min(10, len(df))
                    
#                     for i in range(max_sample_rows):
#                         try:
#                             row = df.iloc[i].fillna("").astype(str).tolist()
#                             sample_rows.append(" | ".join(row))
#                         except:
#                             continue
                    
#                     combined_text += headers + "\n" + "\n".join(sample_rows) + "\n\n"
#                 except Exception as sheet_error:
#                     print(f"⚠️ Error processing sheet {sheet_name}: {sheet_error}")
#                     continue

#             if has_share_statement_patterns(combined_text):
#                 print(f"🚫 REJECTED EXCEL: Share/demat statement detected")
#                 best_evidence['total_score'] = -100
#                 return best_evidence

#             return best_evidence

#         # If nothing matched strongly, return template
#         return bank_evidence_template.copy()

#     except Exception as e:
#         print(f"Excel extraction failed: {e}")
#         import traceback
#         traceback.print_exc()
#         return {
#             'account_number_found': False,
#             'bank_name_found': False,
#             'statement_period_found': False,
#             'transaction_table_found': False,
#             'balance_section_found': False,
#             'transaction_count': 0,
#             'total_score': 0,
#             'file_type': 'excel'
#         }


# def detect_bank_patterns_in_text(text, bank_evidence):
#     """Detect bank patterns in text content (common for all file types)"""
#     text_lower = text.lower()
    
#     # BANK NAME Detection
#     bank_patterns = [
#         (r'hdfc\s+bank', 'HDFC Bank'),
#         (r'icici\s+bank', 'ICICI Bank'),
#         (r'state\s+bank\s+of\s+india', 'State Bank of India'),
#         (r'axis\s+bank', 'Axis Bank'),
#         (r'sbi\s+bank', 'SBI Bank'),
#         (r'kotak\s+(mahindra)?\s*bank', 'Kotak Mahindra Bank'),
#         (r'yes\s+bank', 'Yes Bank'),
#         (r'idfc\s+first', 'IDFC First Bank'),
#         (r'punjab\s+national\s+bank', 'PNB'),
#         (r'bank\s+of\s+baroda', 'Bank of Baroda'),
#         (r'canara\s+bank', 'Canara Bank'),
#     ]
    
#     for pattern, bank_name in bank_patterns:
#         if re.search(pattern, text, re.IGNORECASE):
#             bank_evidence['bank_name_found'] = True
#             bank_evidence['bank_name'] = bank_name
#             bank_evidence['total_score'] += 4
#             break
    
#     # ACCOUNT NUMBER Patterns
#     account_patterns = [
#         r'account\s*(number|no|#)?\s*:?\s*[0-9xX\*\-]{8,20}',
#         r'a/c\s*(number|no|#)?\s*:?\s*[0-9xX\*\-]{8,20}',
#         r'savings?\s+account\s*:?\s*[0-9xX\-]{8,20}',
#         r'current\s+account\s*:?\s*[0-9xX\-]{8,20}',
#     ]
    
#     for pattern in account_patterns:
#         matches = re.findall(pattern, text, re.IGNORECASE)
#         if matches:
#             bank_evidence['account_number_found'] = True
#             bank_evidence['total_score'] += 3
#             break
    
#     # BANK STATEMENT PERIOD Patterns
#     period_patterns = [
#         r'statement\s*period\s*:?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s*to\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
#         r'period\s*:?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s*to\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
#     ]
    
#     for pattern in period_patterns:
#         if re.search(pattern, text, re.IGNORECASE):
#             bank_evidence['statement_period_found'] = True
#             bank_evidence['total_score'] += 3
#             break
    
#     # BALANCE Section Detection
#     balance_patterns = [
#         r'opening\s+balance\s*:?\s*[₹Rs\.]?\s*[0-9,]+\.?[0-9]*',
#         r'closing\s+balance\s*:?\s*[₹Rs\.]?\s*[0-9,]+\.?[0-9]*',
#         r'available\s+balance\s*:?\s*[₹Rs\.]?\s*[0-9,]+\.?[0-9]*',
#     ]
    
#     for pattern in balance_patterns:
#         if re.search(pattern, text, re.IGNORECASE):
#             bank_evidence['balance_section_found'] = True
#             bank_evidence['total_score'] += 3
#             break
    
#     # Currency Detection
#     currency_patterns = [
#         (r'₹', 2), (r'rs\.', 1), (r'rs ', 1), (r'inr', 1)
#     ]
    
#     for pattern, weight in currency_patterns:
#         if re.search(pattern, text, re.IGNORECASE):
#             bank_evidence['currency_found'] = True
#             bank_evidence['total_score'] += weight
#             break
    
#     # Banking Keywords
#     banking_keywords = [
#         'closing balance', 'opening balance', 'available balance',
#         'cash withdrawal', 'cash deposit', 'cheque deposit',
#         'neft', 'rtgs', 'imps', 'upi', 'debit', 'credit'
#     ]
    
#     keyword_score = 0
#     for keyword in banking_keywords:
#         if keyword in text_lower:
#             keyword_score += 1
    
#     bank_evidence['total_score'] += min(keyword_score, 5)
    
#     return bank_evidence

# def has_share_statement_patterns(text):
#     """Check if text contains share/demat statement patterns"""
#     text_lower = text.lower()
    
#     # Strong share/demat rejection patterns
#     strong_rejection_patterns = [
#         r'\b(demat\s+account|demat\s+statement)\b',
#         r'\b(share\s+holding|share\s+statement|share\s+portfolio)\b',
#         r'\b(mutual\s+fund|portfolio\s+statement|investment\s+portfolio)\b',
#         r'\b(equity|stock|trading|brokerage)\s+statement\b',
#         r'\b(holding\s+statement|security\s+holding)\b',
#         r'\b(nse|bse|stock\s+exchange)\b',
#         r'\b(folio\s+number|folio\s+no)\b',
#         r'\b(units|nav|purchase\s+price)\b',
#     ]
    
#     for pattern in strong_rejection_patterns:
#         if re.search(pattern, text_lower, re.IGNORECASE):
#             return True
    
#     # Additional share-specific patterns
#     share_specific_patterns = [
#         r'share.*statement',
#         r'demat.*account',
#         r'folio.*number',
#         r'equity.*shares',
#         r'stock.*holding',
#         r'mutual.*fund',
#         r'investment.*portfolio',
#         r'security.*holding',
#         r'holding.*summary',
#         r'brokerage.*statement',
#         r'trading.*account',
#         r'dp.*id',
#         r'client.*id',
#         r'isin.*code',
#         r'dividend.*declaration',
#         r'face.*value',
#         r'market.*price',
#         r'capital.*gain',
#     ]
    
#     share_pattern_count = sum(1 for pattern in share_specific_patterns if re.search(pattern, text_lower, re.IGNORECASE))
    
#     # If multiple share patterns found, reject
#     if share_pattern_count >= 2:
#         return True
    
#     return False

# def extract_data_from_txt(file_path):
#     """Extract data from text files with share statement rejection"""
#     try:
#         bank_evidence = {
#             'account_number_found': False,
#             'bank_name_found': False,
#             'statement_period_found': False,
#             'transaction_table_found': False,
#             'balance_section_found': False,
#             'transaction_count': 0,
#             'bank_name': None,
#             'account_number': None,
#             'total_score': 0,
#             'currency_found': False,
#             'file_type': 'txt'
#         }
        
#         # Read text file with different encodings
#         try:
#             with open(file_path, 'r', encoding='utf-8') as file:
#                 full_text = file.read()
#         except UnicodeDecodeError:
#             try:
#                 with open(file_path, 'r', encoding='latin-1') as file:
#                     full_text = file.read()
#             except UnicodeDecodeError:
#                 with open(file_path, 'r', encoding='cp1252') as file:
#                     full_text = file.read()
        
#         # APPLY SHARE STATEMENT REJECTION FOR TEXT FILES
#         if has_share_statement_patterns(full_text):
#             print(f" REJECTED TEXT: Share/demat statement detected")
#             bank_evidence['total_score'] = -100  # Ensure rejection
#             return bank_evidence
        
#         # Check for bank patterns
#         bank_evidence = detect_bank_patterns_in_text(full_text, bank_evidence)
        
#         # Count transaction-like lines
#         lines = full_text.split('\n')
#         transaction_count = 0
        
#         for line in lines:
#             line_clean = line.strip()
#             if len(line_clean) < 10:
#                 continue
                
#             # Transaction patterns
#             has_date = re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', line_clean)
#             has_amount = re.search(r'[₹Rs\.\$\€\£]?\s*[0-9,]+\.?[0-9]{0,2}', line_clean)
#             has_bank_term = re.search(r'\b(withdrawal|deposit|debit|credit|balance|transfer|payment)\b', line_clean, re.IGNORECASE)
            
#             if (has_date and has_amount) or (has_bank_term and has_amount):
#                 transaction_count += 1
        
#         bank_evidence['transaction_count'] = transaction_count
#         if transaction_count > 0:
#             bank_evidence['total_score'] += min(transaction_count * 0.5, 5)
#             bank_evidence['transaction_table_found'] = True
        
#         return bank_evidence
        
#     except Exception as e:
#         print(f"Text file extraction failed: {e}")
#         return {
#             'account_number_found': False,
#             'bank_name_found': False,
#             'statement_period_found': False,
#             'transaction_table_found': False,
#             'balance_section_found': False,
#             'transaction_count': 0,
#             'total_score': 0,
#             'file_type': 'txt'
#         }

# def detect_bank_specific_patterns(file_path):
#     """Detect bank statement patterns in any file format (PDF/CSV/XLSX/TXT/XML)."""
#     file_extension = file_path.lower().split('.')[-1]

#     if file_extension == 'pdf':
#         return detect_bank_specific_patterns_pdf(file_path)
#     elif file_extension == 'csv':
#         print(f" Processing CSV file: {os.path.basename(file_path)}")
#         return extract_data_from_csv(file_path)
#     elif file_extension in ['xlsx', 'xls']:
#         print(f" Processing Excel file: {os.path.basename(file_path)}")
#         return extract_data_from_excel(file_path)
#     elif file_extension == 'txt':
#         print(f" Processing TEXT file: {os.path.basename(file_path)}")
#         return extract_data_from_txt(file_path)
#     elif file_extension == 'xml':
#         print(f" Processing XML file: {os.path.basename(file_path)}")
#         return extract_data_from_xml(file_path)
#     else:
#         print(f" Unsupported file format: {file_extension}")
#         return {
#             'account_number_found': False,
#             'bank_name_found': False,
#             'statement_period_found': False,
#             'transaction_table_found': False,
#             'balance_section_found': False,
#             'transaction_count': 0,
#             'total_score': 0,
#             'file_type': file_extension
#         }

# # def detect_bank_specific_patterns(file_path):
# #     """Detect bank statement patterns in any file format"""
# #     file_extension = file_path.lower().split('.')[-1]
    
# #     if file_extension == 'pdf':
# #         return detect_bank_specific_patterns_pdf(file_path)
# #     elif file_extension == 'csv':
# #         print(f" Processing CSV file: {os.path.basename(file_path)}")
# #         return extract_data_from_csv(file_path)
# #     elif file_extension in ['xlsx', 'xls']:
# #         print(f" Processing Excel file: {os.path.basename(file_path)}")
# #         return extract_data_from_excel(file_path)
# #     elif file_extension == 'txt':
# #         print(f" Processing TEXT file: {os.path.basename(file_path)}")
# #         return extract_data_from_txt(file_path)
# #     else:
# #         print(f" Unsupported file format: {file_extension}")
# #         return {
# #             'account_number_found': False,
# #             'bank_name_found': False,
# #             'statement_period_found': False,
# #             'transaction_table_found': False,
# #             'balance_section_found': False,
# #             'transaction_count': 0,
# #             'total_score': 0,
# #             'file_type': file_extension
# #         }

# # def extract_data_from_csv(file_path):
# #     """Extract data from CSV files with share statement rejection - IMPROVED"""
# #     try:
# #         bank_evidence = {
# #             'account_number_found': False,
# #             'bank_name_found': False,
# #             'statement_period_found': False,
# #             'transaction_table_found': False,
# #             'balance_section_found': False,
# #             'transaction_count': 0,
# #             'bank_name': None,
# #             'account_number': None,
# #             'total_score': 0,
# #             'currency_found': False,
# #             'file_type': 'csv'
# #         }
        
# #         # Read CSV content with multiple encoding attempts
# #         csv_data = []
# #         encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
        
# #         for encoding in encodings:
# #             try:
# #                 with open(file_path, 'r', encoding=encoding) as file:
# #                     reader = csv.reader(file)
# #                     for row in reader:
# #                         csv_data.append(row)
# #                 print(f"✅ CSV read successfully with {encoding} encoding")
# #                 break
# #             except UnicodeDecodeError:
# #                 continue
# #             except Exception as e:
# #                 print(f"Error reading CSV with {encoding}: {e}")
# #                 continue
        
# #         if not csv_data:
# #             print(f"❌ Could not read CSV file with any encoding")
# #             return bank_evidence
        
# #         full_text = "\n".join([",".join(str(cell) for cell in row) for row in csv_data])
        
# #         # APPLY SHARE STATEMENT REJECTION FOR CSV FILES
# #         if has_share_statement_patterns(full_text):
# #             print(f"🚫 REJECTED CSV: Share/demat statement detected")
# #             bank_evidence['total_score'] = -100  # Ensure rejection
# #             return bank_evidence
        
# #         # Check for bank patterns in CSV content
# #         bank_evidence = detect_bank_patterns_in_text(full_text, bank_evidence)
        
# #         # Enhanced CSV-specific checks
# #         if len(csv_data) > 1:
# #             headers = [str(cell).lower() for cell in csv_data[0]]
# #             bank_headers = ['date', 'amount', 'balance', 'transaction', 'description', 'debit', 'credit', 'withdrawal', 'deposit', 'narration', 'particulars', 'value date', 'cheque', 'ref']
            
# #             header_matches = sum(1 for header in headers if any(bank_header in header for bank_header in bank_headers))
# #             if header_matches >= 2:
# #                 bank_evidence['transaction_table_found'] = True
# #                 bank_evidence['total_score'] += 3
            
# #             # Count actual transaction rows (excluding header)
# #             transaction_count = 0
# #             for i in range(1, len(csv_data)):  # Skip header row
# #                 row = csv_data[i]
# #                 row_text = ",".join(str(cell) for cell in row)
# #                 # Check if row has transaction characteristics
# #                 has_date = re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', row_text)
# #                 has_amount = re.search(r'[₹Rs\.\$\€\£]?\s*[0-9,]+\.?[0-9]{0,2}', row_text)
# #                 if has_date and has_amount:
# #                     transaction_count += 1
            
# #             bank_evidence['transaction_count'] = transaction_count
# #             if bank_evidence['transaction_count'] > 0:
# #                 bank_evidence['total_score'] += min(bank_evidence['transaction_count'] * 0.5, 5)
        
# #         print(f"📊 CSV Analysis: {bank_evidence['transaction_count']} transactions, Score: {bank_evidence['total_score']}")
# #         return bank_evidence
        
# #     except Exception as e:
# #         print(f"CSV extraction failed: {e}")
# #         return {
# #             'account_number_found': False,
# #             'bank_name_found': False,
# #             'statement_period_found': False,
# #             'transaction_table_found': False,
# #             'balance_section_found': False,
# #             'transaction_count': 0,
# #             'total_score': 0,
# #             'file_type': 'csv'
# #         }

# # def extract_data_from_csv(file_path):
# #     """Extract data from CSV files with segment-based processing for multiple tables."""
# #     try:
# #         bank_evidence_template = {
# #             'account_number_found': False,
# #             'bank_name_found': False,
# #             'statement_period_found': False,
# #             'transaction_table_found': False,
# #             'balance_section_found': False,
# #             'transaction_count': 0,
# #             'bank_name': None,
# #             'account_number': None,
# #             'total_score': 0,
# #             'currency_found': False,
# #             'file_type': 'csv'
# #         }

# #         # Read CSV with pandas if possible (handles headers better),
# #         # but we'll also fallback to manual row parsing to detect segments.
# #         rows = []
# #         encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
# #         for enc in encodings:
# #             try:
# #                 with open(file_path, 'r', encoding=enc, errors='ignore') as f:
# #                     reader = csv.reader(f)
# #                     rows = [row for row in reader]
# #                 print(f"✅ CSV read successfully with {enc} encoding")
# #                 break
# #             except Exception as e:
# #                 continue

# #         if not rows:
# #             print(f"❌ Could not read CSV file with any encoding")
# #             return bank_evidence_template.copy()

# #         # Join rows into text and detect share patterns quickly
# #         overall_text = "\n".join([",".join(map(str, r)) for r in rows])
# #         if has_share_statement_patterns(overall_text):
# #             print(f"🚫 REJECTED CSV: Share/demat statement detected")
# #             evidence = bank_evidence_template.copy()
# #             evidence['total_score'] = -100
# #             return evidence

# #         # Split into segments separated by blank rows (handles multiple tables)
# #         segments = []
# #         current = []
# #         for r in rows:
# #             # treat row as "empty" if all cells are empty/whitespace
# #             if all((str(c).strip() == "") for c in r):
# #                 if current:
# #                     segments.append(current)
# #                     current = []
# #             else:
# #                 current.append(r)
# #         if current:
# #             segments.append(current)

# #         best_evidence = None
# #         best_score = -999

# #         for idx, seg in enumerate(segments):
# #             # Build header + sample rows text for the segment
# #             seg_text_lines = []
# #             # If first row looks like header (non-numeric strings), use it as header
# #             if len(seg) >= 1:
# #                 header = seg[0]
# #                 seg_text_lines.append(" | ".join([str(c) for c in header]))
# #                 sample_rows = seg[1: min(len(seg), 21)]
# #                 for row in sample_rows:
# #                     seg_text_lines.append(" | ".join([str(c) for c in row]))
# #             seg_text = "\n".join(seg_text_lines)

# #             seg_evidence = bank_evidence_template.copy()
# #             seg_evidence = detect_bank_patterns_in_text(seg_text, seg_evidence)

# #             # header heuristics
# #             if len(seg) >= 1:
# #                 headers = [str(c).lower() for c in seg[0]]
# #                 bank_headers = ['date', 'amount', 'balance', 'transaction', 'description', 'debit', 'credit', 'withdrawal', 'deposit', 'narration', 'particulars', 'value date', 'cheque', 'ref']
# #                 header_matches = sum(1 for h in headers if any(b in h for b in bank_headers))
# #                 if header_matches >= 2:
# #                     seg_evidence['transaction_table_found'] = True
# #                     seg_evidence['total_score'] += 3

# #             # Count transaction-like rows in segment
# #             transaction_count = 0
# #             for row in seg[1:]:
# #                 row_text = " ".join([str(c) for c in row if str(c).strip() != ""])
# #                 if not row_text:
# #                     continue
# #                 has_date = re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', row_text)
# #                 has_amount = re.search(r'[₹Rs\.\$\€\£]?\s*[0-9,]+\.?[0-9]{0,2}', row_text)
# #                 if has_date and has_amount:
# #                     transaction_count += 1
# #             seg_evidence['transaction_count'] = transaction_count
# #             if transaction_count > 0:
# #                 seg_evidence['total_score'] += min(transaction_count * 0.5, 8)

# #             print(f"   Segment {idx+1}: score={seg_evidence['total_score']} tx_count={seg_evidence['transaction_count']} header_matches={header_matches if 'header_matches' in locals() else 0}")

# #             # Fast accept segment if strong evidence
# #             if seg_evidence['total_score'] >= 8 or seg_evidence['transaction_count'] >= 5 or (seg_evidence['bank_name_found'] and seg_evidence['transaction_count'] >= 1):
# #                 print(f"✅ CSV segment {idx+1} strongly indicates a bank statement — selecting it.")
# #                 return seg_evidence

# #             if seg_evidence['total_score'] > best_score:
# #                 best_score = seg_evidence['total_score']
# #                 best_evidence = seg_evidence

# #         # fallback to best segment evidence
# #         if best_evidence is not None:
# #             return best_evidence

# #         return bank_evidence_template.copy()

# #     except Exception as e:
# #         print(f"CSV extraction failed: {e}")
# #         return {
# #             'account_number_found': False,
# #             'bank_name_found': False,
# #             'statement_period_found': False,
# #             'transaction_table_found': False,
# #             'balance_section_found': False,
# #             'transaction_count': 0,
# #             'total_score': 0,
# #             'file_type': 'csv'
# #         }

# def extract_data_from_csv(file_path):
#     """Extract data from CSV files with segment-based processing for multiple tables."""
#     try:
#         bank_evidence_template = {
#             'account_number_found': False,
#             'bank_name_found': False,
#             'statement_period_found': False,
#             'transaction_table_found': False,
#             'balance_section_found': False,
#             'transaction_count': 0,
#             'bank_name': None,
#             'account_number': None,
#             'total_score': 0,
#             'currency_found': False,
#             'file_type': 'csv'
#         }

#         # Read CSV with pandas if possible
#         rows = []
#         encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
        
#         for enc in encodings:
#             try:
#                 with open(file_path, 'r', encoding=enc, errors='ignore') as f:
#                     reader = csv.reader(f)
#                     rows = [row for row in reader]
#                 print(f"✅ CSV read successfully with {enc} encoding")
#                 break
#             except Exception as e:
#                 continue

#         if not rows:
#             print(f"❌ Could not read CSV file with any encoding")
#             return bank_evidence_template.copy()

#         # Join rows into text and detect share patterns quickly
#         try:
#             overall_text = "\n".join([",".join([str(c) for c in r]) for r in rows])
#         except Exception as text_error:
#             print(f"⚠️ Error creating overall text: {text_error}")
#             overall_text = ""
        
#         if has_share_statement_patterns(overall_text):
#             print(f"🚫 REJECTED CSV: Share/demat statement detected")
#             evidence = bank_evidence_template.copy()
#             evidence['total_score'] = -100
#             return evidence

#         # Split into segments separated by blank rows
#         segments = []
#         current = []
        
#         for r in rows:
#             # Treat row as "empty" if all cells are empty/whitespace
#             try:
#                 if all((str(c).strip() == "") for c in r):
#                     if current:
#                         segments.append(current)
#                         current = []
#                 else:
#                     current.append(r)
#             except Exception as row_error:
#                 continue
        
#         if current:
#             segments.append(current)

#         best_evidence = None
#         best_score = -999

#         for idx, seg in enumerate(segments):
#             # Build header + sample rows text for the segment
#             seg_text_lines = []
            
#             if len(seg) >= 1:
#                 try:
#                     header = seg[0]
#                     seg_text_lines.append(" | ".join([str(c) for c in header]))
                    
#                     sample_rows = seg[1:min(len(seg), 21)]
#                     for row in sample_rows:
#                         try:
#                             seg_text_lines.append(" | ".join([str(c) for c in row]))
#                         except:
#                             continue
#                 except Exception as seg_error:
#                     print(f"⚠️ Error processing segment {idx}: {seg_error}")
#                     continue
            
#             seg_text = "\n".join(seg_text_lines)

#             seg_evidence = bank_evidence_template.copy()
#             seg_evidence = detect_bank_patterns_in_text(seg_text, seg_evidence)

#             # Header heuristics
#             if len(seg) >= 1:
#                 try:
#                     headers = [str(c).lower() for c in seg[0]]
#                     bank_headers = ['date', 'amount', 'balance', 'transaction', 'description', 
#                                   'debit', 'credit', 'withdrawal', 'deposit', 'narration', 
#                                   'particulars', 'value date', 'cheque', 'ref']
#                     header_matches = sum(1 for h in headers if any(b in h for b in bank_headers))
                    
#                     if header_matches >= 2:
#                         seg_evidence['transaction_table_found'] = True
#                         seg_evidence['total_score'] += 3
#                 except:
#                     header_matches = 0

#             # Count transaction-like rows in segment
#             transaction_count = 0
#             for row in seg[1:]:
#                 try:
#                     row_text = " ".join([str(c) for c in row if str(c).strip() != ""])
#                     if not row_text:
#                         continue
                    
#                     has_date = re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', row_text)
#                     has_amount = re.search(r'[₹Rs\.\$\€\£]?\s*[0-9,]+\.?[0-9]{0,2}', row_text)
                    
#                     if has_date and has_amount:
#                         transaction_count += 1
#                 except:
#                     continue
            
#             seg_evidence['transaction_count'] = transaction_count
#             if transaction_count > 0:
#                 seg_evidence['total_score'] += min(transaction_count * 0.5, 8)

#             print(f"   Segment {idx+1}: score={seg_evidence['total_score']} "
#                   f"tx_count={seg_evidence['transaction_count']}")

#             # Fast accept segment if strong evidence
#             if (seg_evidence['total_score'] >= 8 or 
#                 seg_evidence['transaction_count'] >= 5 or 
#                 (seg_evidence['bank_name_found'] and seg_evidence['transaction_count'] >= 1)):
#                 print(f"✅ CSV segment {idx+1} strongly indicates a bank statement – selecting it.")
#                 return seg_evidence

#             if seg_evidence['total_score'] > best_score:
#                 best_score = seg_evidence['total_score']
#                 best_evidence = seg_evidence

#         # Fallback to best segment evidence
#         if best_evidence is not None:
#             return best_evidence

#         return bank_evidence_template.copy()

#     except Exception as e:
#         print(f"CSV extraction failed: {e}")
#         import traceback
#         traceback.print_exc()
#         return {
#             'account_number_found': False,
#             'bank_name_found': False,
#             'statement_period_found': False,
#             'transaction_table_found': False,
#             'balance_section_found': False,
#             'transaction_count': 0,
#             'total_score': 0,
#             'file_type': 'csv'
#         }


# def extract_data_from_xml(file_path):
#     """Extract text from XML and run bank pattern detection."""
#     try:
#         bank_evidence = {
#             'account_number_found': False,
#             'bank_name_found': False,
#             'statement_period_found': False,
#             'transaction_table_found': False,
#             'balance_section_found': False,
#             'transaction_count': 0,
#             'bank_name': None,
#             'account_number': None,
#             'total_score': 0,
#             'currency_found': False,
#             'file_type': 'xml'
#         }

#         try:
#             tree = ET.parse(file_path)
#             root = tree.getroot()
#         except Exception as e:
#             print(f"Error parsing XML: {e}")
#             return bank_evidence

#         # Collect text from elements (limit size)
#         parts = []
#         def walk(node, depth=0):
#             if node.text and node.text.strip():
#                 parts.append(node.text.strip())
#             for child in node:
#                 walk(child, depth+1)
#             if node.tail and node.tail.strip():
#                 parts.append(node.tail.strip())
#         walk(root)

#         full_text = "\n".join(parts[:1000])  # cap length
#         if has_share_statement_patterns(full_text):
#             print("🚫 REJECTED XML: Share/demat statement detected")
#             bank_evidence['total_score'] = -100
#             return bank_evidence

#         bank_evidence = detect_bank_patterns_in_text(full_text, bank_evidence)

#         # Count transaction-like lines
#         lines = full_text.splitlines()
#         transaction_count = 0
#         for line in lines:
#             if len(line.strip()) < 8:
#                 continue
#             has_date = re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', line)
#             has_amount = re.search(r'[₹Rs\.\$\€\£]?\s*[0-9,]+\.?[0-9]{0,2}', line)
#             if (has_date and has_amount):
#                 transaction_count += 1
#         bank_evidence['transaction_count'] = transaction_count
#         if transaction_count > 0:
#             bank_evidence['total_score'] += min(transaction_count * 0.5, 8)

#         print(f"📊 XML Analysis: {bank_evidence['transaction_count']} transactions, Score: {bank_evidence['total_score']}")
#         return bank_evidence

#     except Exception as e:
#         print(f"XML extraction failed: {e}")
#         return {
#             'account_number_found': False,
#             'bank_name_found': False,
#             'statement_period_found': False,
#             'transaction_table_found': False,
#             'balance_section_found': False,
#             'transaction_count': 0,
#             'total_score': 0,
#             'file_type': 'xml'
#         }


# def has_bank_statement_structure(file_path):
#     """Detect bank statement structure in any file format, handles password-protected PDFs"""
#     try:
#         print(f" Analyzing: {os.path.basename(file_path)}")
        
#         # Check if it's a PDF and if we need to handle password protection
#         if file_path.lower().endswith('.pdf'):
#             # Get bank-specific evidence for PDF (handles password protection)
#             bank_evidence = detect_bank_specific_patterns_pdf(file_path)
            
#             # If PDF is password protected and we couldn't open it, return low confidence
#             if bank_evidence.get('password_protected', False) and bank_evidence['total_score'] == 0:
#                 print(f" Password protected PDF - keeping for manual review")
#                 return 'low_confidence'
            
#             # Special handling for image PDFs
#             if bank_evidence.get('is_image_pdf', False):
#                 print(f" Image PDF detected - using lenient scoring")
#                 # Be more lenient with image PDFs since text extraction is harder
#                 if bank_evidence['total_score'] >= 6:  # Lower threshold for image PDFs
#                     print(f"✅ Image PDF meets threshold with score {bank_evidence['total_score']}")
#                     return 'medium_confidence'
#                 elif bank_evidence['total_score'] >= 3:
#                     print(f"🟡 Image PDF has some evidence with score {bank_evidence['total_score']}")
#                     return 'low_confidence'
#                 else:
#                     print(f"🔵 Image PDF has low score {bank_evidence['total_score']}")
#                     return 'low_confidence'
#         else:
#             # For non-PDF files, use the original detection
#             bank_evidence = detect_bank_specific_patterns(file_path)
        
#         # Print detailed analysis
#         print(f"📊 BANK STATEMENT ANALYSIS REPORT:")
#         print(f"   File Type: {bank_evidence.get('file_type', 'unknown')}")
#         print(f"   Bank Name: {bank_evidence['bank_name_found']} ({bank_evidence.get('bank_name', 'None')})")
#         print(f"   Account Number: {bank_evidence['account_number_found']}")
#         print(f"   Transaction Count: {bank_evidence['transaction_count']}")
#         print(f"   Statement Period: {bank_evidence['statement_period_found']}")
#         print(f"   Balance Section: {bank_evidence['balance_section_found']}")
#         if bank_evidence.get('is_image_pdf'):
#             print(f"   📷 Image PDF: Yes")
#         print(f"   TOTAL SCORE: {bank_evidence['total_score']}/30")
        
#         # Read file content for rejection patterns
#         full_text = ""
#         try:
#             if file_path.lower().endswith('.pdf'):
#                 # For password-protected PDFs, we may not be able to read content
#                 if not bank_evidence.get('password_protected', False):
#                     # Use enhanced extraction for image PDFs
#                     if bank_evidence.get('is_image_pdf', False):
#                         full_text = extract_text_from_image_pdf(file_path)
#                     else:
#                         with pdfplumber.open(file_path) as pdf:
#                             if len(pdf.pages) > 0:
#                                 page = pdf.pages[0]
#                                 full_text = page.extract_text() or ""
#             else:
#                 # For non-PDF files, read first 10KB for rejection checks
#                 with open(file_path, 'rb') as f:
#                     raw_data = f.read(10240)
#                     try:
#                         full_text = raw_data.decode('utf-8')
#                     except:
#                         try:
#                             full_text = raw_data.decode('latin-1')
#                         except:
#                             full_text = ""
#         except:
#             pass
        
#         full_text = full_text.lower()
        
#         # ENHANCED STRONG REJECTION PATTERNS - Clear non-bank documents
#         strong_rejection_patterns = [
#             # Share/Demat Statements
#             (r'\b(demat\s+account|demat\s+statement)\b', 'Demat/Share Statement'),
#             (r'\b(share\s+holding|share\s+statement|share\s+portfolio)\b', 'Share Holding Statement'),
#             (r'\b(mutual\s+fund|portfolio\s+statement|investment\s+portfolio)\b', 'Investment Portfolio'),
#             (r'\b(equity|stock|trading|brokerage)\s+statement\b', 'Trading/Stock Statement'),
#             (r'\b(holding\s+statement|security\s+holding)\b', 'Security Holding Statement'),
#             (r'\b(nse|bse|stock\s+exchange)\b', 'Stock Exchange Document'),
#             (r'\b(folio\s+number|folio\s+no)\b', 'Mutual Fund Folio'),
#             (r'\b(units|nav|purchase\s+price)\b', 'Investment Units/NAV'),
            
#             # Other non-bank documents
#             (r'\b(resume|cv|curriculum\s+vitae)\b', 'Resume/CV'),
#             (r'\b(powerpoint|presentation|slide)\b', 'Presentation'),
#             (r'\b(credit\s+card\s+statement)\b', 'Credit Card Statement'),
#             (r'\b(tax|income\s+tax|gst)\b', 'Tax Document'),
#             (r'\b(insurance|policy|premium)\b', 'Insurance Document'),
#             (r'\b(loan\s+statement|emi\s+statement)\b', 'Loan Statement'),
#             (r'\b(passport|aadhaar|pan\s+card)\b', 'ID Document'),
#             (r'\b(admit\s+card|hall\s+ticket)\b', 'Admit Card'),
#             (r'\b(syllabus|question\s+paper)\b', 'Educational Document'),
#         ]
        
#         for pattern, doc_type in strong_rejection_patterns:
#             if re.search(pattern, full_text, re.IGNORECASE):
#                 print(f"🚫 REJECTED: {doc_type} detected")
#                 return 'reject'
        
#         # ADDITIONAL SHARE-SPECIFIC PATTERNS
#         share_specific_patterns = [
#             r'share.*statement',
#             r'demat.*account',
#             r'folio.*number',
#             r'equity.*shares',
#             r'stock.*holding',
#             r'mutual.*fund',
#             r'investment.*portfolio',
#             r'security.*holding',
#             r'holding.*summary',
#             r'brokerage.*statement',
#             r'trading.*account',
#             r'dp.*id',
#             r'client.*id',
#             r'isin.*code',
#             r'dividend.*declaration',
#             r'face.*value',
#             r'market.*price',
#             r'capital.*gain',
#         ]
        
#         share_pattern_count = sum(1 for pattern in share_specific_patterns if re.search(pattern, full_text, re.IGNORECASE))
        
#         # If multiple share patterns found, reject even if it has some bank-like elements
#         if share_pattern_count >= 2:
#             print(f"🚫 REJECTED: Multiple share/demat patterns detected ({share_pattern_count} patterns)")
#             return 'reject'
        
#         # Core bank elements
#         core_bank_elements = [
#             bank_evidence['bank_name_found'],
#             bank_evidence['account_number_found'],
#             bank_evidence['transaction_count'] >= 1,
#             bank_evidence['balance_section_found'],
#             bank_evidence['statement_period_found']
#         ]
#         core_score = sum(core_bank_elements)
        
#         print(f"   Core Bank Elements: {core_score}/5")
        
#         # STRICTER CORE ELEMENT BASED DECISION LOGIC
#         # More lenient for image PDFs
#         if bank_evidence.get('is_image_pdf', False):
#             if core_score >= 2:
#                 print(f"✅ HIGH CONFIDENCE: {core_score} core bank elements found in image PDF")
#                 return 'high_confidence'
#             elif core_score >= 1:
#                 print(f"🟡 MEDIUM CONFIDENCE: {core_score} core bank elements found in image PDF")
#                 return 'medium_confidence'
#             else:
#                 print(f"🔵 LOW CONFIDENCE: {core_score} core bank elements found in image PDF")
#                 return 'low_confidence'
#         else:
#             # Original logic for regular PDFs and other files
#             if core_score == 0:
#                 print(f"❌ REJECTED: No core bank elements found")
#                 return 'reject'
#             elif core_score == 1:
#                 if share_pattern_count >= 1:
#                     print(f"🚫 REJECTED: Only 1 core bank element and share patterns detected")
#                     return 'reject'
#                 elif bank_evidence['total_score'] < 5:
#                     print(f"❌ REJECTED: Only 1 core bank element and low total score")
#                     return 'reject'
#                 else:
#                     print(f"🔵 LOW CONFIDENCE: 1 core bank element found - keeping for review")
#                     return 'low_confidence'
#             elif core_score == 2:
#                 if share_pattern_count >= 2:
#                     print(f"🚫 REJECTED: 2 core bank elements but strong share patterns detected")
#                     return 'reject'
#                 print(f"🟡 MEDIUM CONFIDENCE: 2 core bank elements found")
#                 return 'medium_confidence'
#             elif core_score >= 3:
#                 print(f"✅ HIGH CONFIDENCE: {core_score} core bank elements found")
#                 return 'high_confidence'
#             else:
#                 print(f"❌ REJECTED: Insufficient bank statement evidence")
#                 return 'reject'
            
#     except Exception as e:
#         print(f"File analysis failed: {e}")
#         print(f"🟠 UNCERTAIN: Analysis failed - KEEPING FOR MANUAL REVIEW")
#         return 'low_confidence'


# def classify_files(file_paths):
#     """
#     Takes a list of file paths and classifies each as a bank statement or not.
#     Returns a list of dictionaries with confidence score and True/False labels.
#     """
#     results = []

#     for file_path in file_paths:
#         try:
#             print(f"\n🔍 Checking: {file_path}")

#             # Run your internal bank structure detection logic
#             confidence_label = has_bank_statement_structure(file_path)

#             # Scoring system
#             if confidence_label == "high_confidence":
#                 score = 90
#                 is_bank = True
#             elif confidence_label == "medium_confidence":
#                 score = 70
#                 is_bank = True
#             elif confidence_label == "low_confidence":
#                 score = 50
#                 is_bank = True
#             elif confidence_label == "rejected":
#                 score = 20
#                 is_bank = False
#             else:
#                 score = 0
#                 is_bank = False

#             result = {
#                 "file": os.path.basename(file_path),
#                 "file_path": file_path,
#                 "is_bank_statement": is_bank,
#                 "confidence_label": confidence_label,
#                 "confidence_score": score
#             }

#             results.append(result)

#             print(f"✅ {os.path.basename(file_path)} → "
#                   f"{'Bank Statement' if is_bank else 'Not Bank Statement'} "
#                   f"({confidence_label}, Score: {score})")

#         except Exception as e:
#             print(f"❌ Error processing {file_path}: {e}")
#             results.append({
#                 "file": os.path.basename(file_path),
#                 "file_path": file_path,
#                 "is_bank_statement": False,
#                 "confidence_label": "error",
#                 "confidence_score": 0,
#                 "error": str(e)
#             })

#     # Print summary
#     print("\n📊 Summary:")
#     for r in results:
#         print(f"{r['file']}: {'✅ Bank' if r['is_bank_statement'] else '❌ Not Bank'} "
#               f"(Score {r['confidence_score']}, {r['confidence_label']})")

#     return results


# # # Example usage if you run this directly:
# # if __name__ == "__main__":
# #     test_files = [
# #         "samples/HDFC_statement.pdf",
# #         "samples/ICICI_statement.xlsx",
# #         "samples/Portfolio_Report.pdf",
# #         "samples/random_text.txt"
# #     ]

# #     output = classify_files(test_files)
# #     print("\nFinal JSON output:\n", output)


# import sys
# import os
# import shutil
# import base64
# import hashlib
# import json
# import pandas as pd
# import pdfplumber
# import re
# from datetime import datetime, timedelta
# from collections import defaultdict
# import io
# import subprocess
# import csv
# import zipfile
# import tempfile
# import xml.etree.ElementTree as ET




# def copy_to_protected_folder(file_path, reason="password_protected"):
#     """Copy file to output/protected folder"""
#     try:
#         # Create output/protected directory if it doesn't exist
#         protected_dir = os.path.join("output", "protected")
#         os.makedirs(protected_dir, exist_ok=True)
        
#         # Get filename
#         filename = os.path.basename(file_path)
        
#         # Create destination path
#         dest_path = os.path.join(protected_dir, filename)
        
#         # Copy file
#         shutil.copy2(file_path, dest_path)
#         print(f"📁 Copied to protected folder: {filename} (Reason: {reason})")
        
#         return dest_path
#     except Exception as e:
#         print(f"❌ Error copying to protected folder: {e}")
#         return None



# def _extract_structured_data(pdf):
#     """Internal function to extract structured data from already opened PDF"""
#     structured_data = {
#         'tables': [],
#         'text_blocks': [],
#         'transaction_lines': [],
#         'header_sections': []
#     }
    
#     # ONLY PROCESS FIRST PAGE for speed
#     if len(pdf.pages) > 0:
#         for page in pdf.pages[:5]:
#             full_text += page.extract_text() or ""

#   # First page only
        
#         # Method 1: Extract tables with multiple strategies
#         table_strategies = [
#             {'vertical_strategy': 'lines', 'horizontal_strategy': 'lines'},
#             {'vertical_strategy': 'text', 'horizontal_strategy': 'text'},
#         ]
        
#         for strategy in table_strategies:
#             try:
#                 tables = page.extract_tables(strategy)
#                 if tables:
#                     for table in tables:
#                         if table and any(any(cell and str(cell).strip() for cell in row) for row in table):
#                             structured_data['tables'].append({
#                                 'page': 1,
#                                 'data': table,
#                                 'strategy': str(strategy)
#                             })
#             except Exception as e:
#                 continue
        
#         # Method 2: Extract text with layout preservation
#         text = page.extract_text()
#         if text:
#             lines = text.split('\n')
            
#             # Identify header sections (usually top of page)
#             header_keywords = ['statement', 'account', 'balance', 'period', 'date','description', 'narration','cheque','transaction',
#                                'value date','credit','debit','perticulars','ref no', 'opening balance','closing balance','withdrawal amt','deposit amt',
#                                'transaction','txn','value date']
#             header_lines = []
#             for i, line in enumerate(lines[:10]):
#                 if any(keyword in line.lower() for keyword in header_keywords):
#                     header_lines.append(line)
            
#             if header_lines:
#                 structured_data['header_sections'].extend(header_lines)
            
#             # Identify transaction-like lines
#             transaction_lines = []
#             for line in lines:
#                 line_clean = line.strip()
#                 if len(line_clean) < 5:
#                     continue
                    
#                 # Transaction patterns
#                 has_date = re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', line_clean)
#                 has_amount = re.search(r'[₹Rs\.\$\€\£]?\s*[0-9,]+\.?[0-9]{0,2}', line_clean)
#                 has_debit_credit = re.search(r'\b(DR|CR|Dr|Cr|debit|credit|withdrawal|deposit|balance)\b', line_clean, re.IGNORECASE)
                
#                 if (has_date and has_amount) or (has_amount and has_debit_credit) or (has_date and len(line_clean) > 20):
#                     transaction_lines.append({
#                         'line': line_clean,
#                         'page': 1,
#                         'has_date': bool(has_date),
#                         'has_amount': bool(has_amount)
#                     })
            
#             structured_data['transaction_lines'].extend(transaction_lines)
    
#     return structured_data

# def extract_structured_data_from_pdf(pdf_path):
#     """Extract structured data from FIRST PAGE ONLY for speed, handles password-protected PDFs"""
#     try:
#         # First try to open without password
#         try:
#             with pdfplumber.open(pdf_path) as pdf:
#                 return _extract_structured_data(pdf)
#         except Exception as e:
#             if "password" in str(e).lower() or "encrypted" in str(e).lower():
#                 print(f"PDF is password protected: {os.path.basename(pdf_path)}")
                
#                 # Extract filename to get potential passwords
#                 filename = os.path.basename(pdf_path)
#                 filename_password = extract_password_from_filename(filename)
                
#                 # List of passwords to try
#                 passwords_to_try = []
#                 if filename_password:
#                     passwords_to_try.append(filename_password)
                
#                 # Add common passwords
#                 common_passwords = ['1234', '84252124', '9920192292', '000000', '12345678' , '7879742']
#                 passwords_to_try.extend(common_passwords)
                
#                 # Try opening with passwords
#                 pdf = try_open_pdf_with_passwords(pdf_path, passwords_to_try)
                
#                 if pdf:
#                     try:
#                         result = _extract_structured_data(pdf)
#                         pdf.close()
#                         return result
#                     except Exception as extract_error:
#                         print(f"Error extracting data from password-protected PDF: {extract_error}")
#                         pdf.close()
#                         return {'tables': [], 'text_blocks': [], 'transaction_lines': [], 'header_sections': []}
#                 else:
#                     print(f"❌ Could not open password-protected PDF: {filename}")
#                     return {'tables': [], 'text_blocks': [], 'transaction_lines': [], 'header_sections': []}
#             else:
#                 # Some other error
#                 raise e
                
#     except Exception as e:
#         print(f"Structured data extraction failed: {e}")
#         return {'tables': [], 'text_blocks': [], 'transaction_lines': [], 'header_sections': []}

# def extract_text_from_image_pdf(pdf_path):
#     """Enhanced text extraction for image-based PDFs using pdfplumber with optimized settings"""
#     full_text = ""
    
#     try:
#         print(f"🔍 Starting enhanced text extraction for image PDF...")
#         with pdfplumber.open(pdf_path) as pdf:
#             # Process only first 2 pages for performance
#             for i, page in enumerate(pdf.pages[:2]):
#                 print(f"📄 Processing page {i+1}...")
                
#                 # Method 1: Standard text extraction with different settings
#                 text_settings = [
#                     {},
#                     {"x_tolerance": 2, "y_tolerance": 2},
#                     {"x_tolerance": 5, "y_tolerance": 5}
#                 ]
                
#                 for settings in text_settings:
#                     try:
#                         text = page.extract_text(**settings)
#                         if text and len(text.strip()) > 10:
#                             full_text += f"\n--- Page {i+1} (Settings: {settings}) ---\n{text}"
#                             print(f"✅ Extracted {len(text.strip())} characters with settings {settings}")
#                             break
#                     except Exception as e:
#                         continue
                
#                 # Method 2: Extract tables with multiple strategies
#                 table_strategies = [
#                     {'vertical_strategy': 'lines', 'horizontal_strategy': 'lines'},
#                     {'vertical_strategy': 'text', 'horizontal_strategy': 'text'},
#                     {'vertical_strategy': 'lines', 'horizontal_strategy': 'text'},
#                 ]
                
#                 for strategy in table_strategies:
#                     try:
#                         tables = page.extract_tables(strategy)
#                         if tables:
#                             for table_idx, table in enumerate(tables):
#                                 if table and any(any(cell for cell in row) for row in table):
#                                     table_text = f"\n--- Table {table_idx+1} (Strategy: {strategy}) ---\n"
#                                     for row in table:
#                                         if row and any(cell for cell in row):
#                                             row_text = " | ".join(str(cell) if cell else "" for cell in row)
#                                             table_text += f"{row_text}\n"
#                                     full_text += table_text
#                                     print(f"📊 Extracted table with {len(table)} rows")
#                     except Exception as e:
#                         continue
                
#                 # Method 3: Extract words with positions for layout analysis
#                 try:
#                     words = page.extract_words()
#                     if words:
#                         print(f"📝 Found {len(words)} words on page {i+1}")
#                         # Group words by lines based on vertical position
#                         lines = {}
#                         for word in words:
#                             y_pos = round(word['top'] / 10) * 10  # Group by 10px increments
#                             if y_pos not in lines:
#                                 lines[y_pos] = []
#                             lines[y_pos].append((word['x0'], word['text']))
                        
#                         # Sort by vertical position and then by horizontal position
#                         for y_pos in sorted(lines.keys()):
#                             line_words = sorted(lines[y_pos], key=lambda x: x[0])
#                             line_text = " ".join(word[1] for word in line_words)
#                             full_text += f"\n{line_text}"
#                 except Exception as e:
#                     print(f"⚠️  Word extraction failed: {e}")
                    
#     except Exception as e:
#         print(f"❌ Error in enhanced PDF text extraction: {e}")
    
#     print(f"📄 Total text extracted: {len(full_text.strip())} characters")
#     return full_text

# def _detect_bank_patterns(pdf, pdf_path):
#     """Internal function to detect bank patterns from already opened PDF"""
#     bank_evidence = {
#         'account_number_found': False,
#         'bank_name_found': False,
#         'statement_period_found': False,
#         'transaction_table_found': False,
#         'balance_section_found': False,
#         'transaction_count': 0,
#         'bank_name': None,
#         'account_number': None,
#         'total_score': 0,
#         'currency_found': False,
#         'bank_type': None,
#         'statement_date_found': False,
#         'customer_info_found': False,
#         'has_structured_data': False,
#         'has_bank_specific_patterns': False,
#         'page_count': len(pdf.pages),
#         'file_type': 'pdf',
#         'password_protected': False,
#         'is_image_pdf': False
#     }
    
#     full_text = ""
#     structured_data = extract_structured_data_from_pdf(pdf_path)
    
#     # Score for structured data
#     if (len(structured_data['tables']) > 0 or 
#         len(structured_data['transaction_lines']) > 0):
#         bank_evidence['has_structured_data'] = True
#         bank_evidence['total_score'] += 3
    
#     # Check if this is an image PDF
#     is_image_based = is_image_pdf(pdf_path)
#     bank_evidence['is_image_pdf'] = is_image_based
    
#     if is_image_based:
#         print(f"🖼️  Image-based PDF detected, using enhanced extraction")
#         # Use enhanced extraction for image PDFs
#         full_text = extract_text_from_image_pdf(pdf_path)
        
#         # Give bonus points for image PDFs that still yield text
#         if len(full_text.strip()) > 50:  # Reduced threshold for image PDFs
#             bank_evidence['total_score'] += 3
#             print(f"✅ Image PDF yielded {len(full_text.strip())} characters of text")
#         else:
#             print(f"⚠️  Image PDF yielded only {len(full_text.strip())} characters")
#     else:
#         # ONLY PROCESS FIRST PAGE for speed for regular PDFs
#         if len(pdf.pages) > 0:
#             for page in pdf.pages[:5]:
#                 full_text += page.extract_text() or ""
#                 # full_text = page_text
#                 print(f"📄 Regular PDF - extracted {len(page.extract_text.strip())} characters")
    
#     # BANK NAME Detection - FIRST PAGE ONLY
#     bank_patterns = [
#         (r'hdfc\s+bank', 'HDFC Bank'),
#         (r'icici\s+bank', 'ICICI Bank'),
#         (r'state\s+bank\s+of\s+india', 'State Bank of India'),
#         (r'axis\s+bank', 'Axis Bank'),
#         (r'sbi\s+bank', 'SBI Bank'),
#         (r'kotak\s+(mahindra)?\s*bank', 'Kotak Mahindra Bank'),
#         (r'yes\s+bank', 'Yes Bank'),
#         (r'idfc\s+first', 'IDFC First Bank'),
#         (r'punjab\s+national\s+bank', 'PNB'),
#         (r'bank\s+of\s+baroda', 'Bank of Baroda'),
#         (r'canara\s+bank', 'Canara Bank'),
#         (r'bassein\s+catholic\+bank','bassein catholic'),
#         (r'bharat\s+bank', 'bharat Bank'),
#         (r'BOB\s+bank', 'BOB Bank'),
#         (r'BOI\s+bank', 'BOI Bank'),
#         (r'BOM\s+bank', 'BOM Bank'),
#         (r'CBI\s+bank', 'CBI Bank'),
#         (r'cosmos\s+bank', 'cosmos Bank'),
#         (r'Deustche\s+bank', 'Deustche Bank'),
#         (r'DCB\s+bank', 'DCB Bank'),
#         (r'federal\s+bank', 'federal Bank'),
#         (r'IDBI\s+bank', 'IDBI Bank'),
#         (r'indian\s+bank', 'indian Bank'),
#         (r'indina\s+overseas\s+bank', 'indian overseas Bank'),
#         (r'indusind\s+bank', 'indisind Bank'),
#         (r'jankalyan\s+co-operative\s+bank', 'jankalyan co-operative Bank'),
#         (r'karnataka\s+bank', 'karnataka Bank'),
#         (r'abhyudaya\s+bank', 'abhyudaya Bank'),
#         (r'au\s+bank', 'AU Bank'),
#         (r'bandhan\s+bank', 'Bandhan Bank'),
#         (r'cns\s+bank', 'Cns Bank'),
#         (r'dhanlakshmi\s+bank', 'dhanlakshmi Bank'),
#         (r'karur\s+bank', 'karur Bank'),
#         (r'nnsb\s+bank', 'NNSB Bank'),
#         (r'south\s+indian\s+bank', 'south indian Bank'),
#         (r'suco\s+souharda\s+sahakari\s+bank', 'suco souharda sahakari Bank'),
#         (r'nkgsb\s+bank', 'NKGSB Bank'),
#         (r'pnb\s+bank', 'PNB Bank'),
#         (r'rbl\s+bank', 'RBL Bank'),
#         (r'saraswat\s+bank', 'Saraswat Bank'),
#         (r'shamrao\s+vitthal\s+bank', 'Shamrao vitthal Bank'),
#         (r'surat\s+bank', 'Surat Bank'),
#         (r'vasai\s+vikas\s+bank', 'vasai vikas Bank'),
#         (r'yes\s+bank', 'Yes Bank'),
#     ]
    
#     for pattern, bank_name in bank_patterns:
#         if re.search(pattern, full_text, re.IGNORECASE):
#             bank_evidence['bank_name_found'] = True
#             bank_evidence['bank_name'] = bank_name
#             bank_evidence['total_score'] += 4
#             print(f"✅ Found bank: {bank_name}")
#             break
    
#     # BANK ACCOUNT NUMBER Patterns - FIRST PAGE ONLY
#     account_patterns = [
#         r'account\s*(number|no|#)?\s*:?\s*[0-9xX\*\-]{8,20}',
#         r'a/c\s*(number|no|#)?\s*:?\s*[0-9xX\*\-]{8,20}',
#         r'savings?\s+account\s*:?\s*[0-9xX\-]{8,20}',
#         r'current\s+account\s*:?\s*[0-9xX\-]{8,20}',
#     ]
    
#     for pattern in account_patterns:
#         matches = re.findall(pattern, full_text, re.IGNORECASE)
#         if matches:
#             bank_evidence['account_number_found'] = True
#             bank_evidence['total_score'] += 3
#             print(f"✅ Found account number pattern")
#             break
    
#     # BANK STATEMENT PERIOD Patterns - FIRST PAGE ONLY
#     period_patterns = [
#         r'statement\s*period\s*:?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s*to\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
#         r'period\s*:?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s*to\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
#     ]
    
#     for pattern in period_patterns:
#         if re.search(pattern, full_text, re.IGNORECASE):
#             bank_evidence['statement_period_found'] = True
#             bank_evidence['total_score'] += 3
#             print(f"✅ Found statement period")
#             break
    
#     # BANK TRANSACTION PATTERNS - FIRST PAGE ONLY
#     bank_transaction_indicators = 0
    
#     # Bank-specific transaction headers
#     bank_header_patterns = [
#         r'date\s+narration\s+chq|ref\s+no\s+value\s+date\s+withdrawal\s+deposit\s+balance',#hdfc , kotak
#         r'date\s+narration\s+chq|ref\s+no\s+value\s+date\s+withdrawal\s+amt\s+deposit\s+amt\s+closing\s+balance'
#         r'value\s+date\s+post\s+date\s+description\s+debit\s+credit\s+balance', #HSBC municipal
#         r'date\s+description\s+cheque\s+no\s+DR\s+CR\s+balance',#indian , thane district
#         r'date\s+description\s+cheque\s+no\s+debit\s+credit\s+balance',#karnataka , TJSB , gp parsik ,
#         r'date\s+perticulars\s+chq|ref\s+no\s+debit\s+credit\s+balance', #indian overseas, svc , surat , NNSB , karad
#         r'date\s+perticulars\s+chq|ref\s+no\s+withdrawal\s+deposit\s+balance',#induind ,NKGSB,uco, baroda ,south indian , suco souharda sahakari , 
#         r'txn\s+date\s+particulars\s+debit\s+credit\s+balance',#IDFC
#         r'txn\s+date\s+value\s+date\s+transaction\s+\s+amount\s+DRCR\s+balance\s+branch\s+name',
#         r'txn\s+date\s+value\s+date\s+description\s+\s+debits\s+credits\s+balance', #IDBI , sbi , au , bandhan
#         r'txn\s+date\s+value\s+date\s+perticulars\s+inst\s+no\s+\s+withdrawals\s+deposit\s+balance', #jalgaon
#         r'txn\s+date\s+particulars\s+chq\s+debit\s+credit\s+balance',#yes , thane bharat
#         r'value\s+date\s+details\s+chq\s+no\s+debit\s+credit\s+balance', #CBI
#         r'date\s+transaction\s+perticulars\s+cheque|ref\s+no\s+withdrawal\s+deposit\s+available\s+balance', #cosmos , deustche
#         r'date\s+value\s+date\s+perticulars\s+cheque\s+details\s+\s+withdrawals\s+deposit\s+balance', #federal, SCB
#         r'value\s+date\s+transaction\s+date\s+cheque\s+no\s+withdrawal\s+amount\s+deposit\s+amount\s+balance',#ICICI
#         r'txn\s+no\s+txn\s+date\s+description\s+branch\s+name\s+cheuqe\s+no\s+dr\s+amount\s+cr\s+amount\s+balance'#pnb
#         r'txn\s+date\s+transaction\s+details\s+\s+cheque\s+no\s+\s+value\s+date\s+\s+withdrawal\s+amt\s+deposit\s+amt\s+balance',#RBL
#         r'date\s+perticulars\s+instruments\s+dr\s+amount\s+cr\s+amount\s+total\s+amount',#saraswat ,vasai vikas , abhyudaya , cns
#         r'date\s+remakrs\s+tran\s+id\s+utr\s+number\s+instr\s+id\s+withdrawals\s+deposit\s+balance',#union
#         r'txn\s+date\s+description\s+value\s+date\s+cheque|ref\s+no\s+txn\s+amount',#dhanlakshmi

#     ]
    
#     for pattern in bank_header_patterns:
#         if re.search(pattern, full_text, re.IGNORECASE):
#             bank_transaction_indicators += 3
#             bank_evidence['has_bank_specific_patterns'] = True
#             print(f"✅ Found bank transaction header pattern")
#             break
    
#     # Transaction line patterns - FIRST PAGE ONLY
#     lines = full_text.split('\n')
#     bank_transaction_count = 0
    
#     for line in lines:
#         line_clean = line.strip()
#         if len(line_clean) < 10:
#             continue
            
#         has_date = re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', line_clean)
#         has_amount = re.search(r'[₹Rs\.\$\€\£]?\s*[0-9,]+\.[0-9]{2}', line_clean)
#         has_bank_term = re.search(r'\b(withdrawal|deposit|debit|credit|balance|transfer|payment|amt)\b', line_clean, re.IGNORECASE)
        
#         if (has_date and has_amount) or (has_bank_term and has_amount):
#             bank_transaction_count += 1
    
#     bank_evidence['transaction_count'] = bank_transaction_count
#     print(f"📊 Found {bank_transaction_count} transaction-like lines")
    
#     # Transaction Scoring
#     if bank_evidence['transaction_count'] >= 5:
#         bank_evidence['total_score'] += 6
#         bank_evidence['transaction_table_found'] = True
#     elif bank_evidence['transaction_count'] >= 3:
#         bank_evidence['total_score'] += 4
#         bank_evidence['transaction_table_found'] = True
#     elif bank_evidence['transaction_count'] >= 1:
#         bank_evidence['total_score'] += 2
    
#     # BANK BALANCE Section Detection - FIRST PAGE ONLY
#     balance_patterns = [
#         r'opening\s+balance\s*:?\s*[₹Rs\.]?\s*[0-9,]+\.?[0-9]*',
#         r'closing\s+balance\s*:?\s*[₹Rs\.]?\s*[0-9,]+\.?[0-9]*',
#         r'available\s+balance\s*:?\s*[₹Rs\.]?\s*[0-9,]+\.?[0-9]*',
#     ]
    
#     for pattern in balance_patterns:
#         if re.search(pattern, full_text, re.IGNORECASE):
#             bank_evidence['balance_section_found'] = True
#             bank_evidence['total_score'] += 3
#             print(f"✅ Found balance section")
#             break
    
#     # Banking Keywords - FIRST PAGE ONLY
#     banking_keywords_weighted = {
#         'closing balance': 3, 'opening balance': 3, 'available balance': 2,
#         'cash withdrawal': 2, 'cash deposit': 2, 'deposit': 2,
#         'neft': 2, 'rtgs': 2, 'imps': 2, 'upi': 2,
#         'debit': 2, 'credit': 2, 'withdrawal': 2, 'deposit': 2,'cheque':2,'naration':2,'perticulars':2,
#         'amount':2,'balance':2, 'description':2, 'value date':2, 'txn date':2, 'date':2,
#         'transaction':2, 'instruments':2,'withdrawal amt':3, 'deposit amt':3
#     }
    
#     keyword_score = 0
#     for keyword, weight in banking_keywords_weighted.items():
#         if keyword in full_text.lower():
#             keyword_score += weight
#             print(f"✅ Found banking keyword: {keyword}")
    
#     bank_evidence['total_score'] += min(keyword_score, 6)
    
#     # Currency Detection - FIRST PAGE ONLY
#     currency_patterns = [
#         (r'₹', 2), (r'rs\.', 1), (r'rs ', 1), (r'inr', 1)
#     ]
    
#     for pattern, weight in currency_patterns:
#         if re.search(pattern, full_text, re.IGNORECASE):
#             bank_evidence['currency_found'] = True
#             bank_evidence['total_score'] += weight
#             print(f"✅ Found currency symbol")
#             break
    
#     # Customer Info Detection - FIRST PAGE ONLY
#     customer_patterns = [
#         r'customer\s*(name|id)?\s*:',
#         r'account\s+holder\s*:',
#         r'name\s*:',
#     ]
    
#     for pattern in customer_patterns:
#         if re.search(pattern, full_text, re.IGNORECASE):
#             bank_evidence['customer_info_found'] = True
#             bank_evidence['total_score'] += 2
#             print(f"✅ Found customer info")
#             break
    
#     # Statement Date Detection - FIRST PAGE ONLY
#     statement_date_patterns = [
#         r'statement\s+date\s*:?\s*\d{1,2}[-/]\d{1,2}[-/]\d{2,4}',
#         r'as\s+of\s+\d{1,2}[-/]\d{1,2}[-/]\d{2,4}',
#     ]
    
#     for pattern in statement_date_patterns:
#         if re.search(pattern, full_text, re.IGNORECASE):
#             bank_evidence['statement_date_found'] = True
#             bank_evidence['total_score'] += 2
#             print(f"✅ Found statement date")
#             break
    
#     # Multi-page bonus (still check total pages but don't scan them)
#     if bank_evidence['page_count'] > 1:
#         bank_evidence['total_score'] += 2
    
#     # Cap the total score
#     bank_evidence['total_score'] = max(0, min(bank_evidence['total_score'], 30))
    
#     print(f"🎯 Final bank evidence score: {bank_evidence['total_score']}/30")
#     return bank_evidence

# def is_image_pdf(pdf_path):
#     """Check if PDF is image-based by analyzing text extraction results"""
#     try:
#         with pdfplumber.open(pdf_path) as pdf:
#             if len(pdf.pages) == 0:
#                 return False
            
#             # Check first page for text content
#             first_page = pdf.pages[0]
#             text = first_page.extract_text()
            
#             print(f"📄 PDF Text extraction result: {len(text.strip()) if text else 0} characters")
            
#             # If very little or no text, likely image PDF
#             if not text or len(text.strip()) < 20:  # Reduced threshold for scanned PDFs
#                 print(f"🖼️  Low text content detected, checking for images...")
                
#                 # Check if there are images on the page
#                 if first_page.images:
#                     print(f"🖼️  Found {len(first_page.images)} images on first page")
#                     return True
                
#                 # Additional check: try to extract tables
#                 tables = first_page.extract_tables()
#                 if not tables or all(not table for table in tables):
#                     print(f"🖼️  No tables found, likely image PDF")
#                     return True
#                 else:
#                     print(f"📊 Found {len(tables)} tables")
                    
#             return False
#     except Exception as e:
#         print(f"❌ Error checking if PDF is image-based: {e}")
#         return False

# def extract_password_from_filename(filename):
#     """Extract password from filename - enhanced version"""
#     filename_lower = filename.lower()
    
#     # Remove file extension
#     name_without_ext = os.path.splitext(filename)[0]
    
#     # Pattern 1: Direct password in filename like "password1234" or "pass1234"
#     password_patterns = [
#         r'password[_\s]*([a-zA-Z0-9]{4,})',
#         r'pwd[_\s]*([a-zA-Z0-9]{4,})',
#         r'pass[_\s]*([a-zA-Z0-9]{4,})',
#         r'pw[_\s]*([a-zA-Z0-9]{4,})',
#     ]
    
#     for pattern in password_patterns:
#         match = re.search(pattern, filename_lower)
#         if match:
#             password = match.group(1)
#             print(f"🔑 Found password in filename: {password}")
#             return password
    
#     # Pattern 2: Numbers at the end of filename (4+ digits)
#     number_match = re.search(r'(\d{4,})$', name_without_ext)
#     if number_match:
#         password = number_match.group(1)
#         print(f"🔑 Found numeric password in filename: {password}")
#         return password
    
#     # Pattern 3: Numbers at the beginning of filename
#     number_match_start = re.search(r'^(\d{4,})', name_without_ext)
#     if number_match_start:
#         password = number_match_start.group(1)
#         print(f"🔑 Found numeric password at start of filename: {password}")
#         return password
    
#     # Pattern 4: Numbers in the middle with common separators
#     number_match_middle = re.search(r'[_-](\d{4,})[_-]', name_without_ext)
#     if number_match_middle:
#         password = number_match_middle.group(1)
#         print(f"🔑 Found numeric password in middle of filename: {password}")
#         return password
    
#     print(f"🔍 No password found in filename: {filename}")
#     return None

# def try_open_pdf_with_passwords(pdf_path, passwords_to_try):
#     """
#     Try to open PDF with multiple passwords
#     Returns pdfplumber.PDF object if successful, None otherwise
#     """
#     for password in passwords_to_try:
#         if not password:
#             continue
            
#         try:
#             print(f"Trying password: {password}")
#             pdf = pdfplumber.open(pdf_path, password=password)
#             # Test if we can access the first page
#             if len(pdf.pages) > 0:
#                 _ = pdf.pages[0]
#             print(f"✅ PDF opened successfully with password: {password}")
#             return pdf
#         except Exception as e:
#             if "password" in str(e).lower() or "encrypted" in str(e).lower():
#                 continue  # Wrong password, try next
#             else:
#                 # Some other error, re-raise
#                 raise e
    
#     return None

# def _create_default_bank_evidence(file_type):
#     """Create default bank evidence structure"""
#     return {
#         'account_number_found': False,
#         'bank_name_found': False,
#         'statement_period_found': False,
#         'transaction_table_found': False,
#         'balance_section_found': False,
#         'transaction_count': 0,
#         'bank_name': None,
#         'account_number': None,
#         'total_score': 0,
#         'currency_found': False,
#         'bank_type': None,
#         'statement_date_found': False,
#         'customer_info_found': False,
#         'has_structured_data': False,
#         'has_bank_specific_patterns': False,
#         'page_count': 0,
#         'file_type': file_type,
#         'password_protected': True,
#         'is_image_pdf': False
#     }

# def detect_bank_specific_patterns_pdf(pdf_path):
#     """FAST detection of BANK STATEMENT patterns - FIRST PAGE ONLY, handles password-protected PDFs"""
#     try:
#         # First try to open without password
#         try:
#             with pdfplumber.open(pdf_path) as pdf:
#                 return _detect_bank_patterns(pdf, pdf_path)
#         except Exception as e:
#             if "password" in str(e).lower() or "encrypted" in str(e).lower():
#                 print(f"PDF is password protected: {os.path.basename(pdf_path)}")
                
#                 # Extract filename to get potential passwords
#                 filename = os.path.basename(pdf_path)
#                 filename_password = extract_password_from_filename(filename)
                
#                 # List of passwords to try
#                 passwords_to_try = []
#                 if filename_password:
#                     passwords_to_try.append(filename_password)
                
#                 # Add common passwords
#                 common_passwords = ['1234', '123456', '0000', '000000', 'password', 'user', '12345678']
#                 passwords_to_try.extend(common_passwords)
                
#                 # Try opening with passwords
#                 pdf = try_open_pdf_with_passwords(pdf_path, passwords_to_try)
                
#                 if pdf:
#                     try:
#                         result = _detect_bank_patterns(pdf, pdf_path)
#                         pdf.close()
#                         return result
#                     except Exception as detect_error:
#                         print(f"Error detecting patterns in password-protected PDF: {detect_error}")
#                         pdf.close()
#                         return _create_default_bank_evidence('pdf')
#                 else:
#                     print(f"❌ Could not open password-protected PDF for pattern detection: {filename}")
#                     return _create_default_bank_evidence('pdf')
#             else:
#                 # Some other error
#                 raise e
                
#     except Exception as e:
#         print(f"PDF pattern detection failed: {e}")
#         return _create_default_bank_evidence('pdf')

# # def extract_data_from_excel(file_path):
# #     """Extract data from Excel files with improved multiple-sheet handling."""
# #     try:
# #         bank_evidence_template = {
# #             'account_number_found': False,
# #             'bank_name_found': False,
# #             'statement_period_found': False,
# #             'transaction_table_found': False,
# #             'balance_section_found': False,
# #             'transaction_count': 0,
# #             'bank_name': None,
# #             'account_number': None,
# #             'total_score': 0,
# #             'currency_found': False,
# #             'file_type': 'excel'
# #         }

# #         try:
# #             excel_data = pd.read_excel(file_path, sheet_name=None)
# #         except Exception as e:
# #             print(f"Error reading Excel file: {e}")
# #             return bank_evidence_template.copy()

# #         best_evidence = None
# #         best_score = -999

# #         # Process each sheet independently
# #         for sheet_name, df in excel_data.items():
# #             print(f"📊 Processing Excel sheet: {sheet_name}")
            
# #             # Prepare textual representation for robust matching:
# #             # 1) header line
# #             # 2) first N rows flattened
# #             headers = " | ".join([str(col) for col in df.columns]) if df.columns is not None else ""
# #             sample_rows = []
# #             max_sample_rows = min(40, len(df))
            
# #             for i in range(max_sample_rows):
# #                 try:
# #                     # FIX: Convert all cells to string before joining
# #                     row = df.iloc[i].fillna("").astype(str).tolist()
# #                     sample_rows.append(" | ".join(row))
# #                 except Exception as row_error:
# #                     print(f"⚠️ Error processing row {i}: {row_error}")
# #                     continue
            
# #             sheet_text = headers + "\n" + "\n".join(sample_rows)

# #             # Start with a fresh evidence copy per sheet
# #             sheet_evidence = bank_evidence_template.copy()
# #             sheet_evidence = detect_bank_patterns_in_text(sheet_text, sheet_evidence)

# #             # Column name heuristics
# #             cols = [str(c).lower() for c in df.columns]
# #             bank_columns = ['date', 'amount', 'balance', 'transaction', 'description', 
# #                           'debit', 'credit', 'withdrawal', 'deposit', 'narration', 
# #                           'particulars', 'value date', 'cheque', 'ref']
# #             column_matches = sum(1 for col in cols if any(bc in col for bc in bank_columns))
            
# #             if column_matches >= 2:
# #                 sheet_evidence['transaction_table_found'] = True
# #                 sheet_evidence['total_score'] += 3

# def extract_data_from_excel(file_path):
#     """Extract data from Excel files with improved multiple-sheet handling."""
#     try:
#         bank_evidence_template = {
#             'account_number_found': False,
#             'bank_name_found': False,
#             'statement_period_found': False,
#             'transaction_table_found': False,
#             'balance_section_found': False,
#             'transaction_count': 0,
#             'bank_name': None,
#             'account_number': None,
#             'total_score': 0,
#             'currency_found': False,
#             'file_type': 'excel'
#         }

#         try:
#             excel_data = pd.read_excel(file_path, sheet_name=None)
#         except Exception as e:
#             print(f"Error reading Excel file: {e}")
#             return bank_evidence_template.copy()

#         best_evidence = None
#         best_score = -999

#         # Process each sheet independently
#         for sheet_name, df in excel_data.items():
#             print(f"📊 Processing Excel sheet: {sheet_name}")
            
#             # Prepare textual representation for robust matching:
#             # 1) header line
#             # 2) first N rows flattened
#             headers = " | ".join([str(col) for col in df.columns]) if df.columns is not None else ""
#             sample_rows = []
#             max_sample_rows = min(40, len(df))
            
#             for i in range(max_sample_rows):
#                 try:
#                     # FIX: Convert all cells to string before joining
#                     row = df.iloc[i].fillna("").astype(str).tolist()
#                     sample_rows.append(" | ".join([str(x) for x in row]))
 
#                 except Exception as row_error:
#                     print(f"⚠️ Error processing row {i}: {row_error}")
#                     continue
            
#             sheet_text = headers + "\n" + "\n".join(sample_rows)

#             # Start with a fresh evidence copy per sheet
#             sheet_evidence = bank_evidence_template.copy()
#             sheet_evidence = detect_bank_patterns_in_text(sheet_text, sheet_evidence)

#             # Column name heuristics
#             cols = [str(c).lower() for c in df.columns]
#             bank_columns = ['date', 'amount', 'balance', 'transaction', 'description', 
#                           'debit', 'credit', 'withdrawal', 'deposit', 'narration', 
#                           'particulars', 'value date', 'cheque', 'ref']
#             column_matches = sum(1 for col in cols if any(bc in col for bc in bank_columns))
            
#             if column_matches >= 2:
#                 sheet_evidence['transaction_table_found'] = True
#                 sheet_evidence['total_score'] += 3


#             # Count transaction-like rows across entire sheet (robust)
#             transaction_count = 0
#             for idx, row in df.iterrows():
#                 try:
#                     # FIX: join only non-empty values, convert to string first
#                     row_text = " ".join([str(x) for x in row if pd.notna(x) and str(x).strip() != ""])
#                     if not row_text:
#                         continue
                    
#                     has_date = re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', row_text)
#                     has_amount = re.search(r'[₹Rs\.\$\€\£]?\s*[0-9,]+\.?[0-9]{0,2}', row_text)
                    
#                     if has_date and has_amount:
#                         transaction_count += 1
#                 except Exception as tx_error:
#                     continue

#             sheet_evidence['transaction_count'] = transaction_count
#             if transaction_count > 0:
#                 sheet_evidence['total_score'] += min(transaction_count * 0.3, 8)

#             print(f"   Sheet '{sheet_name}' score: {sheet_evidence['total_score']}, "
#                   f"transactions: {sheet_evidence['transaction_count']} "
#                   f"(col matches={column_matches})")

#             # Fast-path: if sheet is clearly a bank statement, return immediately
#             if (sheet_evidence['total_score'] >= 8 or 
#                 sheet_evidence['transaction_count'] >= 5 or 
#                 (sheet_evidence['bank_name_found'] and sheet_evidence['transaction_count'] >= 1)):
#                 print(f"✅ Sheet '{sheet_name}' strongly indicates a bank statement – selecting it.")
#                 return sheet_evidence

#             # Track best sheet
#             if sheet_evidence['total_score'] > best_score:
#                 best_score = sheet_evidence['total_score']
#                 best_evidence = sheet_evidence

#         # Use the best sheet evidence found
#         if best_evidence is not None:
#             # Build combined text for share statement rejection check
#             combined_text = ""
#             for sheet_name, df in excel_data.items():
#                 try:
#                     headers = " | ".join([str(col) for col in df.columns]) if df.columns is not None else ""
#                     sample_rows = []
#                     max_sample_rows = min(10, len(df))
                    
#                     for i in range(max_sample_rows):
#                         try:
#                             row = df.iloc[i].fillna("").astype(str).tolist()
#                             sample_rows.append(" | ".join([str(x) for x in row]))

#                         except:
#                             continue
                    
#                     combined_text += headers + "\n" + "\n".join(sample_rows) + "\n\n"
#                 except Exception as sheet_error:
#                     print(f"⚠️ Error processing sheet {sheet_name}: {sheet_error}")
#                     continue

#             if has_share_statement_patterns(combined_text):
#                 print(f"🚫 REJECTED EXCEL: Share/demat statement detected")
#                 best_evidence['total_score'] = -100
#                 return best_evidence

#             return best_evidence

#         # If nothing matched strongly, return template
#         return bank_evidence_template.copy()

#     except Exception as e:
#         print(f"Excel extraction failed: {e}")
#         import traceback
#         traceback.print_exc()
#         return {
#             'account_number_found': False,
#             'bank_name_found': False,
#             'statement_period_found': False,
#             'transaction_table_found': False,
#             'balance_section_found': False,
#             'transaction_count': 0,
#             'total_score': 0,
#             'file_type': 'excel'
#         }

# def detect_bank_patterns_in_text(text, bank_evidence):
#     """Detect bank patterns in text content (common for all file types)"""
#     text_lower = text.lower()
    
#     # BANK NAME Detection
#     bank_patterns = [
#         (r'hdfc\s+bank', 'HDFC Bank'),
#         (r'icici\s+bank', 'ICICI Bank'),
#         (r'state\s+bank\s+of\s+india', 'State Bank of India'),
#         (r'axis\s+bank', 'Axis Bank'),
#         (r'sbi\s+bank', 'SBI Bank'),
#         (r'kotak\s+(mahindra)?\s*bank', 'Kotak Mahindra Bank'),
#         (r'yes\s+bank', 'Yes Bank'),
#         (r'idfc\s+first', 'IDFC First Bank'),
#         (r'punjab\s+national\s+bank', 'PNB'),
#         (r'bank\s+of\s+baroda', 'Bank of Baroda'),
#         (r'canara\s+bank', 'Canara Bank'),
#     ]
    
#     for pattern, bank_name in bank_patterns:
#         if re.search(pattern, text, re.IGNORECASE):
#             bank_evidence['bank_name_found'] = True
#             bank_evidence['bank_name'] = bank_name
#             bank_evidence['total_score'] += 4
#             break
    
#     # ACCOUNT NUMBER Patterns
#     account_patterns = [
#         r'account\s*(number|no|#)?\s*:?\s*[0-9xX\*\-]{8,20}',
#         r'a/c\s*(number|no|#)?\s*:?\s*[0-9xX\*\-]{8,20}',
#         r'savings?\s+account\s*:?\s*[0-9xX\-]{8,20}',
#         r'current\s+account\s*:?\s*[0-9xX\-]{8,20}',
#     ]
    
#     for pattern in account_patterns:
#         matches = re.findall(pattern, text, re.IGNORECASE)
#         if matches:
#             bank_evidence['account_number_found'] = True
#             bank_evidence['total_score'] += 3
#             break
    
#     # BANK STATEMENT PERIOD Patterns
#     period_patterns = [
#         r'statement\s*period\s*:?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s*to\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
#         r'period\s*:?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s*to\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
#     ]
    
#     for pattern in period_patterns:
#         if re.search(pattern, text, re.IGNORECASE):
#             bank_evidence['statement_period_found'] = True
#             bank_evidence['total_score'] += 3
#             break
    
#     # BALANCE Section Detection
#     balance_patterns = [
#         r'opening\s+balance\s*:?\s*[₹Rs\.]?\s*[0-9,]+\.?[0-9]*',
#         r'closing\s+balance\s*:?\s*[₹Rs\.]?\s*[0-9,]+\.?[0-9]*',
#         r'available\s+balance\s*:?\s*[₹Rs\.]?\s*[0-9,]+\.?[0-9]*',
#     ]
    
#     for pattern in balance_patterns:
#         if re.search(pattern, text, re.IGNORECASE):
#             bank_evidence['balance_section_found'] = True
#             bank_evidence['total_score'] += 3
#             break
    
#     # Currency Detection
#     currency_patterns = [
#         (r'₹', 2), (r'rs\.', 1), (r'rs ', 1), (r'inr', 1)
#     ]
    
#     for pattern, weight in currency_patterns:
#         if re.search(pattern, text, re.IGNORECASE):
#             bank_evidence['currency_found'] = True
#             bank_evidence['total_score'] += weight
#             break
    
#     # Banking Keywords
#     banking_keywords = [
#         'closing balance', 'opening balance', 'available balance',
#         'cash withdrawal', 'cash deposit', 'cheque deposit',
#         'neft', 'rtgs', 'imps', 'upi', 'debit', 'credit'
#     ]
    
#     keyword_score = 0
#     for keyword in banking_keywords:
#         if keyword in text_lower:
#             keyword_score += 1
    
#     bank_evidence['total_score'] += min(keyword_score, 5)
    
#     return bank_evidence

# def has_share_statement_patterns(text):
#     """Check if text contains share/demat statement patterns"""
#     text_lower = text.lower()
    
#     # Strong share/demat rejection patterns
#     strong_rejection_patterns = [
#         r'\b(demat\s+account|demat\s+statement)\b',
#         r'\b(share\s+holding|share\s+statement|share\s+portfolio)\b',
#         r'\b(mutual\s+fund|portfolio\s+statement|investment\s+portfolio)\b',
#         r'\b(equity|stock|trading|brokerage)\s+statement\b',
#         r'\b(holding\s+statement|security\s+holding)\b',
#         r'\b(nse|bse|stock\s+exchange)\b',
#         r'\b(folio\s+number|folio\s+no)\b',
#         r'\b(units|nav|purchase\s+price)\b',
#     ]
    
#     for pattern in strong_rejection_patterns:
#         if re.search(pattern, text_lower, re.IGNORECASE):
#             return True
    
#     # Additional share-specific patterns
#     share_specific_patterns = [
#         r'share.*statement',
#         r'demat.*account',
#         r'folio.*number',
#         r'equity.*shares',
#         r'stock.*holding',
#         r'mutual.*fund',
#         r'investment.*portfolio',
#         r'security.*holding',
#         r'holding.*summary',
#         r'brokerage.*statement',
#         r'trading.*account',
#         r'dp.*id',
#         r'client.*id',
#         r'isin.*code',
#         r'dividend.*declaration',
#         r'face.*value',
#         r'market.*price',
#         r'capital.*gain',
#     ]
    
#     share_pattern_count = sum(1 for pattern in share_specific_patterns if re.search(pattern, text_lower, re.IGNORECASE))
    
#     # If multiple share patterns found, reject
#     if share_pattern_count >= 2:
#         return True
    
#     return False

# def extract_data_from_txt(file_path):
#     """Extract data from text files with share statement rejection"""
#     try:
#         bank_evidence = {
#             'account_number_found': False,
#             'bank_name_found': False,
#             'statement_period_found': False,
#             'transaction_table_found': False,
#             'balance_section_found': False,
#             'transaction_count': 0,
#             'bank_name': None,
#             'account_number': None,
#             'total_score': 0,
#             'currency_found': False,
#             'file_type': 'txt'
#         }
        
#         # Read text file with different encodings
#         try:
#             with open(file_path, 'r', encoding='utf-8') as file:
#                 full_text = file.read()
#         except UnicodeDecodeError:
#             try:
#                 with open(file_path, 'r', encoding='latin-1') as file:
#                     full_text = file.read()
#             except UnicodeDecodeError:
#                 with open(file_path, 'r', encoding='cp1252') as file:
#                     full_text = file.read()
        
#         # APPLY SHARE STATEMENT REJECTION FOR TEXT FILES
#         if has_share_statement_patterns(full_text):
#             print(f" REJECTED TEXT: Share/demat statement detected")
#             bank_evidence['total_score'] = -100  # Ensure rejection
#             return bank_evidence
        
#         # Check for bank patterns
#         bank_evidence = detect_bank_patterns_in_text(full_text, bank_evidence)
        
#         # Count transaction-like lines
#         lines = full_text.split('\n')
#         transaction_count = 0
        
#         for line in lines:
#             line_clean = line.strip()
#             if len(line_clean) < 10:
#                 continue
                
#             # Transaction patterns
#             has_date = re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', line_clean)
#             has_amount = re.search(r'[₹Rs\.\$\€\£]?\s*[0-9,]+\.?[0-9]{0,2}', line_clean)
#             has_bank_term = re.search(r'\b(withdrawal|deposit|debit|credit|balance|transfer|payment)\b', line_clean, re.IGNORECASE)
            
#             if (has_date and has_amount) or (has_bank_term and has_amount):
#                 transaction_count += 1
        
#         bank_evidence['transaction_count'] = transaction_count
#         if transaction_count > 0:
#             bank_evidence['total_score'] += min(transaction_count * 0.5, 5)
#             bank_evidence['transaction_table_found'] = True
        
#         return bank_evidence
        
#     except Exception as e:
#         print(f"Text file extraction failed: {e}")
#         return {
#             'account_number_found': False,
#             'bank_name_found': False,
#             'statement_period_found': False,
#             'transaction_table_found': False,
#             'balance_section_found': False,
#             'transaction_count': 0,
#             'total_score': 0,
#             'file_type': 'txt'
#         }

# def detect_bank_specific_patterns(file_path):
#     """Detect bank statement patterns in any file format (PDF/CSV/XLSX/TXT/XML)."""
#     file_extension = file_path.lower().split('.')[-1]

#     if file_extension == 'pdf':
#         return detect_bank_specific_patterns_pdf(file_path)
#     elif file_extension == 'csv':
#         print(f" Processing CSV file: {os.path.basename(file_path)}")
#         return extract_data_from_csv(file_path)
#     elif file_extension in ['xlsx', 'xls']:
#         print(f" Processing Excel file: {os.path.basename(file_path)}")
#         return extract_data_from_excel(file_path)
#     elif file_extension == 'txt':
#         print(f" Processing TEXT file: {os.path.basename(file_path)}")
#         return extract_data_from_txt(file_path)
#     elif file_extension == 'xml':
#         print(f" Processing XML file: {os.path.basename(file_path)}")
#         return extract_data_from_xml(file_path)
#     else:
#         print(f" Unsupported file format: {file_extension}")
#         return {
#             'account_number_found': False,
#             'bank_name_found': False,
#             'statement_period_found': False,
#             'transaction_table_found': False,
#             'balance_section_found': False,
#             'transaction_count': 0,
#             'total_score': 0,
#             'file_type': file_extension
#         }

# def extract_data_from_csv(file_path):
#     """Extract data from CSV files with segment-based processing for multiple tables."""
#     try:
#         bank_evidence_template = {
#             'account_number_found': False,
#             'bank_name_found': False,
#             'statement_period_found': False,
#             'transaction_table_found': False,
#             'balance_section_found': False,
#             'transaction_count': 0,
#             'bank_name': None,
#             'account_number': None,
#             'total_score': 0,
#             'currency_found': False,
#             'file_type': 'csv'
#         }

#         # Read CSV with pandas if possible
#         rows = []
#         encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
        
#         for enc in encodings:
#             try:
#                 with open(file_path, 'r', encoding=enc, errors='ignore') as f:
#                     reader = csv.reader(f)
#                     rows = [row for row in reader]
#                 print(f"✅ CSV read successfully with {enc} encoding")
#                 break
#             except Exception as e:
#                 continue

#         if not rows:
#             print(f"❌ Could not read CSV file with any encoding")
#             return bank_evidence_template.copy()

#         # Join rows into text and detect share patterns quickly
#         try:
#             overall_text = "\n".join([",".join([str(c) for c in r]) for r in rows])
#         except Exception as text_error:
#             print(f"⚠️ Error creating overall text: {text_error}")
#             overall_text = ""
        
#         if has_share_statement_patterns(overall_text):
#             print(f"🚫 REJECTED CSV: Share/demat statement detected")
#             evidence = bank_evidence_template.copy()
#             evidence['total_score'] = -100
#             return evidence

#         # Split into segments separated by blank rows
#         segments = []
#         current = []
        
#         for r in rows:
#             # Treat row as "empty" if all cells are empty/whitespace
#             try:
#                 if all((str(c).strip() == "") for c in r):
#                     if current:
#                         segments.append(current)
#                         current = []
#                 else:
#                     current.append(r)
#             except Exception as row_error:
#                 continue
        
#         if current:
#             segments.append(current)

#         best_evidence = None
#         best_score = -999

#         for idx, seg in enumerate(segments):
#             # Build header + sample rows text for the segment
#             seg_text_lines = []
            
#             if len(seg) >= 1:
#                 try:
#                     header = seg[0]
#                     seg_text_lines.append(" | ".join([str(c) for c in header]))
                    
#                     sample_rows = seg[1:min(len(seg), 21)]
#                     for row in sample_rows:
#                         try:
#                             seg_text_lines.append(" | ".join([str(c) for c in row]))
#                         except:
#                             continue
#                 except Exception as seg_error:
#                     print(f"⚠️ Error processing segment {idx}: {seg_error}")
#                     continue
            
#             seg_text = "\n".join(seg_text_lines)

#             seg_evidence = bank_evidence_template.copy()
#             seg_evidence = detect_bank_patterns_in_text(seg_text, seg_evidence)

#             # Header heuristics
#             if len(seg) >= 1:
#                 try:
#                     headers = [str(c).lower() for c in seg[0]]
#                     bank_headers = ['date', 'amount', 'balance', 'transaction', 'description', 
#                                   'debit', 'credit', 'withdrawal', 'deposit', 'narration', 
#                                   'particulars', 'value date', 'cheque', 'ref']
#                     header_matches = sum(1 for h in headers if any(b in h for b in bank_headers))
                    
#                     if header_matches >= 2:
#                         seg_evidence['transaction_table_found'] = True
#                         seg_evidence['total_score'] += 3
#                 except:
#                     header_matches = 0

#             # Count transaction-like rows in segment
#             transaction_count = 0
#             for row in seg[1:]:
#                 try:
#                     row_text = " ".join([str(c) for c in row if str(c).strip() != ""])
#                     if not row_text:
#                         continue
                    
#                     has_date = re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', row_text)
#                     has_amount = re.search(r'[₹Rs\.\$\€\£]?\s*[0-9,]+\.?[0-9]{0,2}', row_text)
                    
#                     if has_date and has_amount:
#                         transaction_count += 1
#                 except:
#                     continue
            
#             seg_evidence['transaction_count'] = transaction_count
#             if transaction_count > 0:
#                 seg_evidence['total_score'] += min(transaction_count * 0.5, 8)

#             print(f"   Segment {idx+1}: score={seg_evidence['total_score']} "
#                   f"tx_count={seg_evidence['transaction_count']}")

#             # Fast accept segment if strong evidence
#             if (seg_evidence['total_score'] >= 8 or 
#                 seg_evidence['transaction_count'] >= 5 or 
#                 (seg_evidence['bank_name_found'] and seg_evidence['transaction_count'] >= 1)):
#                 print(f"✅ CSV segment {idx+1} strongly indicates a bank statement – selecting it.")
#                 return seg_evidence

#             if seg_evidence['total_score'] > best_score:
#                 best_score = seg_evidence['total_score']
#                 best_evidence = seg_evidence

#         # Fallback to best segment evidence
#         if best_evidence is not None:
#             return best_evidence

#         return bank_evidence_template.copy()

#     except Exception as e:
#         print(f"CSV extraction failed: {e}")
#         import traceback
#         traceback.print_exc()
#         return {
#             'account_number_found': False,
#             'bank_name_found': False,
#             'statement_period_found': False,
#             'transaction_table_found': False,
#             'balance_section_found': False,
#             'transaction_count': 0,
#             'total_score': 0,
#             'file_type': 'csv'
#         }

# def extract_data_from_xml(file_path):
#     """Extract text from XML and run bank pattern detection."""
#     try:
#         bank_evidence = {
#             'account_number_found': False,
#             'bank_name_found': False,
#             'statement_period_found': False,
#             'transaction_table_found': False,
#             'balance_section_found': False,
#             'transaction_count': 0,
#             'bank_name': None,
#             'account_number': None,
#             'total_score': 0,
#             'currency_found': False,
#             'file_type': 'xml'
#         }

#         try:
#             tree = ET.parse(file_path)
#             root = tree.getroot()
#         except Exception as e:
#             print(f"Error parsing XML: {e}")
#             return bank_evidence

#         # Collect text from elements (limit size)
#         parts = []
#         def walk(node, depth=0):
#             if node.text and node.text.strip():
#                 parts.append(node.text.strip())
#             for child in node:
#                 walk(child, depth+1)
#             if node.tail and node.tail.strip():
#                 parts.append(node.tail.strip())
#         walk(root)

#         full_text = "\n".join(parts[:1000])  # cap length
#         if has_share_statement_patterns(full_text):
#             print("🚫 REJECTED XML: Share/demat statement detected")
#             bank_evidence['total_score'] = -100
#             return bank_evidence

#         bank_evidence = detect_bank_patterns_in_text(full_text, bank_evidence)

#         # Count transaction-like lines
#         lines = full_text.splitlines()
#         transaction_count = 0
#         for line in lines:
#             if len(line.strip()) < 8:
#                 continue
#             has_date = re.search(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', line)
#             has_amount = re.search(r'[₹Rs\.\$\€\£]?\s*[0-9,]+\.?[0-9]{0,2}', line)
#             if (has_date and has_amount):
#                 transaction_count += 1
#         bank_evidence['transaction_count'] = transaction_count
#         if transaction_count > 0:
#             bank_evidence['total_score'] += min(transaction_count * 0.5, 8)

#         print(f"📊 XML Analysis: {bank_evidence['transaction_count']} transactions, Score: {bank_evidence['total_score']}")
#         return bank_evidence

#     except Exception as e:
#         print(f"XML extraction failed: {e}")
#         return {
#             'account_number_found': False,
#             'bank_name_found': False,
#             'statement_period_found': False,
#             'transaction_table_found': False,
#             'balance_section_found': False,
#             'transaction_count': 0,
#             'total_score': 0,
#             'file_type': 'xml'
#         }

# def has_bank_statement_structure(file_path):
#     """Detect bank statement structure in any file format, handles password-protected PDFs"""
#     try:
#         print(f" Analyzing: {os.path.basename(file_path)}")
        
#         # Check if it's a PDF and if we need to handle password protection
#         if file_path.lower().endswith('.pdf'):
#             # Get bank-specific evidence for PDF (handles password protection)
#             bank_evidence = detect_bank_specific_patterns_pdf(file_path)
            
#             # If PDF is password protected and we couldn't open it, return low confidence
#             if bank_evidence.get('password_protected', False) and bank_evidence['total_score'] == 0:
#                 print(f" Password protected PDF - keeping for manual review")
#                 return 'low_confidence'
            
#             # Special handling for image PDFs
#             if bank_evidence.get('is_image_pdf', False):
#                 print(f" Image PDF detected - using lenient scoring")
#                 # Be more lenient with image PDFs since text extraction is harder
#                 if bank_evidence['total_score'] >= 6:  # Lower threshold for image PDFs
#                     print(f"✅ Image PDF meets threshold with score {bank_evidence['total_score']}")
#                     return 'medium_confidence'
#                 elif bank_evidence['total_score'] >= 3:
#                     print(f"🟡 Image PDF has some evidence with score {bank_evidence['total_score']}")
#                     return 'low_confidence'
#                 else:
#                     print(f"🔵 Image PDF has low score {bank_evidence['total_score']}")
#                     return 'low_confidence'
#         else:
#             # For non-PDF files, use the original detection
#             bank_evidence = detect_bank_specific_patterns(file_path)
        
#         # Print detailed analysis
#         print(f"📊 BANK STATEMENT ANALYSIS REPORT:")
#         print(f"   File Type: {bank_evidence.get('file_type', 'unknown')}")
#         print(f"   Bank Name: {bank_evidence['bank_name_found']} ({bank_evidence.get('bank_name', 'None')})")
#         print(f"   Account Number: {bank_evidence['account_number_found']}")
#         print(f"   Transaction Count: {bank_evidence['transaction_count']}")
#         print(f"   Statement Period: {bank_evidence['statement_period_found']}")
#         print(f"   Balance Section: {bank_evidence['balance_section_found']}")
#         if bank_evidence.get('is_image_pdf'):
#             print(f"   📷 Image PDF: Yes")
#         print(f"   TOTAL SCORE: {bank_evidence['total_score']}/30")
        
#         # Read file content for rejection patterns
#         full_text = ""
#         try:
#             if file_path.lower().endswith('.pdf'):
#                 # For password-protected PDFs, we may not be able to read content
#                 if not bank_evidence.get('password_protected', False):
#                     # Use enhanced extraction for image PDFs
#                     if bank_evidence.get('is_image_pdf', False):
#                         full_text = extract_text_from_image_pdf(file_path)
#                     else:
#                         with pdfplumber.open(file_path) as pdf:
#                             if len(pdf.pages) > 0:
#                                 page = pdf.pages[0]
#                                 full_text = page.extract_text() or ""
#             else:
#                 # For non-PDF files, read first 10KB for rejection checks
#                 with open(file_path, 'rb') as f:
#                     raw_data = f.read(10240)
#                     try:
#                         full_text = raw_data.decode('utf-8')
#                     except:
#                         try:
#                             full_text = raw_data.decode('latin-1')
#                         except:
#                             full_text = ""
#         except:
#             pass
        
#         full_text = full_text.lower()
        
#         # ENHANCED STRONG REJECTION PATTERNS - Clear non-bank documents
#         strong_rejection_patterns = [
#             # Share/Demat Statements
#             (r'\b(demat\s+account|demat\s+statement)\b', 'Demat/Share Statement'),
#             (r'\b(share\s+holding|share\s+statement|share\s+portfolio)\b', 'Share Holding Statement'),
#             (r'\b(mutual\s+fund|portfolio\s+statement|investment\s+portfolio)\b', 'Investment Portfolio'),
#             (r'\b(equity|stock|trading|brokerage)\s+statement\b', 'Trading/Stock Statement'),
#             (r'\b(holding\s+statement|security\s+holding)\b', 'Security Holding Statement'),
#             (r'\b(nse|bse|stock\s+exchange)\b', 'Stock Exchange Document'),
#             (r'\b(folio\s+number|folio\s+no)\b', 'Mutual Fund Folio'),
#             (r'\b(units|nav|purchase\s+price)\b', 'Investment Units/NAV'),
            
#             # Other non-bank documents
#             (r'\b(resume|cv|curriculum\s+vitae)\b', 'Resume/CV'),
#             (r'\b(powerpoint|presentation|slide)\b', 'Presentation'),
#             (r'\b(credit\s+card\s+statement)\b', 'Credit Card Statement'),
#             (r'\b(tax|income\s+tax|gst)\b', 'Tax Document'),
#             (r'\b(insurance|policy|premium)\b', 'Insurance Document'),
#             (r'\b(loan\s+statement|emi\s+statement)\b', 'Loan Statement'),
#             (r'\b(passport|aadhaar|pan\s+card)\b', 'ID Document'),
#             (r'\b(admit\s+card|hall\s+ticket)\b', 'Admit Card'),
#             (r'\b(syllabus|question\s+paper)\b', 'Educational Document'),
#         ]
        
#         for pattern, doc_type in strong_rejection_patterns:
#             if re.search(pattern, full_text, re.IGNORECASE):
#                 print(f"🚫 REJECTED: {doc_type} detected")
#                 return 'reject'
        
#         # ADDITIONAL SHARE-SPECIFIC PATTERNS
#         share_specific_patterns = [
#             r'share.*statement',
#             r'demat.*account',
#             r'folio.*number',
#             r'equity.*shares',
#             r'stock.*holding',
#             r'mutual.*fund',
#             r'investment.*portfolio',
#             r'security.*holding',
#             r'holding.*summary',
#             r'brokerage.*statement',
#             r'trading.*account',
#             r'dp.*id',
#             r'client.*id',
#             r'isin.*code',
#             r'dividend.*declaration',
#             r'face.*value',
#             r'market.*price',
#             r'capital.*gain',
#         ]
        
#         share_pattern_count = sum(1 for pattern in share_specific_patterns if re.search(pattern, full_text, re.IGNORECASE))
        
#         # If multiple share patterns found, reject even if it has some bank-like elements
#         if share_pattern_count >= 2:
#             print(f"🚫 REJECTED: Multiple share/demat patterns detected ({share_pattern_count} patterns)")
#             return 'reject'
        
#         # Core bank elements
#         core_bank_elements = [
#             bank_evidence['bank_name_found'],
#             bank_evidence['account_number_found'],
#             bank_evidence['transaction_count'] >= 1,
#             bank_evidence['balance_section_found'],
#             bank_evidence['statement_period_found']
#         ]
#         core_score = sum(core_bank_elements)
        
#         print(f"  Core Bank Elements: {core_score}/5")
        
#         # STRICTER CORE ELEMENT BASED DECISION LOGIC
#         # More lenient for image PDFs
#         if bank_evidence.get('is_image_pdf', False):
#             if core_score >= 2:
#                 print(f"✅ HIGH CONFIDENCE: {core_score} core bank elements found in image PDF")
#                 return 'high_confidence'
#             elif core_score >= 1:
#                 print(f"🟡 MEDIUM CONFIDENCE: {core_score} core bank elements found in image PDF")
#                 return 'medium_confidence'
#             else:
#                 print(f"🔵 LOW CONFIDENCE: {core_score} core bank elements found in image PDF")
#                 return 'low_confidence'
#         else:
#             # Original logic for regular PDFs and other files
#             if core_score == 0:
#                 print(f"❌ REJECTED: No core bank elements found")
#                 return 'reject'
#             elif core_score == 1:
#                 if share_pattern_count >= 1:
#                     print(f"🚫 REJECTED: Only 1 core bank element and share patterns detected")
#                     return 'reject'
#                 elif bank_evidence['total_score'] < 5:
#                     print(f"❌ REJECTED: Only 1 core bank element and low total score")
#                     return 'reject'
#                 else:
#                     print(f"🔵 LOW CONFIDENCE: 1 core bank element found - keeping for review")
#                     return 'low_confidence'
#             elif core_score == 2:
#                 if share_pattern_count >= 2:
#                     print(f"🚫 REJECTED: 2 core bank elements but strong share patterns detected")
#                     return 'reject'
#                 print(f"🟡 MEDIUM CONFIDENCE: 2 core bank elements found")
#                 return 'medium_confidence'
#             elif core_score >= 3:
#                 print(f"✅ HIGH CONFIDENCE: {core_score} core bank elements found")
#                 return 'high_confidence'
#             else:
#                 print(f"❌ REJECTED: Insufficient bank statement evidence")
#                 return 'reject'
            
#     except Exception as e:
#         print(f"File analysis failed: {e}")
#         print(f"🟠 UNCERTAIN: Analysis failed - KEEPING FOR MANUAL REVIEW")
#         return 'low_confidence'

# def classify_files(file_paths):
#     """
#     Takes a list of file paths and classifies each as a bank statement or not.
#     Returns a list of dictionaries with confidence score and True/False labels.
#     """
#     results = []

#     for file_path in file_paths:
#         try:
#             print(f"\n🔍 Checking: {file_path}")

#             # Run your internal bank structure detection logic
#             confidence_label = has_bank_statement_structure(file_path)

#             # Scoring system - FIXED: use 'reject' not 'rejected'
#             if confidence_label == "high_confidence":
#                 score = 90
#                 is_bank = True
#             elif confidence_label == "medium_confidence":
#                 score = 70
#                 is_bank = True
#             elif confidence_label == "low_confidence":
#                 score = 50
#                 is_bank = True
#             elif confidence_label == "reject":  # FIXED: changed from "rejected"
#                 score = 20
#                 is_bank = False
#             else:
#                 score = 0
#                 is_bank = False

#             result = {
#                 "file": os.path.basename(file_path),
#                 "file_path": file_path,
#                 "is_bank_statement": is_bank,
#                 "confidence_label": confidence_label,
#                 "confidence_score": score
#             }

#             results.append(result)

#             print(f"✅ {os.path.basename(file_path)} → "
#                   f"{'Bank Statement' if is_bank else 'Not Bank Statement'} "
#                   f"({confidence_label}, Score: {score})")

#         except Exception as e:
#             print(f"❌ Error processing {file_path}: {e}")
#             results.append({
#                 "file": os.path.basename(file_path),
#                 "file_path": file_path,
#                 "is_bank_statement": False,
#                 "confidence_label": "error",
#                 "confidence_score": 0,
#                 "error": str(e)
#             })

#     # Print summary
#     print("\n📊 Summary:")
#     for r in results:
#         print(f"{r['file']}: {'✅ Bank' if r['is_bank_statement'] else '❌ Not Bank'} "
#               f"(Score {r['confidence_score']}, {r['confidence_label']})")

#     return results



# def install_packages():
#     """Install required packages"""
#     packages = ['pdfplumber', 'pandas', 'openpyxl', 'lxml']
    
#     for package in packages:
#         try:
#             subprocess.check_call([sys.executable, '-m', 'pip', 'install', package])
#             print(f"✅ Successfully installed {package}")
#         except subprocess.CalledProcessError:
#             print(f"❌ Failed to install {package}")

# if __name__ == "__main__":
#     print("Installing required packages...")
#     install_packages()
#     print("Setup complete!")


# # Example usage if you run this directly:
# if __name__ == "__main__":
#     test_files = [
#         "samples/HDFC_statement.pdf",
#         "samples/ICICI_statement.xlsx",
#         "samples/Portfolio_Report.pdf",
#         "samples/random_text.txt"
#     ]

#     output = classify_files(test_files)
#     print("\nFinal JSON output:\n", output)




"""
classifier.py — robust, defensive classifier for bank statement detection.

Usage:
    from classifier import classify_files
    results = classify_files(["/path/to/a.pdf", ...])

Each result is a dict:
{
    "file": "narpat.pdf",
    "file_path": "/full/path/narpat.pdf",
    "is_bank_statement": True|False,
    "confidence_score": float between 0 and 1,
    "confidence_label": "bank_statement" | "not_bank_statement" | "error",
    "evidence": ["found keyword 'Account No'", "found date/amount patterns"],
    "error": "traceback or message"  # optional if error happened
}
"""

import os
import re
import traceback
import pdfplumber
import logging
from typing import List, Dict, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Patterns used for simple heuristic detection
DATE_PATTERN = re.compile(r'\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b')
AMOUNT_PATTERN = re.compile(r'\b(?:Rs\.?|INR|₹)?\s?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?\b')
BANK_KEYWORDS = [
    'hdfc', 'icici', 'axis bank', 'axisbank', 'sbi', 'state bank', 'statebank',
    'yes bank', 'kotak', 'indian bank', 'bank of baroda', 'bank of india',
    'account no', 'account number', 'account no.', 'account', 'statement',
    'transaction', 'balance brought forward', 'closing balance', 'debit', 'credit'
]
# Lowercase versions for quick checks
BANK_KEYWORDS_LO = [k.lower() for k in BANK_KEYWORDS]


def safe_read_text_from_pdf(path: str, max_pages: int = 5) -> Dict[str, Any]:
    """
    Open PDF and extract concatenated text from up to first `max_pages` pages.
    Returns dict: { "text": str, "pages_read": int, "error": optional str }
    """
    res = {"text": "", "pages_read": 0, "error": None}
    try:
        if not os.path.exists(path):
            res["error"] = f"file not found: {path}"
            return res

        # Try opening PDF
        with pdfplumber.open(path) as pdf:
            pages = pdf.pages or []
            pages_to_read = min(max_pages, len(pages))
            text_parts = []
            for i, page in enumerate(pages[:pages_to_read]):
                try:
                    # use extract_text() safely
                    page_text = page.extract_text() or ""
                    text_parts.append(page_text)
                except Exception as e_page:
                    logger.warning(f"Failed to extract text from page {i} of {path}: {e_page}")
                    continue
            res["text"] = "\n".join(text_parts)
            res["pages_read"] = pages_to_read
        return res
    except Exception as e:
        # Could be password-protected or damaged
        tb = traceback.format_exc()
        res["error"] = f"failed to open/extract pdf: {e}\n{tb}"
        return res


def heuristic_bank_evidence(text: str) -> List[str]:
    """
    Return evidence list found in text using simple heuristics.
    """
    evidence = []
    if not text or not text.strip():
        return evidence

    text_lo = text.lower()

    # bank keywords
    found_banks = [kw for kw in BANK_KEYWORDS_LO if kw in text_lo]
    if found_banks:
        evidence.append(f"found keywords: {', '.join(sorted(set(found_banks)))[:200]}")

    # dates
    if DATE_PATTERN.search(text):
        evidence.append("found date-like patterns")

    # amounts
    if AMOUNT_PATTERN.search(text):
        evidence.append("found amount-like patterns")

    # lines that look like a transaction row (date + amount)
    # simple heuristic: look for lines containing both date and amount regex
    lines = text.splitlines()
    transaction_like = 0
    for ln in lines[:200]:  # only scan first 200 lines for performance
        if DATE_PATTERN.search(ln) and AMOUNT_PATTERN.search(ln):
            transaction_like += 1
            if transaction_like >= 2:
                break
    if transaction_like >= 2:
        evidence.append(f"found {transaction_like} transaction-like lines")

    # account label
    if "account no" in text_lo or "account number" in text_lo or "a/c no" in text_lo or "a/c" in text_lo:
        evidence.append("found account number label")

    return evidence


def compute_confidence(evidence: List[str]) -> float:
    """
    Compute a simple confidence score [0,1] based on evidence items.
    """
    if not evidence:
        return 0.0
    score = 0.0
    # keywords present boost
    for ev in evidence:
        ev_l = ev.lower()
        if "keywords" in ev_l:
            score += 0.45
        if "transaction-like" in ev_l:
            score += 0.30
        if "date-like" in ev_l:
            score += 0.15
        if "amount-like" in ev_l:
            score += 0.15
        if "account number" in ev_l or "account number label" in ev_l or "account" in ev_l:
            score += 0.10

    # clamp to 0..1
    if score > 1.0:
        score = 1.0
    return round(score, 3)


def classify_single_file(path: str) -> Dict[str, Any]:
    """
    Classify a single file path and return a dict result (never raises).
    """
    base = {"file": os.path.basename(path), "file_path": os.path.abspath(path)}
    try:
        read_res = safe_read_text_from_pdf(path, max_pages=6)
        if read_res.get("error"):
            # Return a structured error result (not crashing)
            return {
                **base,
                "is_bank_statement": False,
                "confidence_score": 0.0,
                "confidence_label": "error",
                "evidence": [],
                "error": read_res["error"]
            }

        text = read_res.get("text", "")
        evidence = heuristic_bank_evidence(text)

        confidence = compute_confidence(evidence)

        # Simple decision rule: confidence >= 0.5 or presence of both keywords and transaction-like evidence
        is_bank = False
        if confidence >= 5:
            is_bank = True
        else:
            # extra safety: if keywords + transaction lines both present
            has_keywords = any("found keywords" in e.lower() for e in evidence)
            has_transactions = any("transaction-like" in e.lower() for e in evidence)
            if has_keywords and has_transactions:
                is_bank = True

        label = "bank_statement" if is_bank else ("not_bank_statement" if not read_res.get("error") else "error")

        return {
            **base,
            "is_bank_statement": bool(is_bank),
            "confidence_score": float(confidence),
            "confidence_label": label,
            "evidence": evidence,
        }
    except Exception as e:
        tb = traceback.format_exc()
        logger.exception("Unexpected error while classifying file %s", path)
        return {
            **base,
            "is_bank_statement": False,
            "confidence_score": 0.0,
            "confidence_label": "error",
            "evidence": [],
            "error": f"{str(e)}\n{tb}"
        }


def classify_files(file_paths: List[str]) -> List[Dict[str, Any]]:
    """
    Main entrypoint: accept list of file paths; always returns a list of results one-per-file.
    """
    results = []
    if not file_paths:
        return results

    for fp in file_paths:
        try:
            result = classify_single_file(fp)
            results.append(result)
        except Exception as e:
            # Defensive: don't let any file crash the entire run
            tb = traceback.format_exc()
            logger.error("Fatal error classifying %s: %s", fp, tb)
            results.append({
                "file": os.path.basename(fp),
                "file_path": os.path.abspath(fp),
                "is_bank_statement": False,
                "confidence_score": 0.0,
                "confidence_label": "error",
                "evidence": [],
                "error": f"{str(e)}\n{tb}"
            })
    return results


# If executed directly, allow a simple CLI
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python classifier.py <file1.pdf> [file2.pdf ...]")
        sys.exit(1)

    fps = sys.argv[1:]
    out = classify_files(fps)
    for r in out:
        print(r)
