#!/usr/bin/env bash
# Xatolik bo'lsa to'xtatish
set -o errexit

pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate