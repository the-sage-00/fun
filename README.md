# 🧠 PageIndex - Intelligent Q&A & Document Retrieval Backend

<div align="center">
  <h3><b>FastAPI Server with PageIndex Hierarchy & Gemini Retrieval</b></h3>
  <p>Structuring documents into JSON outlines for hyper-focused LLM context injection.</p>
</div>

---

## 🎯 What is PageIndex?
PageIndex is a document-indexing and retrieval pipeline. Instead of passing massive documents to LLMs or relying solely on chunk-based vector search, PageIndex parses PDFs and Markdown files into a logical **tree outline**. 

This FastAPI backend serves as the engine to ingest documents, generate their page-structured indexes, and query them using Google Gemini API to get context-aware, page-referenced answers.

---

## 🔥 Key Features
- **Tree-Structured Indexing:** Runs `run_pageindex.py` to parse documents into hierarchically nested JSON outlines.
- **FastAPI Endpoints:** Clean API for document uploading and real-time processing.
- **Intelligent QA Retrieval:** Queries specific nodes of the document outline using the Gemini API for highly precise answering.
- **Daemon Stay-Alive Thread:** Built-in self-pinger to prevent Render or free cloud hosting instances from entering sleep mode.

---

## 🛠️ Tech Stack
- **Framework:** FastAPI, Uvicorn
- **Language:** Python 3.x
- **LLM Engine:** Google Gemini (Generative AI) / OpenAI compatibility
- **Token Management:** Tiktoken-based token counting utilities

---

## ⚙️ API Endpoints

### `GET /health`
Used for health checks and keep-alive monitoring. Returns `{"status": "ok"}`.

### `POST /api/upload`
Uploads a `.md` or `.pdf` document and runs the tree-generation pipeline in the background. Returns the compiled JSON page tree structure and a list of generated smart questions.

---

## 🚀 Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/the-sage-00/fun.git
   cd fun
   ```

2. **Configure Environment Variables:**
   Create a `.env` file and add your credentials:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   RENDER_EXTERNAL_URL=https://your-app.onrender.com (optional)
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Launch the Server:**
   ```bash
   python app.py
   ```
