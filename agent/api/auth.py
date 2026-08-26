import firebase_admin
from firebase_admin import auth
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Initialize the default app using Application Default Credentials
if not firebase_admin._apps:
    firebase_admin.initialize_app()

security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    """Verifies the Bearer token in the Authorization header."""
    token = credentials.credentials
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        print(f"Token verification failed: {e}")
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def verify_ws_token(token: str):
    """Verifies a token provided via WebSocket connection."""
    try:
        return auth.verify_id_token(token)
    except Exception as e:
        raise ValueError(f"Invalid token: {e}")
