extends SceneTree


func _initialize() -> void:
	call_deferred("run")


func run() -> void:
	var scene: PackedScene = load("res://scenes/main.tscn")
	var game: Variant = scene.instantiate()
	root.add_child(game)
	await process_frame
	assert(game.content["levels"].size() == 4)
	assert(game.mode == "title")
	game.start_new(true)
	assert(game.mode == "tutorial" and game.tutorial["id"] == "red")
	game._shot(22.0, "melee", "", 650.0, false, Vector2(112, 436), Vector2(430, 436))
	game._update_projectiles(0.5)
	assert(int(game.tutorial["step_index"]) == 1)
	game.finish_tutorial(true)
	assert(game.mode == "playing")
	game.select_talisman(0)
	game.cycle_talisman(-1)
	assert(int(game.player["selected"]) == 1)
	game.enqueue_lesson("blue")
	game.start_next_lesson()
	assert(game.mode == "tutorial" and game.tutorial["id"] == "blue")
	game.cast()
	assert(game.scan_time > 0.0 and game.tutorial_pending > 0.0)
	game._update_practice(1.3)
	assert(int(game.tutorial["step_index"]) == 1)
	game.enchant()
	assert(int(game.tutorial["step_index"]) == 2)
	game.dash()
	assert(bool(game.tutorial["completed"]))
	game.finish_tutorial(false)
	game.unlock_talisman(2)
	game.select_talisman(0)
	game.cycle_talisman(-1)
	assert(int(game.player["selected"]) == 2)
	var wall: Dictionary = {"x": 200, "y": 200, "w": 30, "h": 50}
	assert(game._segment_fraction(Vector2(100, 225), Vector2(300, 225), game._rect_of(wall)) < 1.0)
	assert(game._segment_fraction(Vector2(100, 100), Vector2(300, 100), game._rect_of(wall)) > 1.0)
	var normal_enemy: Dictionary = game.enemies.filter(func(e): return str(e["id"]) == "moat-p1")[0]
	game._shot(22.0, "melee", "", 650.0, false, Vector2(500, 436), Vector2(600, 436))
	game._update_projectiles(0.1)
	assert(float(normal_enemy["hp"]) < float(normal_enemy["maxHp"]))
	for stage in 3:
		assert(game.level_index == stage)
		for enemy in game.enemies:
			if bool(enemy.get("boss", false)): game.defeat_enemy(enemy)
		if stage < 2:
			var exit_object: Dictionary = game.objects.filter(func(o): return str(o["type"]) == "exit")[0]
			game.player["x"] = float(exit_object["x"]) - 32.0
			game.player["y"] = 416.0
			assert(game.interact())
		else:
			var core: Dictionary = game.objects.filter(func(o): return str(o["type"]) == "core")[0]
			game.player["x"] = float(core["x"]) - 32.0
			game.player["y"] = 416.0
			assert(game.interact())
			assert(game.mode == "choice")
			game.choose("restore")
	assert(game.level_index == 3 and game.route == "restore")
	var final_exit: Dictionary = game.objects.filter(func(o): return str(o["type"]) == "exit")[0]
	game.player["x"] = float(final_exit["x"]) - 32.0
	game.player["y"] = 416.0
	assert(game.interact())
	assert(game.mode == "ending" and game.ending["id"] == "white")
	game.continue_game()
	assert(game.mode == "playing" or game.mode == "tutorial")
	print("HAETAE Godot smoke test passed")
	game.audio_player.stop()
	await process_frame
	game.queue_free()
	await process_frame
	await process_frame
	quit(0)
