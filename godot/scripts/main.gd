extends Node2D

const SAVE_PATH := "user://haetae_checkpoint.json"
const VIEW_WIDTH := 960.0
const VIEW_HEIGHT := 540.0
const PLAYER_W := 24.0
const PLAYER_H := 44.0
const GRAVITY := 1430.0
const TALISMAN_KEYS := ["red", "blue", "white", "black", "gold"]

var content: Dictionary = {}
var level_index := 0
var level: Dictionary = {}
var platforms: Array = []
var enemies: Array = []
var objects: Array = []
var projectiles: Array = []
var effects: Array = []
var world_width := 3240.0
var player: Dictionary = {}
var stats: Dictionary = {}
var mode := "title"
var route := ""
var ending: Dictionary = {}
var conscience := 100
var time_elapsed := 0.0
var scan_time := 0.0
var shield_time := 0.0
var cast_cooldown := 0.0
var attack_cooldown := 0.0
var dash_cooldown := 0.0
var combo_time := 0.0
var coyote_time := 0.0
var jumps := 0
var escape_wall := -460.0
var escape_grace := 3.0
var message := ""
var message_time := 0.0
var objective := ""
var hint := ""
var pending_npc := ""
var tutorial: Dictionary = {}
var lesson_queue: Array = []
var learned: Array = []
var tutorial_hits := 0
var tutorial_pending := 0.0
var practice_shot: Dictionary = {}
var checkpoint: Dictionary = {}
var camera: Camera2D
var camera_x := 480.0
var fire_left := false
var fire_right := false
var scene_ui: CanvasLayer
var hud_top: Label
var hud_bottom: Label
var hud_notice: Label
var hud_boss: Label
var hud_help: Label
var title_panel: ColorRect
var title_resume: Button
var modal_panel: ColorRect
var modal_title: Label
var modal_body: Label
var modal_buttons: Array = []
var tutorial_panel: ColorRect
var tutorial_title: Label
var tutorial_body: Label
var tutorial_goal: Label
var tutorial_skip: Button
var tutorial_finish: Button
var audio_player: AudioStreamPlayer


func _ready() -> void:
	var file := FileAccess.open("res://data/game.json", FileAccess.READ)
	if file == null:
		push_error("게임 데이터를 읽을 수 없습니다.")
		return
	content = JSON.parse_string(file.get_as_text())
	file.close()
	camera = Camera2D.new()
	camera.name = "FollowCamera"
	camera.enabled = true
	camera.position = Vector2(480, 270)
	add_child(camera)
	var generator := AudioStreamGenerator.new()
	generator.mix_rate = 22050
	generator.buffer_length = 0.3
	audio_player = AudioStreamPlayer.new()
	audio_player.stream = generator
	add_child(audio_player)
	audio_player.play()
	_build_ui()
	start_new(false)


func _make_label(parent: Node, text_value: String, at: Vector2, size: Vector2, font_size: int = 18, color: Color = Color.WHITE) -> Label:
	var label := Label.new()
	label.text = text_value
	label.position = at
	label.size = size
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(label)
	return label


func _make_button(parent: Node, text_value: String, at: Vector2, size: Vector2, call: Callable) -> Button:
	var button := Button.new()
	button.text = text_value
	button.position = at
	button.size = size
	button.add_theme_font_size_override("font_size", 17)
	button.pressed.connect(call)
	parent.add_child(button)
	return button


func _build_ui() -> void:
	scene_ui = CanvasLayer.new()
	scene_ui.name = "Interface"
	add_child(scene_ui)
	hud_top = _make_label(scene_ui, "", Vector2(20, 12), Vector2(920, 70), 17)
	hud_bottom = _make_label(scene_ui, "", Vector2(20, 477), Vector2(920, 56), 15, Color("#d7e9e7"))
	hud_notice = _make_label(scene_ui, "", Vector2(20, 82), Vector2(585, 67), 17, Color("#ffdf9b"))
	hud_boss = _make_label(scene_ui, "", Vector2(220, 442), Vector2(520, 28), 15, Color("#ffb7a5"))
	hud_boss.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hud_help = _make_label(scene_ui, "WASD 이동 · Space 점프 · Shift 대시 · 좌클릭 공격 · 우클릭 강화 · Q 기술 · E 인챈트 · F 조사", Vector2(20, 516), Vector2(920, 24), 12, Color("#9bb3bf"))

	title_panel = ColorRect.new()
	title_panel.color = Color(0.035, 0.055, 0.11, 0.94)
	title_panel.position = Vector2.ZERO
	title_panel.size = Vector2(960, 540)
	scene_ui.add_child(title_panel)
	_make_label(title_panel, "HAETAE", Vector2(90, 91), Vector2(780, 65), 54, Color("#f6d187"))
	_make_label(title_panel, "금지된 성역", Vector2(92, 159), Vector2(780, 56), 31, Color("#f4f1e7"))
	_make_label(title_panel, "디지털 도사 설매화의 네 구역, 다섯 부적, 마지막 선택", Vector2(94, 224), Vector2(780, 38), 18, Color("#acc7d6"))
	_make_button(title_panel, "새 게임", Vector2(95, 317), Vector2(235, 52), func(): start_new(true))
	title_resume = _make_button(title_panel, "기록 이어하기", Vector2(346, 317), Vector2(235, 52), func(): continue_game())
	_make_label(title_panel, "Godot 4 · 마우스로 조준하고 왼쪽 / 오른쪽 클릭으로 공격", Vector2(95, 403), Vector2(770, 47), 15, Color("#8da8b5"))

	modal_panel = ColorRect.new()
	modal_panel.color = Color(0.035, 0.055, 0.11, 0.96)
	modal_panel.position = Vector2(190, 95)
	modal_panel.size = Vector2(580, 360)
	scene_ui.add_child(modal_panel)
	modal_title = _make_label(modal_panel, "", Vector2(30, 26), Vector2(520, 46), 29, Color("#f6d187"))
	modal_body = _make_label(modal_panel, "", Vector2(30, 86), Vector2(520, 200), 17, Color("#eef4ee"))
	for i in 3:
		modal_buttons.append(_make_button(modal_panel, "", Vector2(30 + i * 178, 294), Vector2(166, 43), _on_modal_button.bind(i)))
	modal_panel.visible = false

	tutorial_panel = ColorRect.new()
	tutorial_panel.color = Color(0.04, 0.075, 0.13, 0.95)
	tutorial_panel.position = Vector2(623, 90)
	tutorial_panel.size = Vector2(322, 380)
	scene_ui.add_child(tutorial_panel)
	tutorial_title = _make_label(tutorial_panel, "", Vector2(19, 16), Vector2(284, 55), 20, Color("#f5d184"))
	tutorial_body = _make_label(tutorial_panel, "", Vector2(19, 82), Vector2(284, 190), 16, Color("#f3f3f0"))
	tutorial_goal = _make_label(tutorial_panel, "", Vector2(19, 278), Vector2(284, 48), 15, Color("#85e3d1"))
	tutorial_skip = _make_button(tutorial_panel, "나중에 배우기", Vector2(19, 337), Vector2(139, 33), func(): finish_tutorial(true))
	tutorial_finish = _make_button(tutorial_panel, "수련 마치기", Vector2(167, 337), Vector2(136, 33), func(): finish_tutorial(false))
	tutorial_panel.visible = false


func start_new(persist: bool = true) -> void:
	time_elapsed = 0.0
	conscience = 100
	stats = {"kills": 0, "memories": 0, "logs": 0, "damageTaken": 0, "time": 0.0}
	route = ""
	ending = {}
	learned = []
	lesson_queue = []
	tutorial = {}
	checkpoint = {}
	player = {
		"x": 80.0, "y": 416.0, "vx": 0.0, "vy": 0.0, "facing": 1,
		"hp": 150.0, "max_hp": 150.0, "energy": 100.0,
		"invulnerable": 0.0, "dash_time": 0.0, "attack_time": 0.0,
		"combo": 0, "buff": "", "buff_time": 0.0, "enchant_cooldown": 0.0,
		"selected": 0, "unlocked": [0, 1], "tiger_evolved": false
	}
	load_level(0)
	if persist:
		save_checkpoint()
		enqueue_lesson("red")
		start_next_lesson()
	else:
		mode = "title"
	_refresh_ui()


func load_level(index: int) -> void:
	level_index = index
	level = content["levels"][index].duplicate(true)
	world_width = float(level["width"])
	platforms = level["platforms"].duplicate(true)
	enemies = level["enemies"].duplicate(true)
	objects = level["objects"].duplicate(true)
	for e in enemies:
		e["origin_x"] = float(e["x"])
		e["cooldown"] = 1.2
		e["stun"] = 0.0
		e["revealed"] = 0.0
		e["burn_time"] = 0.0
		e["burn_tick"] = 0.5
	for p in platforms:
		p["base_x"] = float(p["x"])
	projectiles = []
	effects = []
	player["x"] = 80.0
	player["y"] = 416.0
	player["vx"] = 0.0
	player["vy"] = 0.0
	player["hp"] = 150.0
	player["energy"] = 100.0
	player["buff"] = ""
	player["buff_time"] = 0.0
	player["enchant_cooldown"] = 0.0
	player["invulnerable"] = 1.2
	scan_time = 0.0
	shield_time = 0.0
	cast_cooldown = 0.0
	attack_cooldown = 0.0
	dash_cooldown = 0.0
	combo_time = 0.0
	jumps = 0
	coyote_time = 0.0
	escape_wall = -460.0
	escape_grace = 3.0
	objective = str(level["objective"])
	mode = "playing"
	notice("소도에 접속했습니다. A·D 이동, Space 2단 점프, 좌클릭 공격." if index == 0 else objective, 5.0)
	_update_camera()


