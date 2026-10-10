extends RefCounted
# Windows user-bound DPAPI; only an expiring session token is persisted.
# Secret input travels over stdin, never process arguments or logs.
func transform(value: String, encrypt: bool) -> String:
	if OS.get_name() != "Windows" or value.is_empty(): return ""
	var operation := "$r=[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($v),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))" if encrypt else "$r=[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($v),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))"
	var command := "[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); try { $null=[Reflection.Assembly]::LoadWithPartialName('System.Security'); $v=[Console]::ReadLine(); " + operation + "; [Console]::WriteLine($r) } catch { [Console]::WriteLine('') }"
	var executable := OS.get_environment("SystemRoot").path_join("System32/WindowsPowerShell/v1.0/powershell.exe")
	var process := OS.execute_with_pipe(executable,PackedStringArray(["-NoProfile","-NonInteractive","-WindowStyle","Hidden","-Command",command]),true)
	if not process.has("stdio"): return ""
	var pipe: FileAccess = process.stdio
	pipe.store_line(value)
	var result := pipe.get_line().strip_edges()
	pipe.close()
	return result

func transform_async(tree: SceneTree, value: String, encrypt: bool) -> String:
	var worker := Thread.new()
	if worker.start(transform.bind(value,encrypt)) != OK: return ""
	while worker.is_alive(): await tree.process_frame
	return str(worker.wait_to_finish())
