#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "=========================================="
echo " Building Project Explainer for Production"
echo "=========================================="

echo "1. Installing Python Backend Dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "2. Building React Frontend..."
cd frontend
npm install
npm run build
cd ..

echo "Build completed successfully!"

