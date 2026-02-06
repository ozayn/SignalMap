"""Entry point that reads PORT from env (Railway sets this)."""
import os
import uvicorn

port = int(os.environ.get("PORT", "8080"))
# Use :: for dual-stack (IPv4 + IPv6) - Railway private networking needs IPv6
uvicorn.run("main:app", host="::", port=port)
