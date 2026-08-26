import asyncio
import time
from firebase_admin import firestore

async def execute_remote_command(project_id: str, device_identifier: str, command: str, timeout: float = 20.0) -> str:
    """
    Creates a command document in Firestore and polls for its completion.
    The frontend (desktop app) listens for 'pending' commands, executes them,
    and updates the document to 'completed' or 'error' with the result.
    """
    db = firestore.client()
    
    # Write command document
    doc_ref = db.collection('projects').document(project_id).collection('commands').document()
    doc_ref.set({
        'deviceIdentifier': device_identifier,
        'command': command,
        'status': 'pending',
        'createdAt': firestore.SERVER_TIMESTAMP
    })
    
    # Poll for completion
    start_time = time.time()
    while time.time() - start_time < timeout:
        doc = doc_ref.get()
        if doc.exists:
            data = doc.to_dict()
            status = data.get('status')
            if status == 'completed':
                return data.get('output', '')
            elif status == 'error':
                return f"Error executing command: {data.get('error', 'Unknown error')}"
        
        # Avoid hammering the database too fast
        await asyncio.sleep(0.5)
        
    return "Error: Command execution timed out. The device took too long to respond."
