from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import fitz  # PyMuPDF
import json
import io

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/merge")
async def merge_pdfs(
    instructions: str = Form(...),
    files: list[UploadFile] = File(...)
):
    try:
        inst = json.loads(instructions)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON instructions")

    pages_config = inst.get("pages", [])
    global_config = inst.get("global", {})

    # Read uploaded files into memory
    file_docs = {}
    for f in files:
        content = await f.read()
        file_docs[f.filename] = fitz.open(stream=content, filetype="pdf")

    # Create new output PDF
    out_pdf = fitz.open()

    for p in pages_config:
        filename = p.get("fileId")
        page_idx = p.get("pageIndex")
        
        if filename not in file_docs:
            raise HTTPException(status_code=400, detail=f"File {filename} not found in uploaded files")
        
        src_doc = file_docs[filename]
        if page_idx < 0 or page_idx >= len(src_doc):
            raise HTTPException(status_code=400, detail=f"Invalid page index {page_idx} for {filename}")

        # Insert page into output
        out_pdf.insert_pdf(src_doc, from_page=page_idx, to_page=page_idx)
        
        # Get the just-inserted page
        inserted_page = out_pdf[-1]

        # Apply rotation if any
        rotation = p.get("rotation", 0)
        if rotation:
            inserted_page.set_rotation(rotation)

    # Apply global settings like page numbers
    page_numbers = global_config.get("pageNumbers")
    if page_numbers and page_numbers != "none":
        for idx, page in enumerate(out_pdf):
            text = f"Page {idx + 1}"
            rect = page.rect
            margin = 30
            font_size = 10
            
            # Simple positioning logic
            if "top" in page_numbers:
                y = margin
            else:
                y = rect.height - margin
                
            if "left" in page_numbers:
                x = margin
            elif "right" in page_numbers:
                x = rect.width - margin - (fitz.get_text_length(text, fontname="helv", fontsize=font_size))
            else: # center
                x = (rect.width - fitz.get_text_length(text, fontname="helv", fontsize=font_size)) / 2
            
            page.insert_text((x, y), text, fontsize=font_size, fontname="helv", color=(0, 0, 0))

    # Save to memory
    out_bytes = out_pdf.write()
    
    # Close documents
    for doc in file_docs.values():
        doc.close()
    out_pdf.close()

    return Response(
        content=out_bytes, 
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=merged_output.pdf"}
    )
