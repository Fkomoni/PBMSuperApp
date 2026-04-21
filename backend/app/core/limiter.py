"""Shared slowapi rate-limiter instance.

Defined here (not in main.py) so individual routers can import it without
creating a circular dependency through app.main.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
