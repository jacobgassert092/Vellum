extends Node

@onready var display_label: RichTextLabel = $CanvasLayer/RichTextLabel
@onready var toc_container: VBoxContainer = $CanvasLayer/ScrollContainer/VBoxContainer

@export var epub_source_path: String = "res://Assets/Epubs/test.epub"
var cache_dir: String = "user://cache/"
var book_cache_path: String = ""
var zip_reader: ZIPReader
var opf_internal_path: String = ""
var toc_links: Array[String] = []

func _ready() -> void:
	_initialize_ui()
	_prepare_cache_system()
	_load_epub(epub_source_path)

func _initialize_ui() -> void:
	display_label.bbcode_enabled = true
	display_label.selection_enabled = true
	display_label.add_theme_color_override("default_color", Color.BLACK)
	
	# Clean background for mobile readability
	var background = ColorRect.new()
	background.color = Color.WHITE
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.show_behind_parent = true
	display_label.add_child(background)

func _prepare_cache_system() -> void:
	if not DirAccess.dir_exists_absolute(cache_dir):
		DirAccess.make_dir_absolute(cache_dir)

func _load_epub(file_path: String) -> void:
	var book_id = str(file_path.get_file().hash())
	book_cache_path = cache_dir.path_join(book_id)
	
	if not DirAccess.dir_exists_absolute(book_cache_path):
		DirAccess.make_dir_recursive_absolute(book_cache_path)
	
	zip_reader = ZIPReader.new()
	if zip_reader.open(file_path) != OK:
		push_error("Could not open EPUB file.")
		return
	
	for file in zip_reader.get_files():
		if file.get_extension() == "opf":
			opf_internal_path = file
			break
	
	if opf_internal_path != "":
		var opf_content = zip_reader.read_file(opf_internal_path).get_string_from_utf8()
		_parse_manifest_and_spine(opf_content)
		await get_tree().process_frame
		if not toc_links.is_empty():
			_display_chapter(0)

func _parse_manifest_and_spine(opf_xml: String) -> void:
	for child in toc_container.get_children():
		child.queue_free()
	toc_links.clear()

	var manifest = {}
	var item_regex = RegEx.new()
	item_regex.compile("<item\\s+([^>]+)>")
	var id_regex = RegEx.new()
	id_regex.compile("id=['\"]([^'\"]+)['\"]")
	var href_regex = RegEx.new()
	href_regex.compile("href=['\"]([^'\"]+)['\"]")
	
	for item_match in item_regex.search_all(opf_xml):
		var content = item_match.get_string(1)
		var id_m = id_regex.search(content)
		var href_m = href_regex.search(content)
		if id_m and href_m:
			manifest[id_m.get_string(1)] = href_m.get_string(1)

	var spine_regex = RegEx.new()
	spine_regex.compile("<itemref[^>]+idref=['\"]([^'\"]+)['\"]")
	
	for spine_match in spine_regex.search_all(opf_xml):
		var id = spine_match.get_string(1)
		if manifest.has(id):
			var abs_path = opf_internal_path.get_base_dir().path_join(manifest[id]).simplify_path()
			toc_links.append(abs_path)
			_add_toc_entry(manifest[id].get_file().get_basename(), toc_links.size() - 1)

func _add_toc_entry(title: String, index: int) -> void:
	var button = Button.new()
	button.text = title.capitalize()
	button.custom_minimum_size.y = 64
	button.pressed.connect(_display_chapter.bind(index))
	toc_container.add_child(button)

func _display_chapter(index: int) -> void:
	if index < 0 or index >= toc_links.size(): return
	
	var path = toc_links[index]
	var raw_html = zip_reader.read_file(path).get_string_from_utf8()
	
	display_label.clear() 
	_parse_and_render_content(raw_html, path)
	display_label.scroll_to_line(0)

func _parse_and_render_content(html: String, context_path: String) -> void:
	# Extract body content
	var body_regex = RegEx.new()
	body_regex.compile("<body[^>]*>([\\s\\S]*?)</body>")
	var body_match = body_regex.search(html)
	var content = body_match.get_string(1) if body_match else html

	# Split the content by image tags
	var img_regex = RegEx.new()
	img_regex.compile("<img[^>]+src=['\"]([^'\"]+)['\"][^>]*>")
	
	var last_pos = 0
	for m in img_regex.search_all(content):
		# Append text found before the image
		var text_before = content.substr(last_pos, m.get_start() - last_pos)
		display_label.append_text(_process_text_markup(text_before))
		
		# Process and Add Image
		var raw_src = m.get_string(1)
		var internal_img_path = context_path.get_base_dir().path_join(raw_src).simplify_path()
		var texture = _get_image_texture(internal_img_path)
		
		if texture:
			# add_image inserts the texture directly into the text flow
			display_label.add_image(texture, display_label.get_size().x - 40, 0)
			display_label.append_text("\n") # Newline after image
		
		last_pos = m.get_end()
	
	# Append remaining text
	display_label.append_text(_process_text_markup(content.substr(last_pos)))

func _process_text_markup(html_chunk: String) -> String:
	var bbcode = html_chunk
	var tags = {
		"<b>": "[b]", "</b>": "[/b]", "<strong>": "[b]", "</strong>": "[/b]",
		"<i>": "[i]", "</i>": "[/i]", "<em>": "[i]", "</em>": "[/i]",
		"<h1>": "[font_size=48][b]", "</h1>": "[/b][/font_size]\n",
		"<h2>": "[font_size=36][b]", "</h2>": "[/b][/font_size]\n",
		"<p[^>]*>": "", "</p>": "\n\n", "<br\\s*/?>": "\n"
	}
	for t in tags:
		bbcode = RegEx.create_from_string(t).sub(bbcode, tags[t], true)
	
	# Strip any leftover HTML tags
	bbcode = RegEx.create_from_string("<[^>]*>").sub(bbcode, "", true)
	return bbcode.replace("&nbsp;", " ").replace("&amp;", "&")

func _get_image_texture(internal_path: String) -> Texture2D:
	if not zip_reader.file_exists(internal_path): return null
	
	var buffer = zip_reader.read_file(internal_path)
	
	# 1. Sanitize for Android: Use MD5 hash to avoid illegal characters in filenames
	var safe_ext = internal_path.get_extension()
	var safe_name = internal_path.md5_text() + "." + safe_ext
	var disk_path = book_cache_path.path_join(safe_name)
	
	# 2. Cache it (useful for external viewers or future features)
	var file = FileAccess.open(disk_path, FileAccess.WRITE)
	if file:
		file.store_buffer(buffer)
		file.close()
	
	# 3. Load into memory as a Texture
	var image = Image.new()
	var error = OK
	if safe_ext.to_lower() == "png":
		error = image.load_png_from_buffer(buffer)
	elif safe_ext.to_lower() in ["jpg", "jpeg"]:
		error = image.load_jpg_from_buffer(buffer)
	
	if error == OK:
		return ImageTexture.create_from_image(image)
	return null
