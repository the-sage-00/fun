from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
from pageindex.utils import count_tokens # to verify it works
import subprocess
import json
import threading
import time
import urllib.request

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
RESULTS_DIR = "results"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

# ── Keep-Alive Ping ───────────────────────────────────────────
# Render free tier sleeps after ~10 min of inactivity.
# This background thread self-pings every 9 minutes to stay awake.

def keep_alive():
    """Ping our own /health endpoint every 9 minutes."""
    render_url = os.environ.get("RENDER_EXTERNAL_URL")  # Render sets this automatically
    if not render_url:
        print("[keep-alive] RENDER_EXTERNAL_URL not set, skipping keep-alive (local dev).")
        return
    health_url = f"{render_url}/health"
    print(f"[keep-alive] Started. Will ping {health_url} every 9 minutes.")
    while True:
        time.sleep(9 * 60)  # 9 minutes
        try:
            urllib.request.urlopen(health_url, timeout=10)
            print("[keep-alive] Ping successful.")
        except Exception as e:
            print(f"[keep-alive] Ping failed: {e}")

# Start keep-alive in a daemon thread (dies when main process exits)
threading.Thread(target=keep_alive, daemon=True).start()

@app.get("/health")
def health_check():
    """Health check endpoint used by keep-alive and monitoring."""
    return {"status": "ok"}

@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    """Uploads a document (MD or PDF) and runs run_pageindex.py on it."""
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Run the tree generation script
    # Figure out if it's pdf or md
    ext = os.path.splitext(file.filename)[1].lower()
    command = ["python", "run_pageindex.py"]
    if ext == ".md":
        command.extend(["--md_path", file_path])
    elif ext == ".pdf":
        command.extend(["--pdf_path", file_path])
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload .md or .pdf.")
        
    try:
        # We don't want to wait forever, but we need it to finish
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = process.communicate()
        
        if process.returncode != 0:
            print("Error running pageindex:", stderr)
            raise HTTPException(status_code=500, detail="Failed to process document")
            
        tree_filename = os.path.splitext(file.filename)[0] + "_structure.json"
        tree_path = os.path.join(RESULTS_DIR, tree_filename)
        
        if not os.path.exists(tree_path):
             # Try fallback if RESULTS_DIR is different in run_pageindex
             if os.path.exists(os.path.join("results", tree_filename)):
                 tree_path = os.path.join("results", tree_filename)
             else:
                 raise HTTPException(status_code=500, detail="Tree structure was not generated.")
                 
        return {"filename": file.filename, "tree_path": tree_path, "tree": json.load(open(tree_path, 'r', encoding='utf-8')), "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from ask_question import retrieve_relevant_sections, answer_question, load_tree, load_document

@app.get("/api/tree/{filename}")
async def get_tree(filename: str):
    """Returns the tree JSON for a previously processed document."""
    tree_filename = os.path.splitext(filename)[0] + "_structure.json"
    tree_path = os.path.join(RESULTS_DIR, tree_filename)
    if not os.path.exists(tree_path):
        tree_path = os.path.join("results", tree_filename)
    if not os.path.exists(tree_path):
        raise HTTPException(status_code=404, detail="Tree not found for this document.")
    with open(tree_path, 'r', encoding='utf-8') as f:
        return json.load(f)

@app.post("/api/ask")
async def ask_question_api(question: str = Form(...), filename: str = Form(...), tree_path: str = Form(...)):
    """Asks a question against the processed document."""
    try:
        file_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(file_path) and not os.path.exists(filename): # fallback to local dir
             file_path = filename

        tree = load_tree(tree_path)
        doc_content = load_document(file_path)
        
        # Use our groq model
        model = "llama-3.3-70b-versatile"
        context, titles, thinking, traversal_path = retrieve_relevant_sections(question, tree, doc_content, model)
        
        if not context.strip():
            return {"answer": "I couldn't find relevant sections for this question.", "sources": [], "traversal_path": [], "thinking": "No relevant sections found."}
            
        answer = answer_question(question, context, model)
        return {"answer": answer, "sources": titles, "traversal_path": traversal_path, "thinking": thinking}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
