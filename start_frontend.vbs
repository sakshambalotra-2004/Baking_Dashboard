Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d D:\Baking_Dashboard\frontend && npm start", 0
Set WshShell = Nothing