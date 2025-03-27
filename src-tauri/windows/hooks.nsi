!macro NSIS_HOOK_POSTUNINSTALL
   Delete "$INSTDIR\config.json"
!macroend