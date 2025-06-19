!macro NSIS_HOOK_POSTINSTALL
  ; アプリケーションのパスを定義
  !define APP_PATH "$INSTDIR\fumen.exe"

  ; URLスキームの登録 (HKEY_CURRENT_USER に登録)
  ; HKEY_CURRENT_USER\Software\Classes にスキーム名を登録
  WriteRegStr HKEY_CURRENT_USER "Software\Classes\fumenrs" "" "fumen-rs"
  WriteRegStr HKEY_CURRENT_USER "Software\Classes\fumenrs" "URL Protocol" ""

  ; スキームに関連付けるコマンドを登録
  ; %1 はURL全体をアプリに渡すために必要
  WriteRegStr HKEY_CURRENT_USER "Software\Classes\fumenrs\shell\open\command" "" '"${APP_PATH}" "%1"'

  ; オプション: デフォルトアイコンの設定 (任意)
  ; WriteRegStr HKEY_CURRENT_USER "Software\Classes\fumenrs\DefaultIcon" "" '"${APP_PATH}",1'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; config.json の削除
  Delete "$INSTDIR\config.json"

  ; URLスキームの登録解除 (HKEY_CURRENT_USER から削除)
  DeleteRegKey HKEY_CURRENT_USER "Software\Classes\fumenrs"
!macroend