# Pi + Cursor SDK helpers (sourced from ~/.zshrc)
# Install: ./scripts/install.sh --shell

# Project Cursor rules only (~50k token system prompt 방지)
export PI_CURSOR_SETTING_SOURCES="${PI_CURSOR_SETTING_SOURCES:-project}"

pi-light() {
  PI_CURSOR_SETTING_SOURCES="${PI_CURSOR_SETTING_SOURCES:-project}" pi --model cursor/composer-2.5 "$@"
}

pi-cursor() {
  pi-light "$@"
}