func notice(value: String, duration: float = 3.5) -> void:
	message = value
	message_time = duration


func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mouse_event := event as InputEventMouseButton
		if mouse_event.button_index == MOUSE_BUTTON_LEFT:
			fire_left = mouse_event.pressed and (mode == "playing" or mode == "tutorial") and (mode != "tutorial" or mouse_event.position.x < 615)
		elif mouse_event.button_index == MOUSE_BUTTON_RIGHT:
			fire_right = mouse_event.pressed and (mode == "playing" or mode == "tutorial") and (mode != "tutorial" or mouse_event.position.x < 615)
		elif mouse_event.pressed and (mode == "playing" or mode == "tutorial"):
			if mouse_event.button_index == MOUSE_BUTTON_WHEEL_UP:
				cycle_talisman(-1)
			elif mouse_event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
				cycle_talisman(1)
	if event is InputEventKey:
		var key_event := event as InputEventKey
		if not key_event.pressed or key_event.echo:
			return
		var key := key_event.keycode
		if key == KEY_ESCAPE or key == KEY_P:
			if mode == "playing": mode = "paused"
			elif mode == "paused" or mode == "help": mode = "playing"
			elif mode == "tutorial": finish_tutorial(true)
			_refresh_ui()
			return
		if mode == "title":
			if key == KEY_ENTER: start_new(true)
			return
		if mode == "tutorial" and key == KEY_F and bool(tutorial.get("completed", false)):
			finish_tutorial(false)
			return
		if mode != "playing" and mode != "tutorial":
			return
		if key >= KEY_1 and key <= KEY_5:
			select_talisman(key - KEY_1)
		elif key == KEY_Q: cast()
		elif key == KEY_E: enchant()
		elif key == KEY_F: interact()
		elif key == KEY_SHIFT: dash()
		elif key == KEY_SPACE or key == KEY_W or key == KEY_UP: jump()
		elif key == KEY_H and mode == "playing":
			mode = "help"
			_refresh_ui()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_WINDOW_FOCUS_OUT:
		fire_left = false
		fire_right = false
		if mode == "playing":
			mode = "paused"
			_refresh_ui()


func _physics_process(delta: float) -> void:
	var dt: float = minf(delta, 1.0 / 30.0)
	if mode != "playing" and mode != "tutorial":
		return
	if mode == "playing" and level_index == 0 and float(player["x"]) >= 220.0 and learned.has("red"):
		enqueue_lesson("blue")
		start_next_lesson()
	if mode == "playing":
		time_elapsed += dt
		stats["time"] = float(stats["time"]) + dt
	_update_timers(dt)
	if fire_right: enhanced_attack()
	elif fire_left: attack()
	_move_player(dt)
	_update_projectiles(dt)
	if mode == "tutorial":
		_update_practice(dt)
	else:
		_update_enemies(dt)
		_collect_nearby()
		_update_escape(dt)
		start_next_lesson()
	_update_hint()
	_update_camera()
	_refresh_ui()
	queue_redraw()


func _update_timers(dt: float) -> void:
	scan_time = maxf(0.0, scan_time - dt)
	shield_time = maxf(0.0, shield_time - dt)
	cast_cooldown = maxf(0.0, cast_cooldown - dt)
	attack_cooldown = maxf(0.0, attack_cooldown - dt)
	dash_cooldown = maxf(0.0, dash_cooldown - dt)
	combo_time = maxf(0.0, combo_time - dt)
	message_time = maxf(0.0, message_time - dt)
	player["invulnerable"] = maxf(0.0, float(player["invulnerable"]) - dt)
	player["dash_time"] = maxf(0.0, float(player["dash_time"]) - dt)
	player["attack_time"] = maxf(0.0, float(player["attack_time"]) - dt)
	player["enchant_cooldown"] = maxf(0.0, float(player["enchant_cooldown"]) - dt)
	player["energy"] = minf(100.0, float(player["energy"]) + dt * 14.0)
	if str(player["buff"]) != "":
		player["buff_time"] = maxf(0.0, float(player["buff_time"]) - dt)
		if float(player["buff_time"]) <= 0.0: end_enchant()
	for object in objects:
		object["cooldown"] = maxf(0.0, float(object.get("cooldown", 0.0)) - dt)
	for effect in effects:
		effect["life"] = float(effect["life"]) - dt
	effects = effects.filter(func(e): return float(e["life"]) > 0.0)
	if combo_time <= 0.0: player["combo"] = 0


func _player_rect() -> Rect2:
	return Rect2(float(player["x"]), float(player["y"]), PLAYER_W, PLAYER_H)


func _rect_of(entry: Dictionary) -> Rect2:
	return Rect2(float(entry["x"]), float(entry["y"]), float(entry["w"]), float(entry["h"]))


func _center_x(entry: Dictionary) -> float:
	return float(entry["x"]) + float(entry["w"]) * 0.5


func _distance_x(entry: Dictionary) -> float:
	return absf(_center_x(entry) - float(player["x"]) - PLAYER_W * 0.5)


func _solid_platforms() -> Array:
	if mode == "tutorial": return [{"x": 0.0, "y": 460.0, "w": 960.0, "h": 90.0}]
	return platforms.filter(func(p): return not bool(p.get("hidden", false)) or scan_time > 0.0 or bool(player["tiger_evolved"]))


func _move_player(dt: float) -> void:
	var direction := int(Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT)) - int(Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT))
	var aim := get_global_mouse_position()
	if mode == "tutorial": aim = get_viewport().get_mouse_position()
	if aim.x != float(player["x"]) + 12.0:
		player["facing"] = 1 if aim.x > float(player["x"]) + 12.0 else -1
	elif direction != 0:
		player["facing"] = direction
	var old_bottom: float = float(player["y"]) + PLAYER_H
	if _is_grounded():
		jumps = 0
		coyote_time = 0.1
	else:
		coyote_time = maxf(0.0, coyote_time - dt)
	var speed := 310.0 if str(player["buff"]) == "blue" else 230.0
	if mode == "playing" and level_index == 3 and float(player["x"]) > 930.0 and float(player["x"]) < 1320.0 and str(player["buff"]) != "black" and shield_time <= 0.0:
		speed *= 0.72
	player["vx"] = float(player["facing"]) * 760.0 if float(player["dash_time"]) > 0.0 else direction * speed
	player["vy"] = float(player["vy"]) * 0.75 if float(player["dash_time"]) > 0.0 else minf(850.0, float(player["vy"]) + GRAVITY * dt)
	var old_x := float(player["x"])
	var max_x := 936.0 if mode == "tutorial" else world_width - PLAYER_W
	player["x"] = clampf(old_x + float(player["vx"]) * dt, 0.0, max_x)
	if mode == "playing":
		for object in objects:
			if str(object["type"]) != "gate" or not bool(object.get("active", true)) or str(object.get("value", "")) == "illusion": continue
			if _player_rect().intersects(_rect_of(object)):
				player["x"] = float(object["x"]) - PLAYER_W if old_x + PLAYER_W <= float(object["x"]) + 2.0 else float(object["x"]) + float(object["w"])
				player["vx"] = 0.0
	player["y"] = float(player["y"]) + float(player["vy"]) * dt
	for platform in _solid_platforms():
		if bool(platform.get("moving", false)) and mode == "playing":
			platform["x"] = float(platform["base_x"]) + sin(time_elapsed * 0.9) * 65.0
		if float(player["vy"]) >= 0.0 and old_bottom <= float(platform["y"]) + 2.0 and float(player["y"]) + PLAYER_H >= float(platform["y"]) and float(player["x"]) + PLAYER_W > float(platform["x"]) and float(player["x"]) < float(platform["x"]) + float(platform["w"]):
			player["y"] = float(platform["y"]) - PLAYER_H
			player["vy"] = 0.0
	if float(player["y"]) > 610.0:
		if mode == "playing": hurt(22.0, true)
		player["x"] = 80.0
		player["y"] = 416.0
		player["vy"] = 0.0
		player["invulnerable"] = 1.8


func _is_grounded() -> bool:
	for platform in _solid_platforms():
		if absf(float(player["y"]) + PLAYER_H - float(platform["y"])) < 2.0 and float(player["x"]) + PLAYER_W > float(platform["x"]) and float(player["x"]) < float(platform["x"]) + float(platform["w"]): return true
	return false


func jump() -> void:
	if jumps >= 2 and coyote_time <= 0.0: return
	if not _is_grounded() and coyote_time <= 0.0 and jumps == 0: jumps = 1
	player["vy"] = -505.0
	jumps += 1
	coyote_time = 0.0
	_effect("jump", Vector2(float(player["x"]) + 12.0, float(player["y"]) + 44.0), Color("#a9d5de"), 24.0, 0.25)
	_sound("jump")


func dash() -> void:
	if dash_cooldown > 0.0: return
	var direction := int(Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT)) - int(Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT))
	if direction != 0: player["facing"] = direction
	player["dash_time"] = 0.27 if str(player["buff"]) == "blue" else 0.19
	player["invulnerable"] = maxf(float(player["invulnerable"]), float(player["dash_time"]))
	dash_cooldown = 0.7
	_effect("dash", Vector2(float(player["x"]) + 12.0, float(player["y"]) + 22.0), Color("#55d7ef"), 46.0, 0.25)
	_sound("dash")
	if mode == "tutorial" and str(player["buff"]) == "blue": _lesson_action("dash")


