extends Node

signal packet(data: Dictionary)
signal disconnected(reason: String)
const ORIGIN = "http://127.0.0.1:8080"
var origin := ORIGIN
var cookie := ""
var session_path := "user://remembered-session.cfg"
var session_epoch := 0
var vault = preload("res://scripts/session_vault.gd").new()
var socket: WebSocketPeer
var connecting_at := 0

func _ready() -> void:
	# Local development by default; HTTPS endpoints can be selected explicitly.
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--test-server=http://127.0.0.1:"):
			origin = arg.trim_prefix("--test-server=")

		elif arg.begins_with("--server=https://"):
			origin = arg.trim_prefix("--server=").trim_suffix("/")

func request(endpoint: String, method := HTTPClient.METHOD_GET, data: Dictionary = {}, auth_cookie := "") -> Dictionary:
	var http := HTTPRequest.new()
	http.timeout = 20.0
	add_child(http)
	var headers := PackedStringArray(["Origin: " + origin, "Content-Type: application/json"])
	var credential: String = auth_cookie if not auth_cookie.is_empty() else cookie
	if not credential.is_empty():
		headers.append("Cookie: " + credential)
	var err := http.request(origin + endpoint, headers, method, JSON.stringify(data) if method != HTTPClient.METHOD_GET else "")
	if err != OK:
		http.queue_free()
		return {"error": "Could not start the server request."}
	var response: Array = await http.request_completed
	http.queue_free()
	if response[0] != HTTPRequest.RESULT_SUCCESS:
		return {"error": "Server connection failed. Check your internet connection."}
	for header in response[2]:
		if header.to_lower().begins_with("set-cookie:"):
			cookie = header.substr(11).strip_edges().split(";")[0]
	var text: String = response[3].get_string_from_utf8()
	if endpoint == "/world-data.mjs" and response[1] == 200:
		text = text.trim_prefix("export default ").trim_suffix(";")
	var parsed = JSON.parse_string(text)
	if not parsed is Dictionary:
		return {"error": "The server returned an unexpected response."}
	parsed["_status"] = int(response[1])
	return parsed

func remember_session() -> bool:
	if origin != ORIGIN or cookie.is_empty(): return false
	var epoch := session_epoch
	var encrypted: String = await vault.transform_async(get_tree(),cookie,true)
	if encrypted.is_empty() or epoch != session_epoch: return false
	var config := ConfigFile.new()
	config.set_value("session","protected",encrypted)
	return config.save(session_path) == OK

func restore_session() -> Dictionary:
	if origin != ORIGIN: return {}
	var config := ConfigFile.new()
	if config.load(session_path) != OK: return {}
	var epoch := session_epoch
	var restored: String = await vault.transform_async(get_tree(),str(config.get_value("session","protected","")),false)
	if epoch != session_epoch: return {}
	if restored.is_empty():
		forget_session()
		return {}
	cookie = restored
	var result: Dictionary = await request("/api/session")
	if epoch != session_epoch: return {}
	if result.get("character") is Dictionary: return result
	# Keep a valid saved token through a temporary network outage.
	if result.get("_status",0) in [200,401,403]: forget_session()
	return result

func forget_session() -> void:
	session_epoch += 1
	cookie = ""
	if FileAccess.file_exists(session_path): DirAccess.remove_absolute(ProjectSettings.globalize_path(session_path))

func logout_session() -> void:
	var previous := cookie
	forget_session()
	if not previous.is_empty(): await request("/api/logout",HTTPClient.METHOD_POST,{},previous)
	cookie = ""

func join_world(id: int) -> Error:
	socket = WebSocketPeer.new()
	socket.inbound_buffer_size = 4194304
	socket.max_queued_packets = 64
	socket.handshake_headers = PackedStringArray(["Origin: " + origin, "Cookie: " + cookie])
	connecting_at = Time.get_ticks_msec()
	return socket.connect_to_url(origin.replace("https://", "wss://").replace("http://", "ws://") + "/ws?loading=1&world=" + str(id))

func send(data: Dictionary) -> void:
	if socket and socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		socket.send_text(JSON.stringify(data))

func leave() -> void:
	if socket:
		socket.close(1000, "Left world")

func _process(_delta: float) -> void:
	if not socket:
		return
	socket.poll()
	var state := socket.get_ready_state()
	if state == WebSocketPeer.STATE_OPEN:
		while socket.get_available_packet_count() > 0:
			var data = JSON.parse_string(socket.get_packet().get_string_from_utf8())
			if data is Dictionary:
				packet.emit(data)
	elif state == WebSocketPeer.STATE_CLOSED:
		var reason := socket.get_close_reason()
		socket = null
		disconnected.emit(reason if not reason.is_empty() else "Disconnected. The character may already be playing in another client.")
	elif state == WebSocketPeer.STATE_CONNECTING and Time.get_ticks_msec() - connecting_at > 20000:
		socket.close()
