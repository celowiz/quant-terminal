"""Saneamento de entradas externas do pipeline (logos vendorizados)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'pipeline'))
import logos  # noqa: E402

PNG = b'\x89PNG\r\n\x1a\n' + b'\0' * 32


def test_safe_png(tmp_path):
    ok = tmp_path / 'PETR.png'; ok.write_bytes(PNG)
    svg = tmp_path / 'EVIL.png'; svg.write_bytes(b'<svg onload=alert(1)>')
    big = tmp_path / 'BIG.png'; big.write_bytes(PNG + b'\0' * (logos.MAX_LOGO_BYTES + 1))
    link = tmp_path / 'LINK.png'; link.symlink_to(ok)
    assert logos._safe_png(str(ok))
    assert not logos._safe_png(str(svg))
    assert not logos._safe_png(str(big))
    assert not logos._safe_png(str(link))
    assert not logos._safe_png(str(tmp_path / 'NONE.png'))