func select_talisman(index: int) -> void:
	if index < 0 or index > 4: return
	player["selected"] = index
	if mode == "tutorial" and index == int(tutorial.get("index", -1)): _lesson_action("select")


func cycle_talisman(direction: int) -> void:
	var current := int(player["selected"])
	for i in 5:
		current = (current + direction + 5) % 5
		if player["unlocked"].has(current):
			select_talisman(current)
			return


func _update_camera() -> void:
	camera_x = 480.0 if mode == "tutorial" else clampf(float(player["x"]) + 350.0, 480.0, maxf(480.0, world_width - 480.0))
	camera.position = Vector2(camera_x, 270.0)


func _shot(damage: float, source: String, buff: String = "", max_range: float = 650.0, hostile: bool = false, origin: Vector2 = Vector2.INF, target: Vector2 = Vector2.INF) -> void:
	if origin == Vector2.INF: origin = Vector2(float(player["x"]) + 12.0, float(player["y"]) + 20.0)
	if target == Vector2.INF: target = get_global_mouse_position()
	var direction := (target - origin).normalized()
	if direction.length_squared() < 0.1: direction = Vector2(float(player["facing"]), 0.0)
	if not hostile and absf(direction.x) > 0.001: player["facing"] = 1 if direction.x > 0.0 else -1
	var color := Color("#c2eeed")
	if hostile: color = Color("#f77d99")
	elif buff != "": color = Color(str(content["talismans"][TALISMAN_KEYS.find(buff)]["color"]))
	elif source == "red": color = Color("#ff5b70")
	projectiles.append({"pos": origin, "velocity": direction * (190.0 if hostile else 760.0), "damage": damage, "source": source, "buff": buff, "life": 5.0 if hostile else max_range / 760.0, "hostile": hostile, "color": color})


func attack(enhanced: bool = false) -> bool:
	if attack_cooldown > 0.0: return false
	var buff := str(player["buff"]) if enhanced else ""
	player["combo"] = 1 if mode == "tutorial" or combo_time <= 0.0 else int(player["combo"]) % 3 + 1
	combo_time = 0.85
	attack_cooldown = 0.19 if buff == "blue" else 0.28
	player["attack_time"] = 0.2
	var damage := 32.0 if int(player["combo"]) == 3 else 22.0
	if buff == "red": damage *= 1.7
	if buff == "white": damage *= 2.0
	_shot(damage, "critical" if buff == "white" else "melee", buff)
	_effect("slash", Vector2(float(player["x"]) + 12.0, float(player["y"]) + 20.0), Color("#f4d393") if buff == "" else Color(str(content["talismans"][TALISMAN_KEYS.find(buff)]["color"])), 35.0, 0.16)
	_sound("attack")
	if buff == "white":
		if bool(player["tiger_evolved"]): player["buff_time"] = minf(1.0, float(player["buff_time"]))
		else: end_enchant()
	return true


func enhanced_attack() -> bool:
	if attack_cooldown > 0.0: return false
	if not player["unlocked"].has(int(player["selected"])):
		notice("아직 얻지 못한 부적입니다. 휠로 보유 부적을 선택하세요.", 2.0)
		return false
	if int(player["selected"]) == 4:
		notice("기린은 코어 열쇠입니다. 좌클릭으로 기본 공격하세요.", 2.0)
		return false
	if mode == "tutorial" and str(_current_step().get("action", "")) == "enchant":
		notice("이번에는 E로 강화만 준비하세요.", 2.0)
		return false
	if str(player["buff"]) == "" and not enchant(): return false
	if str(player["buff"]) != TALISMAN_KEYS[int(player["selected"])]:
		notice("다른 부적의 강화가 유지 중입니다.", 2.0)
		return false
	return attack(true)


func enchant() -> bool:
	var index := int(player["selected"])
	if not player["unlocked"].has(index):
		notice("아직 얻지 못한 부적입니다.", 2.0)
		return false
	if mode == "tutorial" and index != int(tutorial["index"]):
		notice("이번 수련의 부적을 선택하세요.", 2.0)
		return false
	if index == 4:
		notice("기린은 코어 열쇠입니다. 인챈트할 수 없습니다.", 2.0)
		return false
	if str(player["buff"]) != "":
		notice("이미 강화 중입니다.", 1.5)
		return false
	if float(player["enchant_cooldown"]) > 0.0:
		notice("옥추선 냉각 중 · %d초" % ceili(float(player["enchant_cooldown"])), 2.0)
		return false
	player["buff"] = TALISMAN_KEYS[index]
	player["buff_time"] = 30.0 if index == 2 and bool(player["tiger_evolved"]) else float(content["talismans"][index]["duration"])
	_effect("enchant", Vector2(float(player["x"]) + 12.0, float(player["y"]) + 20.0), Color(str(content["talismans"][index]["color"])), 80.0, 0.7)
	_sound("enchant")
	notice("%s의 힘이 옥추선에 깃듭니다." % str(content["talismans"][index]["name"]))
	if mode == "tutorial": _lesson_action("enchant")
	return true


func end_enchant() -> void:
	if str(player["buff"]) == "": return
	player["buff"] = ""
	player["buff_time"] = 0.0
	player["enchant_cooldown"] = 30.0
	notice("옥추선 냉각 · 30초", 2.0)


func cast() -> bool:
	var index := int(player["selected"])
	if not player["unlocked"].has(index):
		notice("아직 얻지 못한 부적입니다.", 2.0)
		return false
	if mode == "tutorial":
		if tutorial_pending > 0.0: return false
		if int(tutorial["index"]) != index:
			notice("이번 수련의 부적을 선택하세요.", 2.0)
			return false
		if index == 4:
			_lesson_action("inspect")
			return true
		if float(player["energy"]) < 20.0: player["energy"] = 100.0
		player["energy"] = float(player["energy"]) - 20.0
		cast_cooldown = 0.3
		if index == 0: _shot(52.0, "red", "", 800.0)
		elif index == 1 or index == 2:
			scan_time = 12.0 if index == 2 else 8.0
			_lesson_action("cast")
		elif index == 3:
			shield_time = 5.0
			practice_shot = {"timer": 1.1}
		return true
	if cast_cooldown > 0.0: return false
	if index == 4:
		for object in objects:
			if str(object["type"]) == "core" and bool(object.get("active", true)) and _distance_x(object) < 190.0:
				return interact()
		notice("국본 격파 후 루트 코어 앞에서 사용하세요.", 2.0)
		return false
	if float(player["energy"]) < 20.0:
		notice("기력이 부족합니다.", 1.5)
		return false
	player["energy"] = float(player["energy"]) - 20.0
	cast_cooldown = 0.48
	var color := Color(str(content["talismans"][index]["color"]))
	_effect("cast", Vector2(float(player["x"]) + 12.0, float(player["y"]) + 20.0), color, 220.0 if index != 0 else 36.0, 0.5)
	_sound("cast")
	if index == 0:
		_shot(52.0, "red", "", 800.0)
	elif index == 1 or index == 2:
		scan_time = 12.0 if index == 2 else 8.0
		for enemy in enemies:
			if not bool(enemy["dead"]) and _distance_x(enemy) < 650.0: enemy["revealed"] = scan_time
		if index == 2 and bool(player["tiger_evolved"]):
			var opened := false
			for object in objects:
				if str(object["type"]) == "gate" and bool(object.get("active", true)) and str(object.get("value", "")) != "illusion" and _distance_x(object) < 235.0:
					object["active"] = false
					opened = true
			if opened:
				notice("sudo · 권한을 승인했습니다.")
				save_checkpoint()
			else: notice("백호가 숨은 길과 진실을 드러냅니다.")
		else: notice("숨은 길과 환영을 탐지합니다.")
	elif index == 3:
		shield_time = 5.0
		notice("현무의 방패가 공격을 반사합니다.")
	return true


func _segment_fraction(start: Vector2, finish: Vector2, rect: Rect2) -> float:
	var grown := rect.grow(4.0)
	if grown.has_point(start): return 0.0
	var delta := finish - start
	var enter := 0.0
	var leave := 1.0
	for axis in 2:
		var origin: float = start.x if axis == 0 else start.y
		var movement: float = delta.x if axis == 0 else delta.y
		var low: float = grown.position.x if axis == 0 else grown.position.y
		var high: float = grown.end.x if axis == 0 else grown.end.y
		if absf(movement) < 0.00001:
			if origin < low or origin > high: return 2.0
		else:
			var a := (low - origin) / movement
			var b := (high - origin) / movement
			enter = maxf(enter, minf(a, b))
			leave = minf(leave, maxf(a, b))
			if enter > leave: return 2.0
	return enter


