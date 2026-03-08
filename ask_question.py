"""
PageIndex Q&A Script
Ask questions about your document using the PageIndex tree for retrieval and Gemini for answering.

Usage:
    python ask_question.py --tree results/YOUR_FILE_structure.json --doc YOUR_FILE.md --question "Your question here"

Or interactive mode:
    python ask_question.py --tree results/YOUR_FILE_structure.json --doc YOUR_FILE.md
"""

import argparse
import json
import os
import sys

# Force UTF-8 encoding for Windows console
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from pageindex.utils import ChatGPT_API

def load_tree(tree_path):
    """Load the PageIndex tree structure from a JSON file."""
    with open(tree_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_document(doc_path):
    """Load the original document content."""
    with open(doc_path, 'r', encoding='utf-8') as f:
        return f.read()

def tree_to_string(structure, indent=0):
    """Convert the tree structure to a readable string for the LLM."""
    result = ""
    if isinstance(structure, list):
        for node in structure:
            result += tree_to_string(node, indent)
    elif isinstance(structure, dict):
        title = structure.get('title', 'Untitled')
        node_id = structure.get('node_id', '?')
        summary = structure.get('summary', structure.get('prefix_summary', ''))
        line_num = structure.get('line_num', '?')
        
        result += "  " * indent + f"[{node_id}] {title} (line: {line_num})\n"
        if summary and summary != "Error":
            short_summary = summary[:150] + "..." if len(summary) > 150 else summary
            result += "  " * (indent + 1) + f"Summary: {short_summary}\n"
        
        if 'nodes' in structure:
            result += tree_to_string(structure['nodes'], indent + 1)
    return result

def extract_section_by_lines(doc_content, line_start, line_end):
    """Extract text between two line numbers from the document."""
    lines = doc_content.split('\n')
    start = max(0, line_start - 1)
    end = min(len(lines), line_end)
    return '\n'.join(lines[start:end])

def get_node_line_ranges(structure, all_nodes=None):
    """Get all nodes with their line numbers in order."""
    if all_nodes is None:
        all_nodes = []
    
    if isinstance(structure, list):
        for node in structure:
            get_node_line_ranges(node, all_nodes)
    elif isinstance(structure, dict):
        all_nodes.append({
            'node_id': structure.get('node_id', '?'),
            'title': structure.get('title', ''),
            'line_num': structure.get('line_num', 0),
        })
        if 'nodes' in structure:
            get_node_line_ranges(structure['nodes'], all_nodes)
    
    return all_nodes

def retrieve_relevant_sections(query, tree, doc_content, model="llama-3.3-70b-versatile"):
    """Use LLM tree search to find relevant sections, then extract their text."""
    
    # Step 1: Build tree string for the LLM
    tree_string = tree_to_string(tree.get('structure', tree))
    
    # Step 2: Ask the LLM which nodes are relevant
    prompt = f"""You are given a query and the tree structure of a document.
You need to find all nodes that are likely to contain the answer, and assign each a relevance score from 0.0 to 1.0. 
Higher scores (0.8-1.0) mean the node directly answers the core question. Lower scores (0.3-0.7) mean peripheral or supporting context.

Query: {query}

Document tree structure:
{tree_string}

Reply in the following JSON format:
{{
  "thinking": "<your reasoning about which nodes are relevant>",
  "node_relevance": {{"node_id1": 0.9, "node_id2": 0.4}}
}}
"""
    
    response = ChatGPT_API(model=model, prompt=prompt, response_format={"type": "json_object"})
    
    import re
    # Step 3: Parse the node list from LLM response
    try:
        # Extract everything between the first { and last }
        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            json_str = match.group(0)
            result = json.loads(json_str)
        else:
            result = json.loads(response)
            
        node_relevance = result.get('node_relevance', {})
        if not node_relevance and 'node_list' in result:
            node_relevance = {str(n): 1.0 for n in result['node_list']}
            
        selected_nodes = list(node_relevance.keys())
        thinking = result.get('thinking', '')
    except Exception as e:
        print(f"  [Debug] Parse Error: {e}")
        print(f"  [Debug] Raw LLM response: {response[:200]}...")
        node_relevance = {}
        selected_nodes = []
        thinking = "Could not parse response"
    
    # Step 4: Get all nodes with line numbers
    all_nodes = get_node_line_ranges(tree.get('structure', tree))
    all_nodes.sort(key=lambda x: x['line_num'])
    
    # Step 5: Extract the actual text for selected nodes
    retrieved_text = ""
    retrieved_titles = []
    
    for node_id in selected_nodes:
        node_id_str = str(node_id).zfill(4)
        # Find this node and the next node to determine the text range
        for i, node in enumerate(all_nodes):
            if node['node_id'] == node_id_str:
                start_line = node['line_num']
                # End line is either the next node's line or end of document
                if i + 1 < len(all_nodes):
                    end_line = all_nodes[i + 1]['line_num'] - 1
                else:
                    end_line = len(doc_content.split('\n'))
                
                section_text = extract_section_by_lines(doc_content, start_line, end_line)
                retrieved_text += f"\n--- Section: {node['title']} ---\n{section_text}\n"
                retrieved_titles.append(node['title'])
                break
    
    # Clean up node_relevance to string keys and ensure values are floats
    clean_relevance = {str(k).zfill(4): float(v) for k, v in node_relevance.items()}
    
    return retrieved_text, retrieved_titles, thinking, [str(n).zfill(4) for n in selected_nodes], clean_relevance

def generate_smart_questions(tree, model="llama-3.3-70b-versatile"):
    """Generate 3 highly specific context-aware questions from the document tree."""
    tree_string = tree_to_string(tree.get('structure', tree))
    
    prompt = f"""You are an insightful AI assistant analyzing a newly uploaded document.
Based on the following document's semantic structure map, generate exactly 3 highly specific, insightful, and diverse questions that a user might want to ask about it.
Do not ask generic questions like "What is this document about?". Be specific to the details in the tree.

Document tree structure:
{tree_string}

Reply ONLY in the following exact JSON format:
{{
  "questions": ["Specific question 1?", "Specific question 2?", "Specific question 3?"]
}}
"""
    response = ChatGPT_API(model=model, prompt=prompt, response_format={"type": "json_object"})
    try:
        import re
        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            json_str = match.group(0)
            result = json.loads(json_str)
        else:
            result = json.loads(response)
        return result.get('questions', [])[:3]
    except Exception as e:
        print(f"  [Debug] Parse Error for smart questions: {e}")
        return []

def answer_question(query, context, model="llama-3.3-70b-versatile"):
    """Generate an answer using the retrieved context."""
    prompt = f"""You are a helpful study assistant. Answer the following question using ONLY the context provided below. 
If the answer is not in the context, say "I couldn't find the answer in the provided sections."

Be clear, concise, and use examples from the context when possible.

Context:
{context}

Question: {query}

Answer:"""
    
    response = ChatGPT_API(model=model, prompt=prompt)
    return response

def ask(question, tree_path, doc_path, model="llama-3.3-70b-versatile"):
    """Full pipeline: retrieve relevant sections and answer the question."""
    # Load data
    tree = load_tree(tree_path)
    doc_content = load_document(doc_path)
    
    print(f"\n🔍 Searching for relevant sections...")
    context, titles, thinking, _, _ = retrieve_relevant_sections(question, tree, doc_content, model)
    
    if not context.strip():
        print("❌ Could not find relevant sections.")
        return
    
    print(f"📄 Found {len(titles)} relevant section(s):")
    for t in titles:
        print(f"   → {t}")
    print(f"💭 Reasoning: {thinking}\n")
    
    print("💬 Generating answer...\n")
    answer = answer_question(question, context, model)
    
    print("=" * 60)
    print(f"❓ Question: {question}")
    print("=" * 60)
    print(f"\n{answer}\n")
    print("=" * 60)
    return answer


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Ask questions about your document using PageIndex')
    parser.add_argument('--tree', type=str, required=True, help='Path to the tree structure JSON file')
    parser.add_argument('--doc', type=str, required=True, help='Path to the original document (MD or text)')
    parser.add_argument('--question', type=str, help='Question to ask (omit for interactive mode)')
    parser.add_argument('--model', type=str, default='llama-3.3-70b-versatile', help='Groq model to use')
    args = parser.parse_args()
    
    if not os.path.exists(args.tree):
        print(f"Error: Tree file not found: {args.tree}")
        sys.exit(1)
    if not os.path.exists(args.doc):
        print(f"Error: Document file not found: {args.doc}")
        sys.exit(1)
    
    if args.question:
        # Single question mode
        ask(args.question, args.tree, args.doc, args.model)
    else:
        # Interactive mode
        print("\n🌲 PageIndex Q&A - Interactive Mode")
        print("=" * 40)
        print(f"Document: {args.doc}")
        print(f"Tree: {args.tree}")
        print("Type 'quit' or 'exit' to stop.\n")
        
        while True:
            try:
                question = input("❓ Your question: ").strip()
                if question.lower() in ('quit', 'exit', 'q'):
                    print("👋 Bye!")
                    break
                if not question:
                    continue
                ask(question, args.tree, args.doc, args.model)
                print()
            except KeyboardInterrupt:
                print("\n👋 Bye!")
                break
