"""CLI helper to create (or reset password of) a provider account.

Usage (from backend/):
    # interactive — recommended, no password on argv or in shell history
    python seed_provider.py doctor@clinic.com "Dr Jane Doe"

    # non-interactive (CI); password is read from stdin OR the env var
    # RXHUB_SEED_PASSWORD. Either way the value never appears in argv
    # and therefore never shows up in `ps aux` / process accounting.
    RXHUB_SEED_PASSWORD='s3cretPw!' python seed_provider.py doctor@clinic.com "Dr Jane Doe" --from-env
    echo 's3cretPw!' | python seed_provider.py doctor@clinic.com "Dr Jane Doe" --from-stdin
"""
from __future__ import annotations

import argparse
import getpass
import os
import sys

from sqlalchemy import select

from app.core.db import SessionLocal, init_db
from app.core.passwords import hash_password
from app.models import Provider


def _read_password(args: argparse.Namespace) -> str:
    if args.from_env:
        pw = os.environ.get("RXHUB_SEED_PASSWORD", "")
        if not pw:
            print("RXHUB_SEED_PASSWORD env var is empty", file=sys.stderr)
            sys.exit(2)
        return pw
    if args.from_stdin:
        pw = sys.stdin.readline().rstrip("\n")
        if not pw:
            print("empty password on stdin", file=sys.stderr)
            sys.exit(2)
        return pw
    # Interactive tty prompt — getpass echoes no characters; confirm prompt
    # is required to catch typos since we can't undo a hash.
    pw = getpass.getpass("Password: ")
    confirm = getpass.getpass("Confirm: ")
    if pw != confirm:
        print("passwords do not match", file=sys.stderr)
        sys.exit(2)
    return pw


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed/reset a provider account")
    parser.add_argument("email")
    parser.add_argument("name")
    parser.add_argument(
        "--role",
        choices=["provider", "admin"],
        default="provider",
        help="Role (default: provider). Use 'admin' to create an admin account.",
    )
    parser.add_argument("--facility", default=None)
    parser.add_argument("--prognosis-id", default=None)
    parser.add_argument("--phone", default=None)
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--from-env", action="store_true",
                        help="Read password from the RXHUB_SEED_PASSWORD env var")
    source.add_argument("--from-stdin", action="store_true",
                        help="Read password from stdin")
    args = parser.parse_args()

    password = _read_password(args)
    if len(password) < 12:
        print("password must be at least 12 characters", file=sys.stderr)
        sys.exit(2)

    init_db()
    with SessionLocal() as db:
        email = args.email.lower().strip()
        p = db.scalar(select(Provider).where(Provider.email == email))
        if p:
            p.name = args.name
            p.password_hash = hash_password(password)
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
                password_hash=hash_password(password),
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