func _update_projectiles(dt: float) -> void:
	var remaining: Array = []
	for shot in projectiles:
		var travel := minf(dt, float(shot["life"]))
		var start: Vector2 = shot["pos"]
		var finish: Vector2 = start + Vector2(shot["velocity"]) * travel
		var nearest := 2.0
		var hit_kind := ""
		var hit_target: Dictionary = {}
		for platform in _solid_platforms():
			var fraction := _segment_fraction(start, finish, _rect_of(platform))
			if fraction < nearest:
				nearest = fraction
				hit_kind = "wall"
				hit_target = platform
		if mode == "tutorial":
			if not bool(shot["hostile"]):
				for target in _practice_targets():
					var fraction := _segment_fraction(start, finish, _rect_of(target))
					if fraction < nearest:
						nearest = fraction
						hit_kind = "practice"
						hit_target = target
		else:
			for object in objects:
				if not bool(object.get("active", true)) or not ["gate", "cooler", "log", "memory", "npc", "core"].has(str(object["type"])) or str(object.get("value", "")) == "illusion": continue
				var fraction := _segment_fraction(start, finish, _rect_of(object))
				if fraction < nearest:
					nearest = fraction
					hit_kind = "object"
					hit_target = object
			if bool(shot["hostile"]):
				var fraction := _segment_fraction(start, finish, _player_rect())
				if fraction < nearest:
					nearest = fraction
					hit_kind = "player"
			else:
				for enemy in enemies:
					if bool(enemy["dead"]): continue
					var fraction := _segment_fraction(start, finish, _rect_of(enemy))
					if fraction < nearest:
						nearest = fraction
						hit_kind = "enemy"
						hit_target = enemy
		shot["pos"] = start.lerp(finish, minf(1.0, nearest))
		shot["life"] = float(shot["life"]) - travel
		if nearest <= 1.0:
			if hit_kind == "player" and (shield_time > 0.0 or str(player["buff"]) == "black"):
				shot["hostile"] = false
				shot["velocity"] = -Vector2(shot["velocity"]) * 1.7
				shot["color"] = Color("#c2bcff")
				shot["life"] = 2.5
				remaining.append(shot)
				continue
			_effect("block", Vector2(shot["pos"]), Color(shot["color"]), 16.0, 0.18)
			if hit_kind == "practice": _practice_hit(hit_target, shot)
			elif hit_kind == "player": hurt(10.0)
			elif hit_kind == "object" and not bool(shot["hostile"]): _hit_object(hit_target, shot)
			elif hit_kind == "enemy":
				var connected := hit_enemy(hit_target, float(shot["damage"]), str(shot["source"]))
				if connected and not bool(hit_target["dead"]) and str(shot["buff"]) == "red" and str(hit_target["type"]) != "gumiho":
					hit_target["burn_time"] = 3.0
		else:
			if float(shot["life"]) > 0.0 and Vector2(shot["pos"]).x > -100.0 and Vector2(shot["pos"]).x < world_width + 100.0: remaining.append(shot)
	projectiles = remaining


func hit_enemy(enemy: Dictionary, damage: float, source: String = "melee") -> bool:
	if bool(enemy["dead"]): return false
	var kind := str(enemy["type"])
	if kind == "bulgasari" and source != "cooler" and source != "reflect" and float(enemy["stun"]) <= 0.0:
		notice("불가사리는 코드를 먹습니다. 왼쪽 냉각 장치를 공격하세요.", 2.5)
		return false
	if (kind == "jangsan" or kind == "gumiho") and scan_time <= 0.0 and float(enemy["revealed"]) <= 0.0:
		notice("환영에는 공격이 닿지 않습니다. 청룡 또는 백호 Q로 스캔하세요.", 2.5)
		return false
	if kind == "shield" and source == "melee" and signf(float(player["x"]) + 12.0 - _center_x(enemy)) == float(enemy["facing"]):
		notice("정면 방패! 등 뒤를 노리거나 주작을 사용하세요.", 2.0)
		return false
	if kind == "gumiho":
		if float(enemy["stun"]) > 0.0: return false
		enemy["tails"] = maxi(0, int(enemy["tails"]) - 3)
		damage = float(enemy["maxHp"]) / 3.0
		enemy["stun"] = 0.65
		notice("암호 해제! 남은 꼬리 %d개" % int(enemy["tails"]), 2.0)
	enemy["hp"] = maxf(0.0, float(enemy["hp"]) - damage)
	_effect("hit", Vector2(_center_x(enemy), float(enemy["y"]) + float(enemy["h"]) * 0.5), Color("#ff5871") if source == "red" else Color("#e8fff1"), 30.0, 0.3)
	_sound("hit")
	if float(enemy["hp"]) <= 0.0: defeat_enemy(enemy)
	return true


func defeat_enemy(enemy: Dictionary) -> void:
	enemy["dead"] = true
	enemy["hp"] = 0.0
	stats["kills"] = int(stats["kills"]) + 1
	player["energy"] = minf(100.0, float(player["energy"]) + (50.0 if bool(enemy.get("boss", false)) else 12.0))
	player["hp"] = minf(150.0, float(player["hp"]) + (35.0 if bool(enemy.get("boss", false)) else 5.0))
	_effect("defeat", Vector2(_center_x(enemy), float(enemy["y"]) + 35.0), Color("#fbce7d"), 100.0 if bool(enemy.get("boss", false)) else 42.0, 0.8)
	_sound("boss" if bool(enemy.get("boss", false)) else "defeat")
	var kind := str(enemy["type"])
	if kind == "jangseung": unlock_talisman(2)
	elif kind == "sagwan": unlock_talisman(3)
	elif kind == "gumiho":
		unlock_talisman(2)
		if not bool(player["tiger_evolved"]): enqueue_lesson("white-evolved")
		player["tiger_evolved"] = true
		unlock_talisman(4)
		notice("구미호의 암호가 풀렸습니다. 기린 부적 획득!", 5.0)
	elif kind == "root":
		objective = "루트 코어에 기린 부적을 대고 소도의 운명을 선택하세요."
		notice("국본의 통제가 끊겼습니다. 오른쪽 코어로 이동해 F를 누르세요.", 6.0)
	elif bool(enemy.get("boss", false)): notice("%s 격파 · 접속 기록이 저장되었습니다." % str(enemy["name"]), 4.0)
	if bool(enemy.get("boss", false)): save_checkpoint()


func _hit_object(object: Dictionary, shot: Dictionary) -> void:
	if str(object["type"]) == "cooler": activate_cooler(object)
	elif str(object["type"]) == "log" and str(object.get("value", "")) == "escape": erase_log(object)
	elif str(shot["source"]) == "red" and ["memory", "log", "gate"].has(str(object["type"])):
		object["active"] = false
		var penalty := 2 if str(object["type"]) == "gate" else 5
		conscience = maxi(0, conscience - penalty)
		notice("보안문 폭파 · 양심 −2" if penalty == 2 else "민간 기록 삭제 · 양심 −5")
		save_checkpoint()


func activate_cooler(object: Dictionary) -> void:
	if float(object.get("cooldown", 0.0)) > 0.0: return
	if str(object.get("value", "")) == "shelf":
		for platform in platforms:
			if bool(platform.get("moving", false)):
				platform["y"] = 350.0
				platform["moving"] = false
		object["cooldown"] = 1.0
		notice("책장 서랍이 확장되었습니다.")
		return
	for enemy in enemies:
		if str(enemy["type"]) == "bulgasari" and not bool(enemy["dead"]):
			object["cooldown"] = 2.2
			enemy["stun"] = 2.5
			hit_enemy(enemy, 65.0, "cooler")
			_effect("cooler", Vector2(_center_x(object), float(object["y"])), Color("#6ce0ff"), 170.0, 0.9)
			notice("냉각 과부하! 2초 뒤 다시 사용할 수 있습니다.", 3.0)
			return
	notice("격리 구역 냉각 완료.")


func hurt(amount: float, ignore_shield: bool = false) -> void:
	if mode != "playing" or float(player["invulnerable"]) > 0.0: return
	if shield_time > 0.0 and not ignore_shield: return
	if str(player["buff"]) == "black" and not ignore_shield: amount *= 0.4
	var damage := minf(float(player["hp"]), ceilf(amount))
	player["hp"] = maxf(0.0, float(player["hp"]) - damage)
	stats["damageTaken"] = int(stats["damageTaken"]) + int(damage)
	player["invulnerable"] = 0.85
	if str(player["buff"]) == "white": end_enchant()
	_effect("hurt", Vector2(float(player["x"]) + 12.0, float(player["y"]) + 20.0), Color("#ff5a70"), 50.0, 0.45)
	_sound("hurt")
	if float(player["hp"]) <= 0.0:
		mode = "dead"
		fire_left = false
		fire_right = false
		_refresh_ui()


func _effect(kind: String, at: Vector2, color: Color, radius: float, life: float) -> void:
	effects.append({"kind": kind, "pos": at, "color": color, "radius": radius, "life": life, "max_life": life})


func _sound(kind: String) -> void:
	if audio_player == null: return
	var playback := audio_player.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback == null: return
	var frequency := 360.0
	var length := 0.09
	match kind:
		"jump": frequency = 530.0
		"dash": frequency = 310.0; length = 0.12
		"cast": frequency = 670.0; length = 0.16
		"enchant": frequency = 780.0; length = 0.2
		"hit": frequency = 170.0
		"hurt": frequency = 115.0; length = 0.18
		"defeat": frequency = 440.0; length = 0.15
		"boss": frequency = 550.0; length = 0.28
	var frames := int(length * 22050.0)
	if playback.get_frames_available() < frames: return
	for i in frames:
		var t := float(i) / 22050.0
		var envelope := 1.0 - t / length
		var value := sin(TAU * frequency * t) * envelope * 0.11
		playback.push_frame(Vector2(value, value))


