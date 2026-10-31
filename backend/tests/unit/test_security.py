import pytest
from app.core.security import validate_password, hash_password, verify_password

def test_password_length_boundary():
    # 8 characters fails
    assert validate_password("Abcdef#1") is False
    # 9 characters passes
    assert validate_password("Abcdef#12") is True

def test_password_character_classes():
    # Missing uppercase
    assert validate_password("abcdef#12") is False
    # Missing lowercase
    assert validate_password("ABCDEF#12") is False
    # Missing special character
    assert validate_password("Abcdef123") is False
    # Missing digit is allowed if other criteria met (spec: uppercase, lowercase, special, >8 chars)
    assert validate_password("Abcdefgh#") is True

def test_password_max_length_72_bytes():
    # Exactly 72 bytes passes
    pw_72 = "A" + "a" * 70 + "#"
    assert len(pw_72.encode()) == 72
    assert validate_password(pw_72) is True

    # 73 bytes fails
    pw_73 = "A" + "a" * 71 + "#"
    assert len(pw_73.encode()) == 73
    assert validate_password(pw_73) is False

def test_bcrypt_direct_hashing_and_verification():
    pw = "SuperSecret#2026"
    h = hash_password(pw)
    assert h.startswith("$2b$") or h.startswith("$2a$")
    assert verify_password(pw, h) is True
    assert verify_password("WrongPassword#2026", h) is False
