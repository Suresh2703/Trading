"""What a system setting is, in one place.

Settings are stored as text in `app_settings`, so something has to own their
type, their default and what counts as a legal value. Keeping that here rather
than splitting it between the schema and the screen means a setting cannot be
saved through the API in a state the UI would never have offered, and adding
one needs no migration.

Every setting listed here is read by code that actually acts on it. Nothing is
recorded merely to look configurable.
"""

SECURITY = "security"
NOTIFICATIONS = "notifications"
API = "api"

SECTIONS = (SECURITY, NOTIFICATIONS, API)


def _int(default, low, high, label, help_text):
    return {"type": "int", "default": default, "min": low, "max": high,
            "label": label, "help": help_text}


def _bool(default, label, help_text):
    return {"type": "bool", "default": default, "label": label, "help": help_text}


REGISTRY = {
    SECURITY: {
        # Enforced wherever a password is set — see routers/users.py.
        "password_min_length": _int(
            8, 6, 64, "Minimum password length",
            "Applied when an account is created and whenever a password changes."),
        "password_require_upper": _bool(
            False, "Require an uppercase letter", "At least one A-Z."),
        "password_require_digit": _bool(
            True, "Require a digit", "At least one 0-9."),
        "password_require_symbol": _bool(
            False, "Require a symbol", "At least one non-alphanumeric character."),

        # Enforced at login — see routers/users.py.
        "lockout_attempts": _int(
            5, 0, 20, "Failed attempts before lockout",
            "Zero disables lockout entirely."),
        "lockout_minutes": _int(
            15, 1, 1440, "Lockout duration (minutes)",
            "How long an account stays locked after too many failures."),

        # Applied when a token is minted — see routers/users.py.
        "session_hours": _int(
            24, 1, 720, "Session length (hours)",
            "How long a sign-in lasts before credentials are needed again."),
    },

    NOTIFICATIONS: {
        # Read by routers/notifications.py, which computes the alerts shown on
        # the bell from the live books.
        "low_stock_enabled": _bool(
            True, "Low stock alerts", "Warn when an item runs down."),
        "low_stock_threshold": _int(
            10, 0, 100000, "Low stock threshold",
            "Alert when stock on hand at a warehouse falls to or below this."),

        "overdue_enabled": _bool(
            True, "Overdue invoice alerts", "Warn about unpaid sales invoices."),
        "overdue_days": _int(
            30, 1, 365, "Treat an invoice as overdue after (days)",
            "Counted from the invoice date."),

        "draft_docs_enabled": _bool(
            True, "Unconfirmed document alerts",
            "Warn about sales and purchase documents still sitting in draft."),

        "negative_stock_enabled": _bool(
            True, "Negative stock alerts",
            "Flag any product showing less than nothing on hand."),
    },

    API: {
        "keys_enabled": _bool(
            True, "Allow API key access",
            "When off, every key is refused without having to revoke them."),
        "key_expiry_days": _int(
            90, 0, 3650, "Default key lifetime (days)",
            "Applied to new keys. Zero creates keys that do not expire."),
    },
}


def defaults(section: str) -> dict:
    return {key: spec["default"] for key, spec in REGISTRY[section].items()}


def spec_for(section: str, key: str):
    return REGISTRY.get(section, {}).get(key)


def storage_key(section: str, key: str) -> str:
    return f"{section}.{key}"


def parse(spec: dict, raw):
    """A stored string back to the type the setting is declared as."""
    if spec["type"] == "bool":
        if isinstance(raw, bool):
            return raw
        return str(raw).strip().lower() in ("1", "true", "yes", "on")

    try:
        value = int(str(raw).strip())
    except (TypeError, ValueError):
        return spec["default"]
    # A value that drifted outside its bounds (an older release, a hand-edited
    # row) is clamped rather than trusted.
    return max(spec["min"], min(spec["max"], value))


def validate(spec: dict, key: str, raw):
    """The value to store, or an explanation of why it cannot be."""
    if spec["type"] == "bool":
        if isinstance(raw, bool):
            return "true" if raw else "false"
        if str(raw).strip().lower() in ("1", "true", "yes", "on"):
            return "true"
        if str(raw).strip().lower() in ("0", "false", "no", "off"):
            return "false"
        raise ValueError(f"{key} must be true or false")

    try:
        value = int(str(raw).strip())
    except (TypeError, ValueError):
        raise ValueError(f"{key} must be a whole number")

    if not (spec["min"] <= value <= spec["max"]):
        raise ValueError(
            f"{key} must be between {spec['min']} and {spec['max']}")
    return str(value)