func _update_enemies(dt: float) -> void:
	for enemy in enemies:
		if bool(enemy["dead"]): continue
		if float(enemy["burn_time"]) > 0.0:
			enemy["burn_time"] = maxf(0.0, float(enemy["burn_time"]) - dt)
			enemy["burn_tick"] = float(enemy["burn_tick"]) - dt
			if float(enemy["burn_tick"]) <= 0.0:
				enemy["burn_tick"] = 0.5
				hit_enemy(enemy, 5.0, "burn")
			if bool(enemy["dead"]): continue
		enemy["revealed"] = maxf(0.0, float(enemy["revealed"]) - dt)
		enemy["stun"] = maxf(0.0, float(enemy["stun"]) - dt)
		var distance := _distance_x(enemy)
		if distance > 720.0 or float(enemy["stun"]) > 0.0: continue
		if str(player["buff"]) == "white" and not bool(enemy.get("boss", false)): continue
		if distance > (580.0 if bool(enemy.get("boss", false)) else 390.0): continue
		enemy["facing"] = 1 if float(player["x"]) + 12.0 >= _center_x(enemy) else -1
		enemy["cooldown"] = float(enemy["cooldown"]) - dt
		if not bool(enemy.get("boss", false)) and distance > 48.0 and distance < 380.0:
			var speed := 66.0 if str(enemy["type"]) == "pabal" else 24.0 if str(enemy["type"]) == "shield" else 40.0
			enemy["x"] = clampf(float(enemy["x"]) + float(enemy["facing"]) * speed * dt, float(enemy["origin_x"]) - 170.0, float(enemy["origin_x"]) + 170.0)
		if bool(enemy.get("boss", false)) and distance > 106.0 and distance < 320.0 and not ["sagwan", "root"].has(str(enemy["type"])):
			enemy["x"] = clampf(float(enemy["x"]) + float(enemy["facing"]) * 19.0 * dt, float(enemy["origin_x"]) - 100.0, float(enemy["origin_x"]) + 100.0)
		if float(enemy["cooldown"]) > 0.0: continue
		if distance < (130.0 if bool(enemy.get("boss", false)) else 75.0):
			enemy["cooldown"] = 1.55 if bool(enemy.get("boss", false)) else 1.6
			if absf(float(player["y"]) + 44.0 - float(enemy["y"]) - float(enemy["h"])) < 70.0:
				if shield_time > 0.0: hit_enemy(enemy, 22.0, "reflect")
				else:
					hurt(16.0 if bool(enemy.get("boss", false)) else 9.0)
					if str(player["buff"]) == "black": hit_enemy(enemy, 16.0, "reflect")
			_effect("enemy_slash", Vector2(_center_x(enemy) + float(enemy["facing"]) * 45.0, float(enemy["y"]) + float(enemy["h"]) * 0.5), Color("#ff647b"), 65.0, 0.38)
		elif bool(enemy.get("boss", false)) or ["sunra", "dokkaebi"].has(str(enemy["type"])):
			enemy["cooldown"] = 1.8 if str(enemy["type"]) == "root" else 2.2 if bool(enemy.get("boss", false)) else 2.8
			var origin := Vector2(_center_x(enemy), float(enemy["y"]) + float(enemy["h"]) * 0.55)
			var target := Vector2(float(player["x"]) + 12.0, float(player["y"]) + 22.0)
			var count := 3 if str(enemy["type"]) == "root" and float(enemy["hp"]) < float(enemy["maxHp"]) * 0.55 else 1
			var base_angle := (target - origin).angle()
			for n in count:
				var angle := base_angle + (float(n) - float(count - 1) * 0.5) * 0.23
				_shot(10.0, "hostile", "", 900.0, true, origin, origin + Vector2.RIGHT.rotated(angle))
			if str(enemy["type"]) == "sagwan" or (str(enemy["type"]) == "root" and count == 3):
				effects.append({"kind": "warning", "pos": Vector2(float(player["x"]) + 12.0, 459.0), "color": Color("#ff8a64"), "radius": 35.0, "life": 0.8, "max_life": 0.8, "danger": true})
	for effect in effects:
		if bool(effect.get("danger", false)) and float(effect["life"]) < 0.08:
			effect["danger"] = false
			_effect("pillar", Vector2(effect["pos"]), Color("#ff9368"), 38.0, 0.5)
			if absf(float(player["x"]) + 12.0 - Vector2(effect["pos"]).x) < 35.0 and float(player["y"]) + 44.0 > 365.0: hurt(15.0)


func interact() -> bool:
	if mode == "tutorial":
		if bool(tutorial.get("completed", false)): finish_tutorial(false)
		return true
	var nearby: Array = []
	for object in objects:
		if bool(object.get("active", true)) and _distance_x(object) < (160.0 if str(object["type"]) == "core" else 100.0) and absf(float(object["y"]) - float(player["y"])) < 170.0:
			nearby.append(object)
	var priority := {"core": 0, "npc": 1, "exit": 2, "cooler": 3, "gate": 4, "log": 5, "memory": 6}
	nearby.sort_custom(func(a, b): return int(priority.get(str(a["type"]), 8)) < int(priority.get(str(b["type"]), 8)))
	for object in nearby:
		var kind := str(object["type"])
		if kind == "npc":
			pending_npc = str(object["id"])
			mode = "npc"
			_refresh_ui()
			return true
		if kind == "cooler":
			activate_cooler(object)
			return true
		if kind == "core":
			if enemies.any(func(e): return bool(e.get("boss", false)) and not bool(e["dead"])):
				notice("보스가 코어를 통제하고 있습니다.")
				return false
			if not player["unlocked"].has(4):
				notice("기린 부적이 필요합니다.")
				return false
			mode = "choice"
			_refresh_ui()
			return true
		if kind == "exit":
			if enemies.any(func(e): return bool(e.get("boss", false)) and not bool(e["dead"])):
				notice("보스가 통로를 봉쇄했습니다.")
				return false
			if level_index == 3: finish_game()
			else:
				load_level(level_index + 1)
				save_checkpoint()
			return true
		if kind == "gate":
			if str(object.get("value", "")) == "illusion":
				if scan_time > 0.0:
					object["active"] = false
					notice("가짜 출구를 식별했습니다.")
				else:
					hurt(12.0)
					notice("가짜 출구입니다! Q로 스캔하세요.")
			elif str(object.get("value", "")) == "key" and not enemies.any(func(e): return str(e["id"]) == "bulgasari" and not bool(e["dead"])):
				object["active"] = false
				notice("보안 키로 성문을 열었습니다.")
				save_checkpoint()
			elif bool(player["tiger_evolved"]): notice("백호(3) Q로 sudo를 사용하세요.")
			else: notice("보안 키 또는 주작 화염탄이 필요합니다.")
			return true
		if kind == "memory" or (kind == "log" and str(object.get("value", "")) == "story"):
			collect_record(object)
			return true
	return false


func choose(value: String) -> void:
	if mode == "npc":
		for object in objects:
			if str(object["id"]) == pending_npc: object["active"] = false
		pending_npc = ""
		mode = "playing"
		if value == "extort":
			conscience = maxi(0, conscience - 20)
			player["hp"] = 150.0
			player["energy"] = 100.0
			notice("시민의 데이터를 대가로 회복했습니다. 양심 −20")
		else:
			player["hp"] = minf(150.0, float(player["hp"]) + 25.0)
			notice("시민의 기록을 안전한 곳으로 옮겼습니다.")
		save_checkpoint()
	elif mode == "choice":
		route = value
		load_level(3)
		notice("코어 삭제. 로그를 지우며 나루터로 달리세요!" if value == "destroy" else "코어 정화. 해치를 피해 나루터로 귀환하세요!", 7.0)
		save_checkpoint()
	_refresh_ui()


func unlock_talisman(index: int) -> void:
	if player["unlocked"].has(index): return
	player["unlocked"].append(index)
	player["unlocked"].sort()
	enqueue_lesson(TALISMAN_KEYS[index])


func _collect_nearby() -> void:
	for object in objects:
		if not bool(object.get("active", true)): continue
		var pickup_rect := _rect_of(object).grow_individual(8.0, 0.0, 8.0, 0.0)
		if not _player_rect().intersects(pickup_rect): continue
		var kind := str(object["type"])
		if kind == "talisman":
			object["active"] = false
			if str(object.get("value", "")) == "evolve":
				unlock_talisman(2)
				player["tiger_evolved"] = true
				enqueue_lesson("white-evolved")
				notice("백호 각성 · sudo! 권한의 문을 열 수 있습니다.", 5.0)
			else:
				var index := int(object["value"])
				unlock_talisman(index)
				notice("%s 획득 · %d로 선택하세요." % [str(object["label"]), index + 1], 5.0)
			_effect("collect", Vector2(_center_x(object), float(object["y"]) + 12.0), Color("#f8d28b"), 90.0, 0.9)
			save_checkpoint()
		elif kind == "memory" or (kind == "log" and str(object.get("value", "")) == "story"):
			collect_record(object)
		elif kind == "checkpoint":
			object["active"] = false
			player["hp"] = 150.0
			player["energy"] = 100.0
			notice("접속점 저장 · 체력과 기력을 회복했습니다.")
			save_checkpoint()


func collect_record(object: Dictionary) -> void:
	object["active"] = false
	if str(object["type"]) == "memory": stats["memories"] = int(stats["memories"]) + 1
	else: stats["logs"] = int(stats["logs"]) + 1
	player["energy"] = minf(100.0, float(player["energy"]) + 15.0)
	notice("설계자의 기록: 소도는 누구도 버리지 않는 곳이어야 한다." if str(object.get("value", "")) == "story" else "기록 보존 · %s" % str(object["label"]), 6.0 if str(object.get("value", "")) == "story" else 3.0)
	save_checkpoint()


func erase_log(object: Dictionary) -> void:
	if not bool(object["active"]): return
	object["active"] = false
	stats["logs"] = int(stats["logs"]) + 1
	escape_wall -= 170.0
	player["energy"] = minf(100.0, float(player["energy"]) + 24.0)
	notice("접속 로그 소거 · 추격 프로세스가 늦춰졌습니다.")


