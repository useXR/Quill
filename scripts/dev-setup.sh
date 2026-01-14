#!/bin/bash
set -e

echo "Setting up Quill development environment..."
echo ""

# Check for required tools
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
  echo "Node.js is required but not installed."
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "Node.js 20+ is required. Found: $(node -v)"
  exit 1
fi
echo "Node.js $(node -v)"

if ! command -v pnpm &> /dev/null; then
  echo "pnpm is required but not installed."
  echo "   Install with: npm install -g pnpm"
  exit 1
fi
echo "pnpm $(pnpm -v)"

if ! command -v docker &> /dev/null; then
  echo "Docker is required for Supabase local development."
  exit 1
fi
echo "Docker installed"

if ! docker ps &> /dev/null; then
  echo "Docker daemon is not running. Start Docker and try again."
  exit 1
fi
echo "Docker daemon running"

echo ""

# Install dependencies
echo "Installing dependencies..."
pnpm install || { echo "pnpm install failed"; exit 1; }
echo "Dependencies installed"

echo ""

# Start Supabase
echo "Starting Supabase local development..."
if pnpm exec supabase status &> /dev/null; then
  echo "Supabase is already running"
else
  echo "Starting Supabase (this takes 2-3 minutes on first run)..."
  pnpm exec supabase start
fi

# Get Supabase credentials
echo ""
echo "Supabase credentials:"
pnpm exec supabase status

# Wait for Supabase to be fully ready
echo ""
echo "Waiting for Supabase to be ready..."
sleep 2

# Generate types
echo ""
echo "Generating TypeScript types..."
pnpm db:types || { echo "Type generation failed"; exit 1; }

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
  echo ""
  echo "Creating .env.local from template..."
  if [ -f ".env.local.example" ]; then
    cp .env.local.example .env.local
    echo ".env.local created from template"
    echo "Please update it with the Supabase keys from above"
  else
    echo "Warning: .env.local.example not found"
  fi
else
  echo ""
  echo ".env.local already exists"
fi

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env.local with the Supabase keys shown above (if not done)"
echo "2. Run 'pnpm dev' to start the development server"
echo ""
echo "Supabase Studio: http://localhost:54323"
