"""Entry point that reads PORT from env (Railway sets this)."""
import os
import uvicorn

port = int(os.environ.get("PORT", "8080"))
uvicorn.run("main:app", host="0.0.0.0", port=port)