func _update_escape(dt: float) -> void:
	if level_index != 3 or mode != "playing": return
	if escape_grace > 0.0: escape_grace -= dt
	else: escape_wall += dt * (118.0 if route == "destroy" else 108.0)
	if float(player["x"]) < escape_wall + 30.0:
		player["invulnerable"] = 0.0
		hurt(30.0, true)
		escape_wall -= 100.0


func _update_hint() -> void:
	if mode == "tutorial":
		hint = str(_current_step().get("goal", "F · 수련 마치기")) if not bool(tutorial.get("completed", false)) else "F · 수련 마치기"
		return
	if level_index == 3: hint = "D + Shift로 탈출 · 좌클릭 / 주작 Q로 로그 소거 · 백호 Q로 성문 개방"
	elif level_index == 0 and float(player["x"]) < 900.0: hint = "A·D 이동 / Space 2단 점프 / Shift 대시 / 좌클릭 공격 / Q 기술 / E 인챈트"
	else: hint = "1~5 / 휠 부적 선택 · Q 시전 · E 인챈트 · F 상호작용"
	for enemy in enemies:
		if bool(enemy.get("boss", false)) and not bool(enemy["dead"]) and _distance_x(enemy) < 650.0:
			match str(enemy["type"]):
				"bulgasari": hint = "불가사리: 왼쪽 냉각 장치를 좌클릭 또는 F로 작동하세요."
				"jangsan", "gumiho": hint = "환영: 청룡 또는 백호 Q로 스캔한 뒤 공격하세요."
				"root": hint = "국본: 빛나는 바닥 문양을 피하고 현무로 탄막을 반사하세요."
				_: hint = "보스 탄막은 점프 / 대시로 회피하고 현무 Q로 반사하세요."
			break
	for object in objects:
		if bool(object.get("active", true)) and ["npc", "exit", "gate", "core", "cooler"].has(str(object["type"])) and _distance_x(object) < 100.0:
			hint = str(object.get("label", hint))
			break


func finish_game() -> void:
	if level_index != 3 or route == "": return
	var key := "black" if route == "destroy" else "white" if conscience >= 75 else "gray"
	ending = content["endings"][key].duplicate(true)
	ending["report"].append("양심: %d%% · 보존 기록: %d · 소거 로그: %d" % [conscience, int(stats["memories"]), int(stats["logs"])])
	mode = "ending"
	_refresh_ui()


func enqueue_lesson(id: String) -> void:
	if learned.has(id) or lesson_queue.has(id) or str(tutorial.get("id", "")) == id: return
	lesson_queue.append(id)


func start_next_lesson() -> void:
	if mode != "playing" or lesson_queue.is_empty(): return
	var id := str(lesson_queue.pop_front())
	var data: Dictionary = content["tutorials"][id]
	tutorial = {"id": id, "index": int(data["index"]), "step_index": 0, "completed": false, "saved_player": player.duplicate(true)}
	player["x"] = 100.0
	player["y"] = 416.0
	player["vx"] = 0.0
	player["vy"] = 0.0
	player["buff"] = ""
	player["buff_time"] = 0.0
	player["enchant_cooldown"] = 0.0
	player["energy"] = 100.0
	player["selected"] = int(data["index"])
	projectiles = []
	practice_shot = {}
	tutorial_hits = 0
	tutorial_pending = 0.0
	mode = "tutorial"
	_update_camera()
	notice(str(data["intro"]), 5.0)
	_refresh_ui()


func _current_step() -> Dictionary:
	if tutorial.is_empty(): return {}
	var steps: Array = content["tutorials"][str(tutorial["id"])]["steps"]
	var index := int(tutorial["step_index"])
	if index >= steps.size(): return {}
	return steps[index]


func _lesson_action(action: String) -> void:
	if mode != "tutorial" or bool(tutorial.get("completed", false)): return
	var step := _current_step()
	if str(step.get("action", "")) != action: return
	var target := str(step.get("target", ""))
	if target == "dummy" or target == "range": return
	if str(step.get("buff", "")) != "" and str(step["buff"]) != str(player["buff"]): return
	if action == "cast" and target == "hidden" and scan_time <= 0.0: return
	if action == "cast" and target == "gate" and not bool(player["tiger_evolved"]): return
	if action == "cast" and target == "hidden":
		tutorial_pending = 1.2
		notice("숨은 표적이 드러났습니다. Q 탐지는 공격 탄이 아닙니다.", 1.2)
		return
	_advance_lesson()


func _practice_targets() -> Array:
	if mode != "tutorial" or bool(tutorial.get("completed", false)): return []
	var step := _current_step()
	var target := str(step.get("target", ""))
	if target == "dummy": return [{"x": 393.0, "y": 399.0, "w": 44.0, "h": 61.0}]
	if target == "range":
		var result: Array = []
		if (tutorial_hits & 1) == 0: result.append({"x": 393.0, "y": 399.0, "w": 44.0, "h": 61.0})
		if (tutorial_hits & 2) == 0: result.append({"x": 493.0, "y": 399.0, "w": 44.0, "h": 61.0})
		return result
	return []


func _practice_hit(target: Dictionary, shot: Dictionary) -> void:
	if mode != "tutorial" or bool(tutorial.get("completed", false)): return
	var step := _current_step()
	if str(step.get("action", "")) == "attack" and str(shot["source"]) == "melee": _advance_lesson()
	elif str(step.get("action", "")) == "enhancedAttack" and str(shot["buff"]) == str(step.get("buff", "")):
		_advance_lesson()
	elif str(step.get("action", "")) == "cast" and str(shot["source"]) == "red":
		var target_number := 0 if float(target["x"]) < 450.0 else 1
		tutorial_hits = tutorial_hits | (1 << target_number)
		if tutorial_hits == 3: _advance_lesson()


func _update_practice(dt: float) -> void:
	if tutorial_pending > 0.0:
		tutorial_pending = maxf(0.0, tutorial_pending - dt)
		if tutorial_pending <= 0.0: _advance_lesson()
	if practice_shot.is_empty(): return
	practice_shot["timer"] = float(practice_shot["timer"]) - dt
	if float(practice_shot["timer"]) > 0.0: return
	practice_shot = {}
	tutorial_pending = 0.0
	if shield_time > 0.0 and str(_current_step().get("action", "")) == "cast" and str(_current_step().get("target", "")) == "projectile":
		notice("연습탄 반사 성공! 방패는 5초 동안 유지됩니다.", 3.0)
		_advance_lesson()


func _advance_lesson() -> void:
	if mode != "tutorial": return
	tutorial["step_index"] = int(tutorial["step_index"]) + 1
	tutorial_hits = 0
	projectiles = []
	practice_shot = {}
	tutorial_pending = 0.0
	var steps: Array = content["tutorials"][str(tutorial["id"])]["steps"]
	if int(tutorial["step_index"]) >= steps.size():
		tutorial["completed"] = true
		notice("수련 완료! F 또는 아래 버튼으로 모험에 돌아가세요.", 5.0)
	else:
		player["energy"] = 100.0
		attack_cooldown = 0.0
		cast_cooldown = 0.0
		if str(_current_step().get("action", "")) == "enchant" and str(player["buff"]) != "":
			player["buff"] = ""
			player["buff_time"] = 0.0
			player["enchant_cooldown"] = 0.0
		if str(_current_step().get("action", "")) == "enhancedAttack" and str(player["buff"]) == "":
			player["enchant_cooldown"] = 0.0
			player["buff"] = TALISMAN_KEYS[int(tutorial["index"])]
			player["buff_time"] = 12.0
		notice(str(_current_step()["title"]), 2.5)
	_refresh_ui()


func finish_tutorial(skipped: bool) -> void:
	if mode != "tutorial": return
	if not skipped and not bool(tutorial.get("completed", false)): return
	var id := str(tutorial["id"])
	if not learned.has(id): learned.append(id)
	var saved_player: Dictionary = tutorial["saved_player"]
	player = saved_player.duplicate(true)
	tutorial = {}
	practice_shot = {}
	tutorial_pending = 0.0
	projectiles = []
	mode = "playing"
	if skipped: notice("수련을 건너뛰었습니다. H에서 조작을 확인할 수 있습니다.", 4.0)
	else: notice("수련을 마쳤습니다. 모험을 이어갑니다.", 3.0)
	save_checkpoint()
	start_next_lesson()
	_refresh_ui()


func save_checkpoint() -> void:
	if mode == "tutorial": return
	var safe_x := clampf(float(player["x"]), 0.0, world_width - PLAYER_W)
	var support_y := 460.0
	var found := false
	for platform in platforms:
		if bool(platform.get("hidden", false)): continue
		if safe_x >= float(platform["x"]) and safe_x + PLAYER_W <= float(platform["x"]) + float(platform["w"]):
			if not found or float(platform["y"]) > support_y:
				support_y = float(platform["y"])
				found = true
	if not found:
		safe_x = 80.0
		support_y = 460.0
	checkpoint = {
		"version": 1, "level_index": level_index, "conscience": conscience,
		"stats": stats.duplicate(true), "route": route, "learned": learned.duplicate(),
		"player": {"x": safe_x, "y": support_y - PLAYER_H, "selected": int(player["selected"]) if player["unlocked"].has(int(player["selected"])) else 0, "unlocked": player["unlocked"].duplicate(), "tiger_evolved": bool(player["tiger_evolved"])},
		"defeated": enemies.filter(func(e): return bool(e["dead"])).map(func(e): return str(e["id"])),
		"consumed": objects.filter(func(o): return not bool(o.get("active", true))).map(func(o): return str(o["id"])),
		"escape_wall": escape_wall if level_index == 3 else null
	}
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(checkpoint))
		file.close()


