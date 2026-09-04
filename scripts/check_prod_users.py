#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
import run_remote as r

cmd = """
docker exec mystore-postgres psql -U camtech -d camtechStore -c 'SELECT * FROM organizations LIMIT 5;'
docker exec mystore-postgres psql -U camtech -d camtechStore -c 'SELECT id, email, name, "organizationId" FROM customers;'
"""
r.exec_remote(cmd)
