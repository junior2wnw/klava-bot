$ErrorActionPreference = "Stop"

npm run build --workspace @klava/contracts
npm run build --workspace @klava/runtime
npm run build --workspace @klava/ui
npm run build --workspace @klava/desktop