func _valid_save(save: Variant) -> bool:
	if not save is Dictionary: return false
	if int(save.get("version", -1)) != 1: return false
	var index := int(save.get("level_index", -1))
	if index < 0 or index >= content["levels"].size(): return false
	if not save.get("player", null) is Dictionary: return false
	var p: Dictionary = save["player"]
	if not p.get("unlocked", null) is Array: return false
	var unlocked: Array = p["unlocked"].map(func(value): return int(value))
	if not unlocked.has(0) or not unlocked.has(1): return false
	if not unlocked.has(int(p.get("selected", -1))): return false
	if float(p.get("x", -1.0)) < 0.0 or float(p.get("x", -1.0)) > float(content["levels"][index]["width"]): return false
	if float(p.get("y", -1.0)) < 0.0 or float(p.get("y", -1.0)) > 505.0: return false
	if int(save.get("conscience", -1)) < 0 or int(save.get("conscience", -1)) > 100: return false
	if index == 3 and not ["destroy", "restore"].has(str(save.get("route", ""))): return false
	if not save.get("defeated", null) is Array or not save.get("consumed", null) is Array: return false
	return true


func continue_game() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		notice("저장 기록이 없습니다.")
		return
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null: return
	var save: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if not _valid_save(save):
		notice("저장 기록을 읽을 수 없습니다.")
		return
	start_new(false)
	route = str(save["route"])
	load_level(int(save["level_index"]))
	conscience = int(save["conscience"])
	stats = save["stats"].duplicate(true)
	learned = save.get("learned", []).duplicate()
	var p: Dictionary = save["player"]
	player["x"] = float(p["x"])
	player["y"] = float(p["y"])
	player["selected"] = int(p["selected"])
	player["unlocked"] = p["unlocked"].map(func(value): return int(value))
	player["tiger_evolved"] = bool(p["tiger_evolved"])
	for enemy in enemies:
		if save["defeated"].has(str(enemy["id"])):
			enemy["dead"] = true
			enemy["hp"] = 0.0
	for object in objects:
		if save["consumed"].has(str(object["id"])): object["active"] = false
	if level_index == 3: escape_wall = float(save["escape_wall"])
	checkpoint = save.duplicate(true)
	mode = "playing"
	if not learned.has("red"): enqueue_lesson("red")
	if player["unlocked"].has(2) and not learned.has("white"): enqueue_lesson("white")
	if player["unlocked"].has(3) and not learned.has("black"): enqueue_lesson("black")
	if bool(player["tiger_evolved"]) and not learned.has("white-evolved"): enqueue_lesson("white-evolved")
	if player["unlocked"].has(4) and not learned.has("gold"): enqueue_lesson("gold")
	notice("저장된 접속점에서 연결을 복원했습니다.")
	start_next_lesson()
	_refresh_ui()


func _on_modal_button(index: int) -> void:
	match mode:
		"paused":
			if index == 0: mode = "playing"
			elif index == 1: mode = "title"
		"help": mode = "playing"
		"npc": choose("protect" if index == 0 else "extort")
		"choice": choose("restore" if index == 0 else "destroy")
		"dead":
			if index == 0: continue_game()
			else: start_new(true)
		"ending":
			if index == 0: start_new(true)
			else: mode = "title"
	fire_left = false
	fire_right = false
	_refresh_ui()


func _set_modal(title: String, body: String, buttons: Array) -> void:
	modal_title.text = title
	modal_body.text = body
	for i in 3:
		modal_buttons[i].visible = i < buttons.size()
		if i < buttons.size(): modal_buttons[i].text = str(buttons[i])


func _refresh_ui() -> void:
	if hud_top == null: return
	title_panel.visible = mode == "title"
	for hud in [hud_top, hud_bottom, hud_notice, hud_boss, hud_help]: hud.visible = mode != "title"
	hud_help.visible = false
	title_resume.disabled = not FileAccess.file_exists(SAVE_PATH)
	modal_panel.visible = ["paused", "help", "npc", "choice", "dead", "ending"].has(mode)
	tutorial_panel.visible = mode == "tutorial"
	if modal_panel.visible:
		match mode:
			"paused": _set_modal("일시 정지", "Esc 또는 P로 돌아갈 수 있습니다.\n현재 구역: %s" % str(level["name"]), ["계속하기", "제목 화면"])
			"help": _set_modal("조작 안내", "WASD 이동 · Space 2단 점프 · Shift 대시\n좌클릭 기본 탄 · 우클릭 자동 강화 탄\n1~5 / 휠 부적 선택 · Q 기술 · E 인챈트\nF 조사 · Esc 일시 정지\n휠은 미획득 부적을 건너뛰고 순환합니다.", ["돌아가기"])
			"npc": _set_modal("길 잃은 시민", "위험에 처한 시민의 기록을 발견했습니다.\n보호하면 체력이 조금 회복됩니다.\n데이터를 빼앗으면 자원은 회복되지만 양심이 줄어듭니다.", ["보호하기", "데이터 빼앗기"])
			"choice": _set_modal("루트 코어 · 마지막 선택", "국본의 통제가 끊겼습니다.\n소도를 정화하고 기록을 지킬지, 코어를 삭제할지 결정하세요.\n이 선택은 마지막 나루터와 엔딩을 바꿉니다.", ["정화하기", "삭제하기"])
			"dead": _set_modal("연결이 끊겼습니다", "마지막 접속점에서 다시 시작할 수 있습니다.", ["접속점에서 재개", "새 게임"])
			"ending": _set_modal(str(ending.get("title", "엔딩")), "%s\n\n%s" % [str(ending.get("text", "")), "\n".join(ending.get("report", []))], ["새 게임", "제목 화면"])
	if mode == "tutorial":
		var data: Dictionary = content["tutorials"][str(tutorial["id"])]
		var steps: Array = data["steps"]
		var current := int(tutorial["step_index"])
		tutorial_title.text = "%s\n%d / %d" % [str(data["title"]), mini(current + 1, steps.size()), steps.size()]
		if bool(tutorial.get("completed", false)):
			tutorial_body.text = "수련 완료!\n\n%s" % str(data["summary"])
			tutorial_goal.text = "F 또는 아래 버튼으로 모험에 복귀"
		else:
			var step: Dictionary = steps[current]
			tutorial_body.text = "%s  %s\n\n%s" % [str(step["key"]), str(step["title"]), str(step["description"])]
			tutorial_goal.text = str(step["goal"])
		tutorial_finish.disabled = not bool(tutorial.get("completed", false))
	var selected := int(player["selected"])
	var slots := ""
	for i in 5:
		var owned: bool = player["unlocked"].has(i)
		var name := str(content["talismans"][i]["name"]) if owned else "잠김"
		slots += ("[%d %s] " if i == selected else " %d %s  ") % [i + 1, name]
	var buff_text := ""
	if str(player["buff"]) != "": buff_text = "  · %s 강화 %.0f초" % [str(content["talismans"][TALISMAN_KEYS.find(str(player["buff"]))]["name"]), float(player["buff_time"])]
	elif float(player["enchant_cooldown"]) > 0.0: buff_text = "  · 냉각 %.0f초" % float(player["enchant_cooldown"])
	hud_top.text = "체력 %d/150   기력 %d/100   양심 %d%%  %s\n%s" % [int(player["hp"]), int(player["energy"]), conscience, buff_text, slots]
	hud_bottom.text = "%s\n%s" % [str(level["name"]), hint if hint != "" else objective]
	hud_notice.text = message if message_time > 0.0 else ""
	hud_boss.text = ""
	if mode == "playing":
		for enemy in enemies:
			if bool(enemy.get("boss", false)) and not bool(enemy["dead"]) and _distance_x(enemy) < 650.0:
				hud_boss.text = "%s  %d / %d" % [str(enemy["name"]), int(enemy["hp"]), int(enemy["maxHp"])]
				break


