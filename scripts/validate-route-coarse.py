"""Endpoint-only comparison of the current shared-config route audit.

This intentionally weaker comparison writes route-validation-coarse.json only.
Use validate-route.py for the swept-envelope result.
"""
import runpy
from pathlib import Path

if __name__ == '__main__':
    module = runpy.run_path(str(Path(__file__).with_name('validate-route.py')))
    raise SystemExit(module['main'](coarse=True))
