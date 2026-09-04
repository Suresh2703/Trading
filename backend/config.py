"""Configuration, read from the environment.

Loads a local `.env` if present so development needs no shell setup, but the
values themselves are never committed.

Anything security-critical is *required*: a default for a signing key or a
database password is worse than no default, because the application starts
happily and looks fine while being wide open. Better to refuse to start and say
exactly which variable is missing.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Sitting beside this file, so scripts run from any directory pick it up.
load_dotenv(Path(__file__).resolve().parent / ".env")


class ConfigError(RuntimeError):
    """Raised at import time when required configuration is absent."""


def require(name: str, hint: str = "") -> str:
    value = os.getenv(name)
    if not value or not value.strip():
        raise ConfigError(
            f"\n\n  Required environment variable {name} is not set."
            f"{chr(10) + '  ' + hint if hint else ''}\n"
            f"  Copy .env.example to .env and fill it in, or export {name} "
            f"in the environment.\n"
        )
    return value.strip()


def require_present(name: str, hint: str = "") -> str:
    """Must be defined, but may be empty.

    An account with genuinely no password is a real (if poor) configuration;
    forgetting the variable entirely is not. This distinguishes them.
    """
    value = os.getenv(name)
    if value is None:
        raise ConfigError(
            f"\n\n  Required environment variable {name} is not set."
            f"{chr(10) + '  ' + hint if hint else ''}\n"
            f"  Copy .env.example to .env and fill it in, or export {name} "
            f"in the environment.\n"
        )
    return value


def optional(name: str, default: str) -> str:
    """For values that are not secret and have a sane, non-risky default."""
    value = os.getenv(name)
    return value.strip() if value and value.strip() else default


# --- Secrets: no defaults, by design ---------------------------------------
SECRET_KEY = require(
    "SECRET_KEY",
    "This signs session tokens — anyone who knows it can forge a login "
    "for any user.")

MYSQL_PASSWORD = require_present(
    "MYSQL_PASSWORD",
    "The database password. Write MYSQL_PASSWORD= with nothing after it "
    "only if the account genuinely has no password.")

# --- Connection details: not secret, safe to default -----------------------
MYSQL_USER = optional("MYSQL_USER", "root")
MYSQL_HOST = optional("MYSQL_HOST", "localhost")
MYSQL_DB = optional("MYSQL_DB", "trading")

ALGORITHM = optional("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(optional("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24)))