func _draw() -> void:
	if content.is_empty(): return
	var training := mode == "tutorial"
	var left := camera_x - 480.0
	var theme := "training" if training else str(level.get("theme", "moat"))
	var sky := Color("#071323")
	var far := Color("#112a3b")
	var near := Color("#1a3545")
	var accent := Color("#5ad3d5")
	match theme:
		"archive":
			sky = Color("#14132b"); far = Color("#252348"); near = Color("#373356"); accent = Color("#a498f4")
		"kernel":
			sky = Color("#1a1523"); far = Color("#3b2733"); near = Color("#52343a"); accent = Color("#f5bb75")
		"escape":
			sky = Color("#180f20"); far = Color("#382038"); near = Color("#503044"); accent = Color("#ff768b")
		"training":
			sky = Color("#081e2b"); far = Color("#13384a"); near = Color("#1c5360"); accent = Color("#84e0df")
	draw_rect(Rect2(left - 10.0, 0.0, 980.0, 540.0), sky)
	draw_rect(Rect2(left - 10.0, 310.0, 980.0, 230.0), far)
	var start_tower := int(floor(left / 135.0)) - 1
	for i in range(start_tower, start_tower + 11):
		var x := float(i) * 135.0
		var height := 82.0 + float(posmod(i * 41, 100))
		draw_rect(Rect2(x, 370.0 - height, 95.0, height + 110.0), near)
		draw_rect(Rect2(x - 7.0, 370.0 - height, 109.0, 8.0), accent.darkened(0.45))
		for row in 3:
			for col in 3:
				if posmod(i + row * 3 + col, 4) != 0:
					draw_rect(Rect2(x + 15.0 + col * 25.0, 390.0 - height + row * 27.0, 7.0, 11.0), accent.darkened(0.55))
	for i in range(int(left / 100.0) - 1, int(left / 100.0) + 12):
		var sx := float(i) * 100.0 + float(posmod(i * 29, 71))
		var sy := 60.0 + float(posmod(i * 47, 170))
		draw_circle(Vector2(sx, sy), 1.5, accent.lightened(0.25))
	if training:
		draw_rect(Rect2(0, 460, 960, 80), Color("#163c4b"))
		draw_rect(Rect2(0, 455, 960, 7), Color("#8ce6db"))
		_draw_text("옥추선의 기억 · 안전한 수련 공간", Vector2(35, 205), 20, Color("#b9f5e8"))
		for target in _practice_targets():
			var r := _rect_of(target)
			draw_rect(r, Color("#244957"))
			draw_rect(r, Color("#9fece2"), false, 3.0)
			draw_circle(r.get_center(), 9.0, Color("#ffdb8d"))
		var step := _current_step()
		if ["hidden", "gate", "projectile"].has(str(step.get("target", ""))):
			var target_color := Color("#83e4e5") if scan_time > 0.0 or str(step.get("target", "")) != "hidden" else Color("#395c65")
			draw_rect(Rect2(400, 382, 52, 78), target_color, false, 3.0)
			_draw_text("연습 표적", Vector2(382, 373), 15, target_color)
		if not practice_shot.is_empty():
			var shot_progress := 1.0 - float(practice_shot["timer"]) / 1.1
			draw_circle(Vector2(465.0 - shot_progress * 315.0, 433.0), 8.0, Color("#ff91ac"))
	else:
		for platform in platforms:
			if bool(platform.get("hidden", false)) and scan_time <= 0.0 and not bool(player["tiger_evolved"]): continue
			var r := _rect_of(platform)
			if r.end.x < left - 20.0 or r.position.x > left + 980.0: continue
			draw_rect(r, Color("#173440") if not bool(platform.get("hidden", false)) else Color("#3b6570"))
			draw_rect(Rect2(r.position.x, r.position.y, r.size.x, 6), accent)
			for j in range(int(r.size.x / 28.0)):
				draw_rect(Rect2(r.position.x + float(j) * 28.0 + 8.0, r.position.y + 12.0, 14.0, 2.0), Color("#365862"))
		for object in objects:
			if bool(object.get("active", true)): _draw_object(object, accent)
		for enemy in enemies:
			if not bool(enemy["dead"]): _draw_enemy(enemy)
		if level_index == 3:
			draw_rect(Rect2(escape_wall - 65.0, 0.0, 65.0, 540.0), Color(1.0, 0.2, 0.3, 0.3))
			draw_line(Vector2(escape_wall, 0), Vector2(escape_wall, 540), Color("#ff6a82"), 5.0)
	_draw_player()
	for shot in projectiles:
		var pos: Vector2 = shot["pos"]
		draw_circle(pos, 7.0 if str(shot["source"]) == "red" else 5.0, Color(shot["color"]))
		draw_circle(pos, 2.0, Color.WHITE)
	for effect in effects:
		var alpha := clampf(float(effect["life"]) / float(effect["max_life"]), 0.0, 1.0)
		var color: Color = effect["color"]
		color.a = alpha * 0.75
		var pos: Vector2 = effect["pos"]
		draw_arc(pos, float(effect["radius"]) * (1.4 - alpha * 0.4), 0.0, TAU, 36, color, 3.0)


func _draw_text(value: String, at: Vector2, size: int, color: Color) -> void:
	draw_string(ThemeDB.fallback_font, at, value, HORIZONTAL_ALIGNMENT_LEFT, -1, size, color)


func _draw_player() -> void:
	var x := float(player["x"])
	var y := float(player["y"])
	if float(player["invulnerable"]) > 0.0 and int(time_elapsed * 16.0) % 2 == 0 and mode == "playing": return
	var buff := str(player["buff"])
	if buff != "":
		var aura := Color(str(content["talismans"][TALISMAN_KEYS.find(buff)]["color"]))
		aura.a = 0.25
		draw_circle(Vector2(x + 12.0, y + 22.0), 31.0, aura)
	if shield_time > 0.0: draw_arc(Vector2(x + 12.0, y + 22.0), 32.0, 0.0, TAU, 32, Color("#b9a9ff"), 3.0)
	var body_color := Color("#d8e3e2") if buff != "white" else Color(0.8, 0.9, 0.95, 0.5)
	draw_rect(Rect2(x + 4.0, y + 15.0, 16.0, 22.0), body_color)
	draw_rect(Rect2(x + 2.0, y + 36.0, 8.0, 8.0), Color("#274453"))
	draw_rect(Rect2(x + 14.0, y + 36.0, 8.0, 8.0), Color("#274453"))
	draw_circle(Vector2(x + 12.0, y + 11.0), 10.0, Color("#f2c9b4"))
	draw_rect(Rect2(x + 2.0, y + 1.0, 20.0, 6.0), Color("#203244"))
	draw_rect(Rect2(x + 5.0, y - 5.0, 14.0, 7.0), Color("#294958"))
	var fan_x := x + 16.0 if int(player["facing"]) > 0 else x - 11.0
	draw_colored_polygon(PackedVector2Array([Vector2(fan_x, y + 20.0), Vector2(fan_x + 10.0 * float(player["facing"]), y + 5.0), Vector2(fan_x + 15.0 * float(player["facing"]), y + 19.0)]), Color("#f8d18e"))


func _draw_enemy(enemy: Dictionary) -> void:
	var r := _rect_of(enemy)
	var kind := str(enemy["type"])
	var boss := bool(enemy.get("boss", false))
	var base := Color("#d55e78") if not boss else Color("#d79c6c")
	if kind == "shield": base = Color("#8f9bc3")
	if kind == "bulgasari": base = Color("#b97b5c")
	if kind == "gumiho": base = Color("#e8d0d2")
	if kind == "root": base = Color("#f3cb86")
	if (kind == "jangsan" or kind == "gumiho") and scan_time <= 0.0 and float(enemy["revealed"]) <= 0.0: base.a = 0.48
	draw_rect(Rect2(r.position.x + r.size.x * 0.17, r.position.y + r.size.y * 0.24, r.size.x * 0.66, r.size.y * 0.76), base)
	draw_circle(Vector2(r.get_center().x, r.position.y + r.size.y * 0.22), r.size.x * 0.24, base.lightened(0.14))
	draw_rect(Rect2(r.get_center().x + float(enemy["facing"]) * 5.0, r.position.y + r.size.y * 0.17, 4.0, 4.0), Color("#111627"))
	if kind == "shield":
		var shield_x := r.end.x - 6.0 if int(enemy["facing"]) > 0 else r.position.x - 4.0
		draw_rect(Rect2(shield_x, r.position.y + 15.0, 10.0, 28.0), Color("#c4d7e3"))
	if boss:
		draw_rect(Rect2(r.position.x, r.position.y - 10.0, r.size.x, 5.0), Color("#351f32"))
		draw_rect(Rect2(r.position.x, r.position.y - 10.0, r.size.x * float(enemy["hp"]) / float(enemy["maxHp"]), 5.0), Color("#ff886d"))
		_draw_text(str(enemy["name"]).split(" · ")[0], Vector2(r.position.x - 10.0, r.position.y - 19.0), 13, Color("#ffdcb2"))


func _draw_object(object: Dictionary, accent: Color) -> void:
	var r := _rect_of(object)
	var kind := str(object["type"])
	var color := accent
	match kind:
		"talisman": color = Color("#f7d38b")
		"memory": color = Color("#84d9c6")
		"checkpoint": color = Color("#6ad1e4")
		"cooler": color = Color("#80dfff")
		"npc": color = Color("#b9d1c5")
		"gate": color = Color("#e7a670")
		"exit": color = Color("#e5cb9f")
		"core": color = Color("#f0d390")
		"log": color = Color("#e884a4")
	if kind == "talisman":
		draw_colored_polygon(PackedVector2Array([Vector2(r.get_center().x, r.position.y - 8), Vector2(r.end.x, r.get_center().y), Vector2(r.get_center().x, r.end.y + 4), Vector2(r.position.x, r.get_center().y)]), color)
		draw_circle(r.get_center(), 7.0, Color("#fff4d8"))
	elif kind == "gate" or kind == "exit" or kind == "core":
		draw_rect(r, Color("#15293a"))
		draw_rect(r, color, false, 4.0)
		for i in range(int(r.size.y / 24.0)):
			draw_line(Vector2(r.position.x + 4.0, r.position.y + 12.0 + i * 24.0), Vector2(r.end.x - 4.0, r.position.y + 12.0 + i * 24.0), color.darkened(0.35), 2.0)
	elif kind == "npc":
		draw_rect(Rect2(r.position.x + 7.0, r.position.y + 18.0, 18.0, 27.0), color)
		draw_circle(Vector2(r.get_center().x, r.position.y + 12.0), 9.0, Color("#ebc8b2"))
	else:
		draw_rect(r, color.darkened(0.6))
		draw_rect(r, color, false, 3.0)
		draw_circle(r.get_center(), 7.0, color)
	if _distance_x(object) < 180.0:
		_draw_text(str(object.get("label", "")), Vector2(r.position.x - 20.0, r.position.y - 10.0), 13, Color("#f4ecda"))
