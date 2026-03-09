$ErrorActionPreference = "Stop"

npx concurrently `
  --kill-others `
  --names "renderer,main,electron" `
  --prefix-colors "cyan,magenta,green" `
  "npm run dev:renderer --workspace @klava/desktop" `
  "npm run dev:main --workspace @klava/desktop" `
  "npm run dev:electron --workspace @klava/desktop"
