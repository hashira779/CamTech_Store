from pathlib import Path

APP = Path(__file__).resolve().parent.parent / "app"


def _modules():
    return [path for path in (APP / "modules").iterdir() if path.is_dir() and path.name != "__pycache__"]


def test_every_module_has_the_standard_entry_files():
    incomplete = [
        module.name
        for module in _modules()
        if not (module / "__init__.py").exists() or not (module / "api.py").exists()
    ]
    assert incomplete == []


def test_routers_live_inside_modules():
    assert not (APP / "routers").exists()
