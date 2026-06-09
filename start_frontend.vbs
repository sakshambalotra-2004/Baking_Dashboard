Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d D:\baking_dashboard\Baking_Dashboard\frontend && npm start", 0
Set WshShell = Nothing