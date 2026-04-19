"""CLI helper to create (or reset password of) a provider account.

Usage (from backend/):
    python seed_provider.py doctor@clinic.com "Dr Jane Doe" 's3cretPw!' [--facility "Clinic Name"]
"""
from __future__ import annotations

import argparse

from sqlalchemy import select

from app.core.db import SessionLocal, init_db
from app.core.passwords import hash_password
from app.models import Provider


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed/reset a provider account")
    parser.add_argument("email")
    parser.add_argument("name")
    parser.add_argument("password")
    parser.add_argument("--role", choices=["provider", "admin"], default="provider",
                        help="Role (default: provider). Use 'admin' to create an admin account.")
    parser.add_argument("--facility", default=None)
    parser.add_argument("--prognosis-id", default=None)
    parser.add_argument("--phone", default=None)
    args = parser.parse_args()

    init_db()
    with SessionLocal() as db:
        email = args.email.lower().strip()
        p = db.scalar(select(Provider).where(Provider.email == email))
        if p:
            p.name = args.name
            p.password_hash = hash_password(args.password)
            p.role = args.role
            if args.facility:
                p.facility = args.facility
            if args.prognosis_id:
                p.prognosis_id = args.prognosis_id
            if args.phone:
                p.phone = args.phone
            action = "Updated"
        else:
            p = Provider(
                email=email,
                name=args.name,
                password_hash=hash_password(args.password),
                role=args.role,
                facility=args.facility,
                prognosis_id=args.prognosis_id,
                phone=args.phone,
            )
            db.add(p)
            action = "Created"
        db.commit()
        db.refresh(p)
        print(f"{action} {p.role} {p.id}  {p.email}  ({p.name})")


if __name__ == "__main__":
    main()
