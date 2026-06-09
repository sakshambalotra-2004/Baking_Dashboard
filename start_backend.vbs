Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d D:\baking_dashboard\Baking_Dashboard\backend && npm start", 0
Set WshShell = Nothing