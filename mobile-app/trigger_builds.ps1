Write-Output "Starting iOS App Store build..."
npx.cmd eas-cli build --platform ios --profile production --auto-submit
Write-Output "Build trigger complete."
