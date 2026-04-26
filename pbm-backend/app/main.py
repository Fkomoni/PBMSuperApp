import sys
sys.path.insert(0, "/opt/pbm_deps")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, enrollees, acute_orders, dashboard, riders, stock, claims, reports, audit

app = FastAPI(title="Leadway RxHub — PBM Portal API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(enrollees.router, prefix="/api")
app.include_router(acute_orders.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(riders.router, prefix="/api")
app.include_router(stock.router, prefix="/api")
app.include_router(claims.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(audit.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok", "service": "pbm"}
